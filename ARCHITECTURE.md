# CodeVerse architecture

## Overview

```
Browser ──────────────────────────────────────────────┐
 Next.js 15 (React 19, TypeScript, Tailwind v4)       │
  ├─ pages: home, auth, onboarding, dashboard, map,   │
  │  world, lesson player, lab, skills, achievements, │
  │  portfolio, settings, help                        │
  ├─ Visual Learning Engine (components/visuals)      │
  └─ Web Worker: Pyodide + sys.settrace harness       │  "Run" / Code X-Ray: learner code runs HERE
        (public/py-worker.js)                         │
              │  /api/* (same-origin proxy, next.config.ts)
              ▼
 Django 5.2 + DRF ── PostgreSQL (SQLite fallback)
  ├─ accounts    users, profiles, onboarding, auth, audit log
  ├─ curriculum  worlds, modules, lessons, skills, challenges, tests (YAML-loaded)
  ├─ learning    progress, activities, submissions, mastery, XP, achievements, portfolio
  ├─ grader      evaluation + sandbox backends + robot simulator
  │     └─ spawns ──► sandbox_runner.py in a separate process / container   "Submit": learner code runs HERE
  └─ tutor       Nova: provider abstraction, policy, usage records
```

Learner code never runs in the Django process. **Run** happens in the learner's browser, where it is fast, free, offline-capable and harmless to the server. **Submit** re-runs the code on the server with hidden tests in a sandbox, so assessments can't be faked from the client.

## Key decisions

| Decision | Why |
|---|---|
| Next.js proxies `/api` to Django | One origin, so HttpOnly session cookies and Django CSRF work without exposing tokens to JS |
| Session auth (not JWT) | Simpler and safer for a first-party web app: HttpOnly, server-revocable sessions |
| Lessons as validated YAML loaded into the DB | Authors edit text in git; the API serves from the DB; validation catches broken content before learners see it |
| Answer keys stripped in `curriculum/public.py` | A single projection layer is the only path from lesson content to the API |
| Expected outputs never enter the sandbox | The runner returns raw output and variables; comparison happens in the trusted process |
| Printed output separate from the input transcript | Tests compare what the program printed and ignore `input()` prompts, so learners aren't failed for prompt wording |
| Pyodide in a classic worker from a CDN | No bundler coupling; the worker is terminated on timeout; the URL is configurable for self-hosting |
| Container queries in visualizers | They render inside lesson cards of varying width, so layout follows the card, not the viewport |
| Hand-built components in a shadcn style, not the shadcn CLI | Same accessible patterns without a generator step; tokens live in `globals.css` |
| React Flow / D3 not used yet | Phase 1 visuals are simple SVG/CSS; add them for graph and ML visualizers (Phase 2/4) |

## Backend modules

- `apps/accounts` — `User` (email login, `role`: learner/mentor/content_editor/admin), `LearnerProfile` (onboarding answers and display preferences, stored server-side), auth views with explicit CSRF enforcement on login and register, audit logging (`codeverse.audit`), and the shared error envelope `{"error": {code, message, details}}`.
- `apps/curriculum` — models, `schema.py` validator, `loader.py` (idempotent upsert), `public.py` (answer-stripping projection), the `load_curriculum` command.
- `apps/learning` — `progression.py` (unlocking, XP, levels, streaks, mastery, lesson completion, assessment report), `achievements.py` (registry of evidence checks), `views.py` (all learner endpoints).
- `apps/grader` — `sandbox_runner.py` (standalone, standard library only), `sandbox.py` (Docker and subprocess backends), `evaluate.py` (comparison, AST quality checks, rubric), `robot.py` (deterministic block-program simulator).
- `apps/tutor` — `providers.py` (provider abstraction plus an Anthropic implementation), `service.py` (context building, assistance policy, reply validation, limits, prompt versioning), `TutorInteraction` (usage and token monitoring).

## Data model (main tables)

```
User 1─1 LearnerProfile
World 1─* Module 1─* Lesson *─* Skill (Skill *─* Skill prerequisites)
Lesson *─* Lesson (prerequisites)      World *─* Lesson (world prerequisites)
Lesson 1─* Challenge 1─* TestCase (visible | hidden; stdout | variables)
User ─ LessonProgress (status, current_block, code drafts)
User ─ ActivityResponse (predict/sequence/reflection; correct + first_attempt_correct)
User ─ HintUsage (max hint level per challenge)
User ─ Submission (check | submit; score, breakdown, quality) 1─* TestResult
User ─ SkillEvidence (unique per skill+challenge) → SkillMastery (level, points)
User ─ XPTransaction (append-only, unique source_key ⇒ idempotent awards)
Achievement ─ UserAchievement (evidence)
User ─ PortfolioEntry (unique per challenge)
User ─ TutorInteraction (mode, provider, model, prompt_version, tokens, status)
```

