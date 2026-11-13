"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { useLessonContext } from "@/components/lesson/LessonContext";
import { Badge, Button, Icon, Markdown } from "@/components/ui";
import { CodeXRay } from "@/components/visuals/CodeXRay";
import { useT } from "@/i18n";
import { api, ApiError } from "@/lib/api";
import { announceXp } from "@/lib/progress";
import { ERROR_GUIDE, type RunResult } from "@/lib/python/runtime";
import type { Challenge, Evaluation, TestOutcome } from "@/lib/types";
import { HintPanel } from "./HintPanel";
import { NovaPanel } from "./NovaPanel";
import { RewardBanner } from "./RewardBanner";
import { usePython } from "./usePython";
import { useMediaQuery } from "@/lib/useMediaQuery";

const TIER: Record<Challenge["tier"], { label: string; tone: "blue" | "teal" | "violet" | "coral" | "gold" }> = {
  micro: { label: "Micro-build", tone: "blue" },
  project: { label: "Module project", tone: "teal" },
  transfer: { label: "Transfer challenge", tone: "violet" },
  debug: { label: "Debug challenge", tone: "coral" },
  capstone: { label: "Capstone", tone: "gold" },
};

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k} = ${JSON.stringify(x)}`).join("\n");
}

function TestRow({ t }: { t: TestOutcome }) {
  return (
    <li className={clsx("rounded-xl border p-3", t.passed ? "border-good/30 bg-good-soft/50" : "border-bad/30 bg-bad-soft/50")}>
      <div className="flex items-start gap-2">
        <Icon name={t.passed ? "check" : "x"} className={clsx("mt-0.5 size-5 shrink-0", t.passed ? "text-good" : "text-bad")} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {t.name} {!t.visible && <Badge className="ml-1">hidden test</Badge>}
          </p>
          <p className="text-sm text-ink-2">{t.message}</p>
          {t.error && ERROR_GUIDE[t.error.type] && <p className="mt-1 text-sm text-ink-3">{ERROR_GUIDE[t.error.type]}{t.error.line ? ` (line ${t.error.line})` : ""}</p>}
          {t.visible && !t.passed && (t.expected || t.actual) && (
            <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
              {t.stdin ? <div><p className="font-bold text-ink-3">Input</p><pre className="rounded-md bg-card p-2 font-mono">{t.stdin}</pre></div> : <div />}
              <div><p className="font-bold text-ink-3">Expected</p><pre className="whitespace-pre-wrap rounded-md bg-card p-2 font-mono">{fmt(t.expected)}</pre></div>
              <div><p className="font-bold text-ink-3">Your program</p><pre className="whitespace-pre-wrap rounded-md bg-card p-2 font-mono">{fmt(t.actual) || "(nothing)"}</pre></div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function Results({ ev }: { ev: Evaluation }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={ev.passed ? "good" : "bad"}>{ev.passed ? "All tests passed" : `${ev.summary?.passed}/${ev.summary?.total} tests passed`}</Badge>
        <Badge>{ev.mode === "check" ? "Visible tests only — not assessed" : `Assessment · attempt ${ev.attempt}`}</Badge>
        {ev.mode === "submit" && ev.score !== undefined && <Badge tone="blue">Score {ev.score}</Badge>}
        <span className="text-xs text-ink-3">Graded by automated tests (deterministic, no AI)</span>
      </div>
      <ul className="space-y-2">{ev.tests?.map((t) => <TestRow key={t.test_id} t={t} />)}</ul>
      {!!ev.quality?.length && (
        <div>
          <p className="text-sm font-bold text-ink-3">Code quality checks</p>
          <ul className="mt-1 space-y-1 text-sm">
            {ev.quality.map((q) => (
              <li key={q.rule} className="flex items-start gap-2">
                <Icon name={q.passed ? "check" : "bulb"} className={clsx("mt-0.5 size-4", q.passed ? "text-good" : "text-warn")} /> {q.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ev.mode === "submit" && ev.breakdown && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-ink-2">How this score was calculated</summary>
          <ul className="mt-1 space-y-0.5">
            {Object.entries(ev.breakdown).map(([k, v]) => (
              <li key={k}>{k}: {Math.round(v.value * 100)}% × weight {v.weight}</li>
            ))}
          </ul>
          <p className="mt-1 text-ink-3">Independence is 100% when no hints are opened, and decreases a little for each hint level.</p>
        </details>
      )}
      {!ev.passed && ev.mode === "submit" && (
        <p className="text-sm text-ink-2">Use the failing test names and messages as clues. Hidden tests use different inputs to check that your program works in general.</p>
      )}
    </div>
  );
}

/** Small drag handle for resizing the editor (keyboard: arrow keys). */
function useResizable(initial: number, min: number, max: number) {
  const [size, setSize] = useState(initial);
  const start = useRef<{ y: number; s: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { y: e.clientY, s: size };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (start.current) setSize(Math.max(min, Math.min(max, start.current.s + e.clientY - start.current.y)));
  };
  const onPointerUp = () => (start.current = null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setSize((s) => Math.min(max, s + 30));
    if (e.key === "ArrowUp") setSize((s) => Math.max(min, s - 30));
  };
  return { size, handle: { onPointerDown, onPointerMove, onPointerUp, onKeyDown } };
}

export function ChallengeWorkspace({ lessonSlug, challenge, onPassed }: { lessonSlug: string; challenge: Challenge; onPassed: () => void }) {
  const t = useT();
  const ctx = useLessonContext();
  const mode = ctx?.mode ?? "adventure";
  const code = ctx?.drafts[challenge.slug] ?? challenge.starter_code;
  const setCode = useCallback((c: string) => ctx?.setDraft(challenge.slug, c), [ctx, challenge.slug]);
  const [stdin, setStdin] = useState(challenge.visible_tests.find((x) => x.stdin)?.stdin ?? "");
  const [run, setRun] = useState<RunResult | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [busy, setBusy] = useState<"check" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"console" | "tests">("console");
  const [mobileTab, setMobileTab] = useState<"task" | "code" | "output" | "help">("code");
  const [showXray, setShowXray] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const python = usePython();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const editor = useResizable(mode === "focus" ? 420 : 300, 160, 900);
  const passed = ctx?.passed.has(challenge.slug) ?? false;
  const usesInput = /input\s*\(/.test(code) || challenge.visible_tests.some((x) => x.stdin);
  const assessment = challenge.tier === "transfer" || challenge.tier === "capstone";

  useEffect(() => setShowXray(false), [code]);

  async function runCode() {
    setPanel("console");
    setMobileTab("output");
    setRun(await python.run(code, { stdin }));
  }

  async function evaluate(kind: "check" | "submit") {
    setBusy(kind);
    setError(null);
    try {
      const r = await api<Evaluation>(`challenges/${challenge.slug}/${kind}`, { body: { code } });
      setEvaluation(r);
      setPanel("tests");
      setMobileTab("output");
      if (r.mode === "submit" && r.passed) {
        ctx?.markPassed(challenge.slug);
        onPassed();
        announceXp();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reach the grader.");
    } finally {
      setBusy(null);
    }
  }

  const task = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TIER[challenge.tier].tone}>{TIER[challenge.tier].label}</Badge>
        <Badge tone="gold">{challenge.xp} XP</Badge>
        {passed && <Badge tone="good"><Icon name="check" className="size-3.5" /> Passed</Badge>}
      </div>
      <h3 className="text-xl font-bold">{challenge.title}</h3>
      <Markdown text={challenge.prompt} className="text-ink-2" />
      {challenge.requirements.length > 0 && (
        <div>
          <p className="text-sm font-bold text-ink-3">Requirements</p>
          <ul className="mt-1 space-y-1 text-sm">
            {challenge.requirements.map((r) => <li key={r} className="flex gap-2"><span className="text-teal">◆</span>{r}</li>)}
          </ul>
        </div>
      )}
      {challenge.visible_tests.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Example test{challenge.visible_tests.length > 1 ? "s" : ""} ({challenge.visible_tests.length} visible, {challenge.hidden_test_count} hidden)</summary>
          <ul className="mt-2 space-y-2">
            {challenge.visible_tests.map((vt) => (
              <li key={vt.id} className="rounded-lg bg-paper-2 p-2">
                <p className="font-semibold">{vt.name}</p>
                {vt.stdin && <p className="font-mono text-xs">input: {vt.stdin.replaceAll("\n", " ⏎ ")}</p>}
                <pre className="whitespace-pre-wrap font-mono text-xs">{vt.expected_stdout ?? fmt(vt.expected_variables)}</pre>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );

  const output = (
    <div>
      <div className="mb-2 flex gap-1" role="tablist" aria-label="Output panels">
        {(["console", "tests"] as const).map((p) => (
          <button key={p} role="tab" aria-selected={panel === p} onClick={() => setPanel(p)}
            className={clsx("rounded-lg px-3 py-1.5 text-sm font-semibold", panel === p ? "bg-ink text-paper dark:bg-card dark:text-ink" : "text-ink-2 hover:bg-paper-2")}>
            {p === "console" ? t("run.console") : t("run.tests")}
            {p === "tests" && evaluation && <span className={clsx("ml-1.5 inline-block size-2 rounded-full", evaluation.passed ? "bg-good" : "bg-bad")} />}
          </button>
        ))}
      </div>
      {panel === "console" ? (
        <div role="tabpanel">
          <pre className="max-h-72 min-h-[5rem] overflow-auto rounded-xl bg-ink p-3 font-mono text-sm text-paper dark:bg-black/40 dark:text-ink" aria-live="polite">
            {run ? run.stdout || (run.error ? "" : "(the program printed nothing)") : t("run.noOutput")}
          </pre>
          {run?.error && (
            <div className="mt-2 rounded-xl border border-bad/30 bg-bad-soft p-3 text-sm" role="alert">
              <p className="font-mono font-bold text-bad">{run.error.type}: {run.error.message}{run.error.line ? ` — line ${run.error.line}` : ""}</p>
              {ERROR_GUIDE[run.error.type] && <p className="mt-1 text-ink-2">{ERROR_GUIDE[run.error.type]}</p>}
            </div>
          )}
          {run && <p className="mt-1 text-xs text-ink-3">Ran in your browser with Python (Pyodide) · {run.steps} steps · {run.durationMs} ms</p>}
        </div>
      ) : (
        <div role="tabpanel">{evaluation ? <Results ev={evaluation} /> : <p className="text-sm text-ink-3">Check visible tests or submit to see results here.</p>}</div>
      )}
      {evaluation?.mode === "submit" && evaluation.passed && evaluation.reward && <div className="mt-3"><RewardBanner reward={evaluation.reward} /></div>}
    </div>
  );

  const help = (
    <div className="space-y-3">
      <HintPanel lessonSlug={lessonSlug} challenge={challenge} />
      <NovaPanel lesson={lessonSlug} challenge={challenge.slug} code={code} output={run ? run.stdout + (run.error ? `\n${run.error.type}: ${run.error.message}` : "") : ""} assessment={assessment} />
    </div>
  );

  const editorBlock = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={runCode} loading={python.status === "running"} disabled={python.status === "loading"}>
          <Icon name="play" className="size-4" /> {t("run.run")}
        </Button>
        <Button tone="secondary" onClick={() => evaluate("check")} loading={busy === "check"} disabled={!!busy}>
          {t("run.check")}
        </Button>
        <Button tone="coral" onClick={() => evaluate("submit")} loading={busy === "submit"} disabled={!!busy}>
          <Icon name="check" className="size-4" /> {t("run.submit")}
        </Button>
        <Button tone="ghost" size="sm" onClick={() => setShowXray((s) => !s)}>
          <Icon name="eye" className="size-4" /> {showXray ? "Hide X-Ray" : "X-Ray this code"}
        </Button>
        <Button tone="ghost" size="sm" onClick={() => { if (confirm("Replace your code with the starter code?")) setCode(challenge.starter_code); }}>
          <Icon name="reset" className="size-4" /> {t("run.reset")}
        </Button>
        <span className="ml-auto text-xs text-ink-3" aria-live="polite">
          {python.status === "loading" ? t("run.loadingPython") : ctx?.saveState === "saving" ? t("run.saving") : ctx?.saveState === "saved" ? t("run.saved") : ctx?.saveState === "error" ? "Not saved — will retry" : ""}
        </span>
      </div>
      {python.loadError && <p className="text-sm text-bad">{t("run.pythonFailed")}: {python.loadError}. You can still submit — grading runs on the server.</p>}
      <CodeEditor label={`Code for ${challenge.title}`} value={code} onChange={setCode} height={editor.size} onRun={runCode}
        errorLine={run?.error?.line ?? null} />
      <div role="separator" aria-orientation="horizontal" aria-label="Resize editor" tabIndex={0} {...editor.handle}
        className="mx-auto h-2 w-16 cursor-row-resize touch-none rounded-full bg-line-strong hover:bg-teal" />
      {usesInput && (
        <label className="block">
          <span className="text-sm font-semibold text-ink-2">{t("run.input")}</span>
          <span className="ml-2 text-xs text-ink-3">{t("run.inputHelp")}</span>
          <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-line bg-paper-2 p-2 font-mono text-sm" />
        </label>
      )}
      {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
      {showXray && <CodeXRay key={code} code={code} stdin={stdin} editable={false} title="X-Ray of your code" height={180} />}
    </div>
  );

  // Mobile: tabs instead of squeezing panels. Only one layout is mounted at a time.
  if (!desktop) return (
    <div>
      <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-paper-2 p-1" role="tablist" aria-label="Workspace sections">
        {(["task", "code", "output", "help"] as const).map((tab) => (
          <button key={tab} role="tab" aria-selected={mobileTab === tab} onClick={() => setMobileTab(tab)}
            className={clsx("rounded-lg py-2 text-sm font-semibold capitalize", mobileTab === tab ? "bg-card shadow-card" : "text-ink-2")}>
            {tab}
          </button>
        ))}
      </div>
      {mobileTab === "task" && task}
      {mobileTab === "code" && editorBlock}
      {mobileTab === "output" && output}
      {mobileTab === "help" && help}
    </div>
  );

  if (mode === "focus") {
    return (
      <>
        <div className="grid gap-4" style={{ gridTemplateColumns: `${leftOpen ? "minmax(260px, 0.8fr)" : "44px"} minmax(0, 2fr) ${rightOpen ? "minmax(280px, 0.9fr)" : "44px"}` }}>
          <Panel open={leftOpen} toggle={() => setLeftOpen((o) => !o)} label="Instructions">{task}</Panel>
          <div className="min-w-0 space-y-4">
            {editorBlock}
            <div className="rounded-2xl border border-line bg-card p-3">{output}</div>
          </div>
          <Panel open={rightOpen} toggle={() => setRightOpen((o) => !o)} label="Help">{help}</Panel>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="@container space-y-5">
        <div className="grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            {task}
            {editorBlock}
            {output}
          </div>
          {help}
        </div>
      </div>
    </>
  );
}

function Panel({ open, toggle, label, children }: { open: boolean; toggle: () => void; label: string; children: ReactNode }) {
  return (
    <aside className="min-w-0 rounded-2xl border border-line bg-card" aria-label={label}>
      <button onClick={toggle} aria-expanded={open} className="flex w-full items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm font-semibold text-ink-2">
        {open && label}
        <Icon name="layout" className="size-4" />
        <span className="sr-only">{open ? `Collapse ${label}` : `Expand ${label}`}</span>
      </button>
      {open && <div className="max-h-[calc(100dvh-12rem)] overflow-auto p-4">{children}</div>}
    </aside>
  );
}
