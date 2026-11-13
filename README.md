# CodeVerse

**Learn it. See it. Build it.** A visual, gamified coding academy that takes complete beginners from "what is programming?" to writing, debugging and proving real Python, with Machine Learning, Cybersecurity and DevOps pathways planned on top.

The defining loop: **Experience → Visualize → Understand → Experiment → Code → Build → Evaluate → Master.**

## What works today (Phase 1, verified)

| Area | Status |
|---|---|
| Email/password accounts (session cookies + CSRF), login, logout | ✅ working, tested |
| Personalised onboarding (experience, goals, interests, guidance, pace, optional diagnostic, avatar) | ✅ |
| Dashboard: level/XP, forgiving streak, continue button, adventure map, skills, achievements, projects, XP ledger, recommendations, all from real data | ✅ |
| Adventure map and world pages with explicit prerequisites | ✅ |
| **World 0 · Discover Programming**: 3 lessons, 4 robot missions (incl. a debug mission and a repeat/optimisation mission), capstone | ✅ |
| **World 1 · Python Foundations**: 5 lessons (first program → **Moto Fare mission** → mobile-money conditions → delivery loops → **Rider Day Summary capstone**), 10 code challenges, 35 test cases (20 hidden) | ✅ |
| Real Python in the browser (Pyodide in a Web Worker, step limit and hard timeout, stdin) | ✅ |
| **Code X-Ray**: real `sys.settrace` recordings, step forward/back, play speed, variables, call stack, output, error line | ✅ |
| Visualizers: Fare Explorer (variables), Logic Playground (conditions), Loop Simulator (loops incl. infinite-loop demo), Variable Lab | ✅ |
| Monaco editor (+ textarea fallback), resizable editor, autosave to server, Adventure ↔ Focus modes without losing work, mobile tabbed workspace | ✅ |
| Server-side assessment: visible + hidden tests in an isolated sandbox process, AST quality checks, rubric score, no AI grading | ✅ |
| Evidence-based skill mastery, idempotent XP ledger, 9 evidence-checked achievements, portfolio entries for projects | ✅ |
| Progressive authored hints (affect independence score); **Nova** AI tutor with provider abstraction, policy enforcement, limits | ✅ (AI needs an API key; otherwise Nova says it's offline) |
| Light/dark themes, reduced motion, font scaling, keyboard-operable activities, i18n-ready UI strings | ✅ |
| ML / Cybersecurity / DevOps worlds | 🚧 shown honestly as "being built" (see [ROADMAP.md](ROADMAP.md)) |

Tests: **61 backend** (pytest), **23 frontend unit** (Vitest + RTL), **4 end-to-end** (Playwright, full beginner journey on desktop + mobile layout).

## Quick start (local development)

Prerequisites: Python 3.12+, Node 20+. Docker is optional (for PostgreSQL and the production grader).

```bash
cp .env.example .env
```

Edit `.env` and set `DJANGO_SECRET_KEY` to a long random string. The defaults use SQLite and the dev-only subprocess grader.

**Backend**

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows (Git Bash); on macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py load_curriculum
python manage.py createsuperuser   # optional: admin at http://127.0.0.1:8000/admin/
python manage.py runserver 127.0.0.1:8000
```

**Frontend** (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The frontend proxies `/api/*` to Django, so the browser sees one origin.

### PostgreSQL instead of SQLite

```bash
docker compose up -d db
```

Then in `.env`: `DATABASE_URL=postgres://codeverse:codeverse@localhost:5432/codeverse`, and run `migrate` + `load_curriculum` again.

### Running the tests

```bash
cd backend && python -m pytest
```

```bash
cd frontend && npm test && npm run typecheck && npx eslint src
```

```bash
cd frontend && npx playwright install chromium && npm run e2e
```

The e2e suite expects Django on :8000 with the curriculum loaded; it starts or reuses the Next.js dev server.

## Configuration

All settings come from environment variables — see [.env.example](.env.example). Key ones:

| Variable | Meaning |
|---|---|
| `GRADER_BACKEND` | `docker` (isolated container, production) or `subprocess` (local dev only; also needs `GRADER_ALLOW_UNSAFE_SUBPROCESS=true`) |
| `NOVA_PROVIDER` | `none` (default, Nova says it is offline) or `anthropic` (needs `ANTHROPIC_API_KEY`) |
| `NOVA_MODEL`, `NOVA_EFFORT`, `NOVA_DAILY_REQUEST_LIMIT` | AI tutor model, reasoning effort, per-learner daily cap |
| `NEXT_PUBLIC_PYODIDE_URL` | Where the browser loads Pyodide from (self-host it for offline/limited connectivity) |

## Editing the curriculum

Lessons are YAML in [backend/content/](backend/content/), validated by [schema.py](backend/apps/curriculum/schema.py). After editing, run `python manage.py load_curriculum`. Every code challenge must include a `solution`; the test suite runs each reference solution against all of its tests and checks that the starter code does not already pass. See [CURRICULUM.md](CURRICULUM.md).

## Deployment

See [ARCHITECTURE.md § Deployment](ARCHITECTURE.md#deployment). Nothing has been deployed yet: this repository is deployment-ready, but no hosting credentials were available. The outstanding steps are listed there.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): system design, data model, API, Visual Learning Engine, assessment
- [CURRICULUM.md](CURRICULUM.md): curriculum map, lesson schema, scoring and progression rules
- [SECURITY.md](SECURITY.md): threat model, sandboxing, auth, AI safety
- [ROADMAP.md](ROADMAP.md): implemented vs planned, next priorities