Migrations live in each app's `migrations/` folder. Learning state is never trusted to browser storage.

## API

Interactive docs: `/api/docs` (OpenAPI via drf-spectacular; login required). Every endpoint except auth requires a session. Errors share one shape: `{"error": {"code", "message", "details"}}`.

| Method & path | Purpose |
|---|---|
| `GET auth/csrf` · `POST auth/register` · `POST auth/login` · `POST auth/logout` · `GET auth/me` | Authentication (register/login are rate-limited and CSRF-checked) |
| `GET/PATCH profile` · `POST onboarding` | Profile, preferences, onboarding (diagnostic scored server-side) |
| `GET dashboard` | Aggregated learner state |
| `GET worlds` · `GET worlds/{slug}` | Map with per-lesson status and lock reasons |
| `GET lessons/{slug}` | Lesson with public blocks + learner progress (or `locked` + reason) |
| `POST lessons/{slug}/progress` | Autosave position and code drafts |
| `POST lessons/{slug}/activities/{block}` | Answer predict/sequence/reflection (checked server-side) |
| `POST lessons/{slug}/complete` | Verify completion → XP, achievements, unlocks, assessment report |
| `GET challenges/{slug}` · `POST …/check` · `POST …/submit` · `POST …/hints` · `GET …/submissions` | Challenges: visible-only check, full assessment, hint ladder, history |
| `GET skills` · `GET achievements` · `GET xp` · `GET analytics` | Mastery, achievements, XP ledger, analytics |
| `GET portfolio` · `PATCH portfolio/{id}` | Portfolio (ownership-checked) |
| `GET tutor/status` · `POST tutor/ask` | Nova availability and questions |

## Visual Learning Engine

Every visualizer supports predicting, manipulating, stepping, observing and connecting to code, and says honestly where its data comes from:

| Component | Data source | Connection to real execution |
|---|---|---|
| `CodeXRay` / Variable Lab | Real Pyodide run with `sys.settrace` | Every state is a recorded event: line, call stack with variables, output offset. Step backward replays the recording. |
| `FareExplorer` | Browser maths (labelled "simulation") | "Check with real Python" runs the equivalent program and shows Python's printed output |
| `LogicPlayground` | Declarative rules from lesson YAML, evaluated in TS | Generates the Python `if/elif/else`, highlights the executed line, and "Verify with Python" runs it |
| `LoopSimulator` | Deterministic state machine of the code shown | Mirrors the displayed `while` loop exactly, including a step limit for the infinite-loop bug |
| `RobotWorkspace` | `lib/robot.ts` for animation | The server re-simulates (`grader/robot.py`) for grading; both pass the shared `robot_fixtures.json` |

**Trace limits:** 1,500 recorded events and 100k steps in the browser; only `<learner>` frames are traced; values over 160 characters are shortened. The worker is killed after 10 seconds.

## Assessment pipeline

1. `POST challenges/{slug}/submit` → `evaluate_code(challenge, code, hint_level)`
2. `run_code` → sandbox backend → `sandbox_runner.py` executes the code once per test case with that test's stdin. It applies a step limit, an import allowlist, removed `open`/`eval`/`exec`, and output caps, then returns printed output, errors and variables.
3. `check_case` compares against expected values in the trusted process. Hidden tests return only their name, pass/fail and an authored hint.
4. `run_quality_checks` performs static AST checks (never executes code).
5. `compute_score` applies rubric weights. **Pass = every test passes.** The score is informative.
6. On a first pass, `on_challenge_passed` records skill evidence, awards idempotent XP plus the independence bonus, recomputes mastery, then evaluates achievements; projects, transfers and capstones go to the portfolio.

## Deployment

Recommended topology:

- **Frontend:** `npm run build && npm start` (or any Node host). Set `BACKEND_URL` to the internal Django URL.
- **Backend:** `gunicorn config.wsgi` behind TLS with `DJANGO_DEBUG=false`, a strong `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS` and `DATABASE_URL` (PostgreSQL). Run `migrate`, `load_curriculum` and `collectstatic`.
- **Grader:** `GRADER_BACKEND=docker` on a host with a Docker daemon. Pre-pull `python:3.12-alpine`. Best practice is a **separate grader host or worker** (see the roadmap: Celery + Redis queue) so the web tier never holds Docker access.
- **Pyodide:** self-host the Pyodide distribution and point `NEXT_PUBLIC_PYODIDE_URL` at it for reliability on limited connectivity.

Outstanding before a public launch: choose hosting, provision managed PostgreSQL and TLS, deploy a grader worker with Docker, configure the Nova API key (optional), and set up error monitoring and backups. None of this has been done in this repository.
