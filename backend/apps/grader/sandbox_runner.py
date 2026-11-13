"""
CodeVerse sandbox runner.

This file is executed as a *separate* Python process (inside a locked-down container in
production). It must stay standalone: standard library only, no Django imports.
It is never imported by the Django application.

Protocol: reads one JSON object from stdin
    {"code": str, "cases": [{"stdin": str}], "max_steps": int, "max_output": int}
and writes one JSON object to stdout
    {"results": [{"stdout", "printed", "error", "variables", "steps", "truncated"}]}

Expected outputs are never sent here; comparison happens in the trusted grader.
The import allowlist and step limit are defence in depth, NOT the security boundary.
The container (no network, read-only FS, memory/CPU/pid limits, nobody user) is.
"""

import builtins
import json
import sys
import traceback

ALLOWED_MODULES = {
    "math", "random", "string", "datetime", "json", "statistics", "collections",
    "itertools", "functools", "re", "decimal", "fractions", "time", "typing",
    "dataclasses", "enum", "operator", "copy", "textwrap",
}
FILENAME = "<learner>"


class StepLimitExceeded(BaseException):
    """BaseException so `except Exception` in learner code cannot swallow it."""


class LimitedWriter:
    def __init__(self, limit):
        self.parts = []
        self.size = 0
        self.limit = limit
        self.truncated = False

    def write(self, text):
        text = str(text)
        room = self.limit - self.size
        if room <= 0:
            self.truncated = True
            return len(text)
        if len(text) > room:
            text = text[:room]
            self.truncated = True
        self.parts.append(text)
        self.size += len(text)
        return len(text)

    def flush(self):
        pass

    def getvalue(self):
        return "".join(self.parts)


class Tee:
    def __init__(self, *writers):
        self.writers = writers

    def write(self, text):
        for w in self.writers:
            w.write(text)
        return len(text)

    def flush(self):
        pass


def to_jsonable(value, depth=0):
    if isinstance(value, bool) or value is None or isinstance(value, (int, str)):
        return value if not isinstance(value, str) else value[:2000]
    if isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            return {"__repr__": repr(value)}
        return value
    if depth < 3 and isinstance(value, (list, tuple)):
        return {"__type__": type(value).__name__, "items": [to_jsonable(v, depth + 1) for v in list(value)[:100]]}
    if depth < 3 and isinstance(value, dict):
        return {"__type__": "dict", "items": [[to_jsonable(k, depth + 1), to_jsonable(v, depth + 1)] for k, v in list(value.items())[:100]]}
    if depth < 3 and isinstance(value, (set, frozenset)):
        return {"__type__": type(value).__name__, "items": sorted((to_jsonable(v, depth + 1) for v in value), key=repr)[:100]}
    return {"__repr__": repr(value)[:200]}


def capture_variables(namespace):
    out = {}
    for name, value in namespace.items():
        if name.startswith("__"):
            continue
        if callable(value) or type(value).__name__ == "module":
            continue
        out[name] = to_jsonable(value)
    return out


def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    root = name.split(".")[0]
    if level != 0 or root not in ALLOWED_MODULES:
        raise ImportError(f"module '{name}' is not available in graded challenges")
    return original_import(name, globals, locals, fromlist, level)


original_import = builtins.__import__


def error_info(exc):
    line = None
    for frame in traceback.extract_tb(exc.__traceback__):
        if frame.filename == FILENAME:
            line = frame.lineno
    if isinstance(exc, SyntaxError) and exc.filename == FILENAME:
        line = exc.lineno
    return {"type": type(exc).__name__, "message": str(exc), "line": line}


def run_case(code_obj, stdin_text, max_steps, max_output):
    out = LimitedWriter(max_output)  # full transcript: prompts, echoed input, printed text
    printed = LimitedWriter(max_output)  # only what the program itself wrote (what tests compare)
    lines = stdin_text.splitlines()
    steps = [0]

    def learner_input(prompt=""):
        out.write(str(prompt))
        if not lines:
            raise EOFError("EOF when reading a line (the program asked for more input than was provided)")
        value = lines.pop(0)
        out.write(value + "\n")  # echo, like an interactive terminal transcript
        return value

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != FILENAME:
            return None
        if event == "line":
            steps[0] += 1
            if steps[0] > max_steps:
                raise StepLimitExceeded()
        return tracer

    safe_builtins = dict(vars(builtins))
    safe_builtins["input"] = learner_input
    safe_builtins["__import__"] = safe_import
    for blocked in ("open", "exec", "eval", "compile", "breakpoint", "help", "exit", "quit"):
        safe_builtins.pop(blocked, None)
    namespace = {"__name__": "__main__", "__builtins__": safe_builtins}

    error = None
    old_stdout = sys.stdout
    sys.stdout = Tee(out, printed)
    sys.settrace(tracer)
    try:
        exec(code_obj, namespace)
    except StepLimitExceeded:
        error = {
            "type": "StepLimitExceeded",
            "message": f"Stopped after {max_steps} steps. Is there a loop that never ends?",
            "line": None,
        }
    except SystemExit:
        pass
    except BaseException as exc:  # learner code may raise anything
        error = error_info(exc)
    finally:
        sys.settrace(None)
        sys.stdout = old_stdout

    try:
        variables = capture_variables(namespace)
    except BaseException:
        variables = {}
    return {
        "stdout": out.getvalue(),
        "printed": printed.getvalue(),
        "error": error,
        "variables": variables,
        "steps": steps[0],
        "truncated": out.truncated,
    }


def main():
    payload = json.loads(sys.stdin.read())
    real_stdout = sys.stdout
    max_steps = int(payload.get("max_steps", 200000))
    max_output = int(payload.get("max_output", 20000))
    cases = payload.get("cases", [])
    try:
        code_obj = compile(payload["code"], FILENAME, "exec")
    except SyntaxError as exc:
        err = {"type": "SyntaxError", "message": exc.msg, "line": exc.lineno}
        results = [{"stdout": "", "printed": "", "error": err, "variables": {}, "steps": 0, "truncated": False} for _ in cases]
        real_stdout.write(json.dumps({"results": results}))
        return
    results = [run_case(code_obj, c.get("stdin", ""), max_steps, max_output) for c in cases]
    real_stdout.write(json.dumps({"results": results}))
    real_stdout.flush()


if __name__ == "__main__":
    main()
