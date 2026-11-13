"""
Execution backends for learner code. Learner code never runs inside the Django process.

- DockerSandbox: production backend. No network, read-only root FS, dropped capabilities,
  memory/CPU/pid limits, unprivileged user, wall-clock timeout with forced kill.
- SubprocessSandbox: LOCAL DEVELOPMENT ONLY. A separate isolated-mode interpreter with a
  timeout (and rlimits on POSIX). It is NOT a security boundary; settings refuse it unless
  GRADER_ALLOW_UNSAFE_SUBPROCESS is enabled.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger("codeverse.grader")

RUNNER_PATH = Path(__file__).with_name("sandbox_runner.py")


class SandboxUnavailable(RuntimeError):
    """The execution backend cannot run code right now (shown honestly to the learner)."""


@dataclass
class CaseResult:
    stdout: str = ""
    printed: str = ""
    error: dict | None = None
    variables: dict = field(default_factory=dict)
    steps: int = 0
    truncated: bool = False


@dataclass
class RunResult:
    cases: list[CaseResult]
    timed_out: bool = False
    backend: str = ""


def _payload(code: str, stdins: list[str]) -> str:
    return json.dumps({
        "code": code,
        "cases": [{"stdin": s} for s in stdins],
        "max_steps": settings.GRADER_MAX_STEPS,
        "max_output": settings.GRADER_MAX_OUTPUT_CHARS,
    })


def _parse(raw: str, n: int, backend: str) -> RunResult:
    try:
        data = json.loads(raw)
        cases = [CaseResult(**r) for r in data["results"]]
    except (ValueError, KeyError, TypeError) as exc:
        logger.warning("grader output unparseable backend=%s err=%s", backend, exc)
        cases = [CaseResult(error={"type": "RunnerError", "message": "The program ended unexpectedly.", "line": None}) for _ in range(n)]
    return RunResult(cases=cases, backend=backend)


def _timeout_result(n: int, backend: str) -> RunResult:
    err = {
        "type": "TimeoutError",
        "message": f"The program ran longer than {settings.GRADER_TIMEOUT_SECONDS:g} seconds and was stopped.",
        "line": None,
    }
    return RunResult(cases=[CaseResult(error=err) for _ in range(n)], timed_out=True, backend=backend)


class DockerSandbox:
    name = "docker"

    def run(self, code: str, stdins: list[str]) -> RunResult:
        docker = shutil.which("docker")
        if not docker:
            raise SandboxUnavailable("Docker is not installed on the grading host.")
        container = f"cv-grade-{uuid.uuid4().hex[:12]}"
        cmd = [
            docker, "run", "--rm", "-i", "--name", container,
            "--network", "none", "--memory", "128m", "--memory-swap", "128m",
            "--cpus", "0.5", "--pids-limit", "32", "--read-only",
            "--tmpfs", "/tmp:size=4m,noexec", "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges", "--user", "65534:65534",
            settings.GRADER_DOCKER_IMAGE, "python", "-I", "-S", "-c", RUNNER_PATH.read_text(encoding="utf-8"),
        ]
        try:
            proc = subprocess.run(
                cmd, input=_payload(code, stdins), capture_output=True, text=True,
                timeout=settings.GRADER_TIMEOUT_SECONDS + 4,  # container start overhead
                encoding="utf-8",
            )
        except subprocess.TimeoutExpired:
            subprocess.run([docker, "kill", container], capture_output=True)
            return _timeout_result(len(stdins), self.name)
        if proc.returncode != 0 and not proc.stdout:
            stderr = proc.stderr.lower()
            if "cannot connect" in stderr or "daemon" in stderr or "pipe" in stderr:
                raise SandboxUnavailable("The grading container service is not running.")
            if proc.returncode == 137:  # OOM-killed
                err = {"type": "MemoryError", "message": "The program used too much memory.", "line": None}
                return RunResult(cases=[CaseResult(error=err) for _ in stdins], backend=self.name)
        return _parse(proc.stdout, len(stdins), self.name)


class SubprocessSandbox:
    name = "subprocess"

    def run(self, code: str, stdins: list[str]) -> RunResult:
        env = {"PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1"}
        if os.name == "nt":
            env["SYSTEMROOT"] = os.environ.get("SYSTEMROOT", r"C:\Windows")
        preexec = None
        if os.name == "posix":
            import resource

            def preexec():  # pragma: no cover - platform specific
                resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,) * 2)
                cpu = int(settings.GRADER_TIMEOUT_SECONDS) + 1
                resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
                resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024,) * 2)
                os.setsid()

        with tempfile.TemporaryDirectory(prefix="cv-grade-") as workdir:
            try:
                proc = subprocess.run(
                    [sys.executable, "-I", "-S", str(RUNNER_PATH)],
                    input=_payload(code, stdins), capture_output=True, text=True, encoding="utf-8",
                    timeout=settings.GRADER_TIMEOUT_SECONDS, cwd=workdir, env=env, preexec_fn=preexec,
                )
            except subprocess.TimeoutExpired:
                return _timeout_result(len(stdins), self.name)
        return _parse(proc.stdout, len(stdins), self.name)


def get_sandbox():
    backend = settings.GRADER_BACKEND
    if backend == "docker":
        return DockerSandbox()
    if backend == "subprocess":
        if not settings.GRADER_ALLOW_UNSAFE_SUBPROCESS:
            raise ImproperlyConfigured(
                "GRADER_BACKEND=subprocess is for local development only. "
                "Set GRADER_ALLOW_UNSAFE_SUBPROCESS=true explicitly to use it."
            )
        return SubprocessSandbox()
    raise ImproperlyConfigured(f"Unknown GRADER_BACKEND '{backend}'")


def run_code(code: str, stdins: list[str]) -> RunResult:
    if len(code) > settings.GRADER_MAX_CODE_CHARS:
        err = {"type": "CodeTooLong", "message": "This program is longer than the grader accepts.", "line": None}
        return RunResult(cases=[CaseResult(error=err) for _ in stdins])
    return get_sandbox().run(code, stdins)
