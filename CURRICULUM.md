# Curriculum

Content lives in [backend/content/](backend/content/) as YAML (one world per file) and is validated by [backend/apps/curriculum/schema.py](backend/apps/curriculum/schema.py). Example prices (moto fares, mobile money, tickets, electricity) are invented for learning and are not official tariffs.

## Curriculum map

### World 0 — Discover Programming (implemented)
| Lesson | Kind | Activities | Skills |
|---|---|---|---|
| What Is Programming? | lesson | story, input→processing→output, sequencing (send mobile money), prediction, reflection | sequencing |
| The Delivery Robot | mission | robot missions: *Straight Road*, *Turning Corners*; direction prediction | sequencing, algorithms |
| Capstone: Neighbourhood Delivery | capstone | predict a crash, **debug** a broken route, optimise with **repeat** (≤6 blocks), blocks → Python, explain the fix | algorithms, debugging |

### World 1 — Python Foundations (Phase 1 slice implemented)
| Lesson | Challenges (tier) | Visuals | Skills |
|---|---|---|---|
| Your First Python Program | Two-line greeting (micro) | Code X-Ray | output |
| **Mission: Moto Fare Calculator** | Change the trip (micro) · Add a service fee (micro) · Real fare calculator with input (project, 3 hidden tests) · **Electricity bill (transfer)** | Fare Explorer, Variable Lab | variables, expressions, input |
| Mission: Mobile Money Validator | Transaction validator (project, 4 hidden) · **Bus ticket prices (transfer)** | Logic Playground, X-Ray | conditions |
| Mission: The Delivery Round | Delivery report (project) · **Debug the endless loop** | Loop Simulator, X-Ray | loops |
| **Capstone: Rider Day Summary** | Rider day summary (capstone, 4 hidden; portfolio entry) | — | decomposition + all above |

Remaining World 1 topics (functions, lists/tuples, dictionaries/sets, strings, errors, files, modules, OOP, searching/sorting, debugging, testing, APIs/JSON, Git, project organisation, virtual environments, clean code, secure habits, AI coding tools) are scheduled in [ROADMAP.md](ROADMAP.md) Phase 2. Each will follow the same pattern: micro-builds → module project → transfer challenge → boss battle.

### Worlds 2–4 — ML Laboratory, Cybersecurity Fortress, DevOps City
Shown on the map as "being built", with their stage outlines. They unlock after the Python capstone once implemented.

## Lesson schema

```yaml
- slug: moto-fare-calculator          # unique, used in URLs
  title: "Mission: Moto Fare Calculator"
  summary: ...
  kind: mission                       # lesson | mission | boss | capstone
  xp: 120
  estimated_minutes: 30
  prerequisites: [hello-python]       # explicit lesson prerequisites
  objectives: [...]
  skills: [variables, expressions]
  challenges: [...]                   # see below
  blocks:                             # rendered in order by the lesson player
    - {type: story, id, title, body, scene}               # scene: moto|robot|momo|rider|computer
    - {type: explain, id, title, body, code?, note?, analogy?, actual?}
    - {type: visual, id, component, config, caption}      # fare-explorer|variable-lab|logic-playground|loop-simulator
    - {type: predict, id, question, options:[{id,label}], answer, explanation}
    - {type: sequence, id, prompt, items:[{id,label}], answer:[ids], explanation}
    - {type: xray, id, title, prompt, code, stdin?}
    - {type: challenge, id, challenge: <challenge slug>}
    - {type: reflection, id, prompt, min_chars}
```

Analogies (`analogy`) are always paired with what really happens (`actual`), so learners can tell the metaphor from the machine.

### Challenge schema

```yaml
- slug: fare-calculator-input
  title: The Real Fare Calculator
  kind: code                 # code | robot (robot: spec.grid with S P D . #, facing, allowed, max_blocks, starter_program)
  tier: project              # micro | project | transfer | debug | capstone
  prompt: ...
  requirements: [...]
  starter_code: ...
  solution: ...              # reference solution: never served, verified by the test suite
  quality_checks:            # static AST checks: defines_variable, uses_input, uses_operator, uses_loop, uses_if, uses_fstring, no_hardcoded_output
    - {rule: uses_input, message: "..."}
  rubric: {correctness: 0.6, quality: 0.2, independence: 0.2}   # optional, must sum to 1
  hints:                     # progressive ladder: 1 clarifying question → 2 concept → 3 visual → 4 pseudocode → 5 direct
    - {level: 1, text: ...}
  tests:
    - name: Example trip
      stdin: "4\n300"
      stdout: "Total fare: 1400 RWF"
      match: lines           # lines (expected lines appear in order) | exact (no extra lines) | contains
    - name: Longer trip
      visible: false         # hidden: inputs and expected values are never shown
      stdin: "10\n250"
      stdout: "Total fare: 2700 RWF"
      hint: "Make sure both values come from input."
    - name: Variables
      kind: variables
      variables: {distance: 7, fare: 2450}
```

Output comparison ignores `input()` prompts and echoed input, letter case and trailing punctuation, and compares numbers numerically (`1400` equals `1400.0`).

## How progress works (shown to learners)

- **XP:** a challenge's XP on its first pass, +20% if no hints were opened; a lesson's XP once, when the server verifies every required activity; achievement XP once each. Running code, checking visible tests and re-submitting never award XP. Implemented as an append-only ledger with a unique `source_key` per award.
- **Levels:** level *L* starts at 50·*L*·(*L*−1) XP (100, 300, 600, 1000, …).
- **Streaks:** consecutive active days; today's streak survives until the end of tomorrow. Missing days is never penalised, and the dashboard emphasises active days per week.
- **Mastery per skill**, from evidence points (micro 1, debug/project 2, transfer/capstone 3):
  `Not started` → `Exploring` (lesson opened) → `Practising` (≥1) → `Developing` (≥3) → `Proficient` (≥5 **and** a transfer or capstone pass) → `Mastered` (≥8, transfer, **and** a no-hint pass).
- **Challenge score:** rubric weights × correctness (weighted tests), quality (static checks) and independence (by highest hint level: 0→100%, 1→90%, 2→80%, 3→65%, 4→50%, 5→30%). Passing requires every test to pass.
- **Lesson assessment report:** functional correctness, understanding (first-try predictions), independence, quality and reflection. Fully deterministic; there is no AI grading.
- **Unlocking:** explicit lesson prerequisites, plus world prerequisites. Locked items always state what to complete first.

## Adding content checklist

1. Add the lesson and challenges to the world YAML, including a reference `solution` for every code challenge.
2. Include at least one visible test, and hidden tests for project, transfer and capstone tiers, covering boundaries and edge cases.
3. Write a hint ladder that asks before it tells.
4. Run `python -m pytest apps/grader`: it checks that solutions pass and starters don't.
5. Run `python manage.py load_curriculum`.
