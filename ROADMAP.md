# Roadmap

Each phase must ship real, tested functionality. Fix regressions before expanding.

## Phase 1 — Functional core MVP ✅ (this release)

Done and verified (61 backend, 23 frontend unit and 4 end-to-end tests):

- Repository, Django apps, migrations, SQLite/PostgreSQL, environment-driven configuration
- Authentication (session + CSRF, throttled, audited); personalised onboarding with optional diagnostic
- Dashboard, adventure map, world overviews, explicit prerequisites
- World 0 (3 lessons, 4 robot missions, capstone) and the first World 1 module (5 lessons, 10 code challenges, 1 capstone)
- Pyodide runtime in a Web Worker; Code X-Ray tracing; Fare, Logic and Loop visualizers; Variable Lab
- Monaco workspace (autosave, resizable, Adventure/Focus modes, mobile tabs), progressive hints
- Server-side sandboxed grading with hidden tests, AST quality checks, rubric scoring
- Evidence-based mastery, idempotent XP, achievements, portfolio, analytics page
- Nova AI tutor: provider abstraction (Anthropic), policy enforcement, limits, honest offline state
- Light/dark mode, reduced motion, font scaling, keyboard-operable activities, i18n catalogue

Known limitations in Phase 1:

- Grading runs synchronously in the request; the Docker backend adds roughly a second of container start time per submission.
- There's no code formatter button yet, and Monaco's completion is generic rather than Python-aware.
- Visual Lab tracing has no "step into stdlib", by design; recordings are capped at 1,500 events.
- No email verification or password reset yet.

## Phase 2 — Full Python learning experience (next)

1. **Grader worker:** Celery + Redis queue, separate grader host, per-user concurrency, submission status polling.
2. **Curriculum:** functions (Function Factory visualizer), lists and tuples, dictionaries and sets, strings, error handling, files, modules, OOP, searching and sorting (Algorithm Explorer), testing, APIs and JSON (API visualizer with simulated requests), Git, project organisation, clean code, secure habits.
3. **Boss battle** per module; **Debug Detective** lessons with variable history and test-driven investigation.
4. Data Structures Playground (list/dict/stack/queue operations synced to code).
5. Mastery reassessment (spaced practice for skills that decay), daily challenges.
6. Admin content tools: preview a lesson as a learner, validate YAML in the admin.

## Phase 3 — Nova, fully

Concept-recovery mode (detect repeated mistakes, recommend prerequisites), code-review mode with rubric references, AI code-audit challenges (find the bug in AI-written code, write a test, fix it), AI feedback on reflections clearly labelled and never used as grading truth, an evaluation set for tutor quality, prompt-version A/B tests.

## Phase 4 — Machine Learning Laboratory

Pyodide packages (NumPy, pandas, scikit-learn, matplotlib) loaded on demand; dataset explorer, scatterplots, linear regression with draggable points, decision boundaries, train/test split and overfitting visualizers, gradient descent; capstone: an explainable suspicious-message classifier on a synthetic dataset, with an evaluation report.

## Phase 5 — Cybersecurity Fortress

Simulated network topology and packet flow, firewall-rule puzzles, authentication flow visualizer, hashing and encryption basics, secure-versus-insecure input-handling labs, log-analysis investigations; capstone: secure a digital verification service with a threat model. Everything is simulated and isolated, with no live targets.

## Phase 6 — DevOps City

Drag-and-drop **and** keyboard-built CI/CD pipeline simulator, broken-build and failing-test investigations, simulated outages and rollbacks, sandboxed shell labs in containers; capstone: package, test, deploy and monitor a Python app.

## Phase 7 — Social and advanced game features

Guilds, shared challenges, peer code review and collaborative projects. Moderation, reporting, blocking and privacy controls ship *before* any learner-to-learner messaging. Kinyarwanda translation of UI and content; offline caching of selected lessons and self-hosted Pyodide.
