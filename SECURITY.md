# Security

Learner code is treated as hostile by default. This document covers what is enforced today and what still needs work before production.

## Execution of learner code

| Where | Isolation | Limits |
|---|---|---|
| Browser (Run, Code X-Ray) | Pyodide WebAssembly sandbox in a dedicated Web Worker; no access to the page DOM or cookies | 100k-step limit (raised as a `BaseException`, so `except Exception` can't swallow it), 20k output characters, 10 s wall-clock, after which the worker is terminated |
| Server (Check, Submit), `docker` backend | Fresh `python:3.12-alpine` container per submission: `--network none`, `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges`, `--user 65534:65534`, `--pids-limit 32`, `--memory 128m` (no swap), `--cpus 0.5`, `noexec` tmpfs | Timeout plus forced `docker kill`, step limit, output cap, code size cap (20k characters) |
| Server, `subprocess` backend | **Development only.** Separate `python -I -S` process, empty temp working directory, minimal environment, rlimits on POSIX | Refused unless `GRADER_ALLOW_UNSAFE_SUBPROCESS=true` |

Defence in depth inside the runner: import allowlist (no `os`, `subprocess`, `socket` and the like), `open`/`exec`/`eval`/`compile` removed, separate namespace per test case. These are **not** the security boundary (Python-level sandboxes can be escaped); the container is.

**Grading integrity:** expected outputs and hidden inputs' expected values never enter the sandbox. Comparison runs in Django. Hidden test inputs are sent into the sandbox but never returned to the learner. A learner who tampers with their own output can, at most, affect their own score, and still can't learn hidden expectations.

## Authentication and sessions

- Django password hashing (PBKDF2) and the full validator set (length ≥ 8, common-password and similarity checks).
- HttpOnly, SameSite=Lax session cookies; `Secure` and HSTS when `DJANGO_DEBUG=false`.
- CSRF required on all unsafe requests, **including login and register** (prevents login-CSRF).
- Rate limits: auth 10/min, submissions 30/min, tutor 20/min, plus global anonymous and user limits (`THROTTLE_*`).
- Roles on `User.role` (learner, mentor, content_editor, admin). Only staff can use the Django admin, which is where curriculum is managed.

## Authorization and data

- Every learner endpoint requires a session; objects are always looked up by `user=request.user` (for example, portfolio PATCH returns 404 for other users' entries).
- Locked lessons return no content, and their challenges reject submissions (403).
- Answer keys, explanations, reference solutions and hidden tests are removed by `curriculum/public.py` before any API response.
- Cosmetic unlocks (avatar accessories) are checked against earned achievements on the server.
- Audit log (`codeverse.audit` logger): registration, login success and failure, logout, grading, lesson completion, grader outages.

## Nova (AI tutor)

- API keys exist only in server environment variables and never reach the browser.
- Minimal structured context: lesson objectives, challenge prompt, learner code and output, hint level. Hidden tests and solutions are never sent (covered by a test).
- Learner code, output and question are wrapped in tags and declared as data in the system prompt (prompt-injection mitigation).
- Reply validation enforces the assistance policy: code blocks longer than 4 lines are removed in practice, and all code is removed during assessments (transfer and capstone challenges).
- Per-learner daily limit, throttling, and token usage stored per interaction (`TutorInteraction`) for cost monitoring. Refusals are handled, and server-side refusal fallback is enabled by default (`NOVA_REFUSAL_FALLBACK`).
- With no provider configured, Nova clearly reports that it is offline. It never fabricates replies.

## Known gaps and next steps

1. **Grader queue:** move grading to a Celery and Redis worker on a separate host so the web tier has no Docker access, with per-user concurrency limits.
2. **Pyodide supply chain:** self-host Pyodide with Subresource Integrity, and add a Content-Security-Policy header.
3. **Account security:** email verification, password reset, and optional two-factor authentication.
4. **Abuse controls:** before guilds or peer review ship, add moderation, reporting and blocking.
5. **Secrets and ops:** use a secret manager in production; run dependency audits (`pip-audit`, `npm audit`) in CI.

Report vulnerabilities privately to the maintainers rather than in a public issue.
