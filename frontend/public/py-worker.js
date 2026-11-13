/* CodeVerse Python worker.
 * Runs learner code with Pyodide (CPython compiled to WebAssembly) off the main thread.
 * Traces are produced by Python's own sys.settrace — they are real execution records, not simulations.
 * The main thread enforces a wall-clock timeout by terminating this worker.
 */
/* global importScripts, loadPyodide */

const HARNESS = String.raw`
import sys, builtins, json, traceback

FILENAME = "<learner>"

class StepLimitExceeded(BaseException):
    pass

def _safe_repr(v, limit=160):
    try:
        r = repr(v)
    except BaseException:
        r = "<unprintable>"
    return r if len(r) <= limit else r[: limit - 1] + "…"

def _describe(v):
    t = type(v).__name__
    d = {"type": t, "repr": _safe_repr(v)}
    if isinstance(v, bool) or v is None or isinstance(v, (int, float)):
        if not (isinstance(v, float) and (v != v or v in (float("inf"), float("-inf")))):
            d["value"] = v
    elif isinstance(v, str):
        d["value"] = v[:500]
    elif isinstance(v, (list, tuple)) and len(v) <= 50:
        d["items"] = [_safe_repr(x, 60) for x in v]
    elif isinstance(v, dict) and len(v) <= 50:
        d["entries"] = [[_safe_repr(k, 40), _safe_repr(x, 60)] for k, x in v.items()]
    return d

def _vars(frame):
    src = frame.f_globals if frame.f_code.co_name == "<module>" else frame.f_locals
    out = {}
    for k, v in list(src.items()):
        if k.startswith("__") or callable(v) or type(v).__name__ == "module":
            continue
        out[k] = _describe(v)
    return out

def _stack(frame):
    frames = []
    f = frame
    while f is not None:
        if f.f_code.co_filename == FILENAME:
            name = "main program" if f.f_code.co_name == "<module>" else f.f_code.co_name + "()"
            frames.append({"name": name, "line": f.f_lineno, "vars": _vars(f)})
        f = f.f_back
    frames.reverse()
    return frames

def __cv_run(code, stdin_lines, trace_enabled, max_steps, max_trace):
    transcript = []
    printed = []
    events = []
    lines = list(stdin_lines)
    steps = [0]
    truncated = [False]

    def size():
        return sum(len(s) for s in transcript)

    class Writer:
        def write(self, s):
            s = str(s)
            if size() > 20000:
                truncated[0] = True
                return len(s)
            transcript.append(s)
            printed.append(s)
            return len(s)
        def flush(self):
            pass

    def learner_input(prompt=""):
        transcript.append(str(prompt))
        if not lines:
            raise EOFError("EOF when reading a line (the program asked for more input than you provided in the Input panel)")
        value = lines.pop(0)
        transcript.append(value + "\n")
        return value

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != FILENAME:
            return None
        if event == "line":
            steps[0] += 1
            if steps[0] > max_steps:
                raise StepLimitExceeded()
            if trace_enabled and len(events) < max_trace:
                events.append({"event": "line", "line": frame.f_lineno, "stack": _stack(frame), "out": size()})
        elif event == "return" and trace_enabled and frame.f_code.co_name != "<module>" and len(events) < max_trace:
            events.append({"event": "return", "line": frame.f_lineno, "func": frame.f_code.co_name,
                           "value": _describe(arg), "stack": _stack(frame), "out": size()})
        return tracer

    b = dict(vars(builtins))
    b["input"] = learner_input
    ns = {"__name__": "__main__", "__builtins__": b}
    error = None
    final_vars = {}
    try:
        compiled = compile(code, FILENAME, "exec")
    except SyntaxError as exc:
        return json.dumps({"stdout": "", "printed": "", "error": {"type": "SyntaxError", "message": exc.msg, "line": exc.lineno},
                           "trace": [], "steps": 0, "truncated": False, "variables": {}})
    old = sys.stdout
    sys.stdout = Writer()
    sys.settrace(tracer)
    try:
        exec(compiled, ns)
    except StepLimitExceeded:
        error = {"type": "StepLimitExceeded", "message": "Stopped after %d steps. Is there a loop that never ends?" % max_steps, "line": None}
    except SystemExit:
        pass
    except BaseException as exc:
        line = None
        for fr in traceback.extract_tb(exc.__traceback__):
            if fr.filename == FILENAME:
                line = fr.lineno
        error = {"type": type(exc).__name__, "message": str(exc), "line": line}
    finally:
        sys.settrace(None)
        sys.stdout = old
    for k, v in list(ns.items()):
        if not (k.startswith("__") or callable(v) or type(v).__name__ == "module"):
            final_vars[k] = _describe(v)
    if trace_enabled:
        events.append({"event": "end" if error is None else "error", "line": error["line"] if error else None,
                       "stack": [{"name": "main program", "line": None, "vars": final_vars}], "out": size()})
    return json.dumps({"stdout": "".join(transcript), "printed": "".join(printed), "error": error, "trace": events,
                       "steps": steps[0], "truncated": truncated[0] or len(events) >= max_trace, "variables": final_vars})
`;

let pyodide = null;
let loading = null;

async function ensure(indexURL) {
  if (pyodide) return pyodide;
  if (!loading) {
    loading = (async () => {
      importScripts(indexURL + "pyodide.js");
      const py = await loadPyodide({ indexURL });
      py.runPython(HARNESS);
      pyodide = py;
      return py;
    })();
  }
  return loading;
}

self.onmessage = async (event) => {
  const msg = event.data;
  try {
    if (msg.type === "init") {
      await ensure(msg.indexURL);
      self.postMessage({ type: "ready" });
      return;
    }
    if (msg.type === "run") {
      const py = await ensure(msg.indexURL);
      const run = py.globals.get("__cv_run");
      const lines = py.toPy(msg.stdin ? msg.stdin.replace(/\r/g, "").split("\n").filter((l, i, a) => !(i === a.length - 1 && l === "")) : []);
      const raw = run(msg.code, lines, !!msg.trace, msg.maxSteps || 100000, msg.maxTrace || 1500);
      lines.destroy();
      self.postMessage({ type: "result", id: msg.id, result: JSON.parse(raw) });
    }
  } catch (err) {
    self.postMessage({ type: "fatal", id: msg.id, message: String(err && err.message ? err.message : err) });
  }
};
