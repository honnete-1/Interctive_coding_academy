"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { Button, Icon } from "@/components/ui";
import { usePython } from "@/components/workspace/usePython";
import { ERROR_GUIDE, type RunResult, type TraceEvent, type VarInfo } from "@/lib/python/runtime";
import { VariableBoxes } from "./VariableBoxes";

function describeStep(ev: TraceEvent, prev: TraceEvent | undefined): string {
  const now = ev.stack[ev.stack.length - 1]?.vars ?? {};
  const before = prev?.stack[prev.stack.length - 1]?.vars ?? {};
  const created = Object.keys(now).filter((k) => !(k in before));
  const changed = Object.keys(now).filter((k) => k in before && before[k].repr !== now[k].repr);
  const parts: string[] = [];
  if (created.length) parts.push(`created ${created.map((k) => `${k} = ${now[k].repr}`).join(", ")}`);
  if (changed.length) parts.push(`changed ${changed.map((k) => `${k} from ${before[k].repr} to ${now[k].repr}`).join(", ")}`);
  if (prev && ev.out > prev.out) parts.push("printed output");
  const effect = parts.length ? `The previous line ${parts.join("; ")}.` : prev ? "The previous line didn't change any variable." : "";
  if (ev.event === "end") return `${effect} The program finished.`.trim();
  if (ev.event === "error") return `${effect} The program stopped with an error.`.trim();
  if (ev.event === "return") return `${effect} ${ev.func}() is returning ${ev.value?.repr}.`.trim();
  return `${effect} Next, Python will run line ${ev.line}.`.trim();
}

export interface XRayProps {
  code: string;
  editable?: boolean;
  stdin?: string;
  title?: string;
  prompt?: string;
  highlight?: string[];
  onResult?: (r: RunResult) => void;
  height?: number;
}

/**
 * Code X-Ray: runs real Python (Pyodide) with sys.settrace and lets the learner step forward/backward through
 * the recorded states. Nothing shown here is simulated — every state comes from the actual run.
 */
export function CodeXRay({ code: initial, editable = true, stdin: initialStdin = "", title, prompt, highlight, onResult, height = 220 }: XRayProps) {
  const [code, setCode] = useState(initial);
  const [stdin, setStdin] = useState(initialStdin);
  const [result, setResult] = useState<RunResult | null>(null);
  const [ranCode, setRanCode] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const { run, status, loadError } = usePython();
  const live = useRef<HTMLParagraphElement>(null);

  const trace = result?.trace ?? [];
  const ev = trace[idx];
  const prev = idx > 0 ? trace[idx - 1] : undefined;
  const frame = ev?.stack[ev.stack.length - 1];
  const prevFrame = prev?.stack[prev.stack.length - 1];
  const stale = result !== null && code !== ranCode;

  async function execute() {
    setPlaying(false);
    const r = await run(code, { stdin, trace: true, maxSteps: 20000 });
    setRanCode(code);
    setResult(r);
    setIdx(0);
    onResult?.(r);
  }

  useEffect(() => {
    if (!playing) return;
    if (idx >= trace.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIdx((i) => i + 1), speed);
    return () => clearTimeout(t);
  }, [playing, idx, trace.length, speed]);

  const explanation = useMemo(() => (ev ? describeStep(ev, prev) : ""), [ev, prev]);
  const output = result ? result.stdout.slice(0, ev ? ev.out : result.stdout.length) : "";
  const atEnd = ev && (ev.event === "end" || ev.event === "error");
  const varsNow: Record<string, VarInfo> = frame?.vars ?? {};

  return (
    <div className="@container rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Icon name="eye" className="size-5 text-teal" />
        <h3 className="font-bold">{title ?? "Code X-Ray"}</h3>
        <span className="text-xs text-ink-3">Real Python, recorded line by line</span>
      </div>
      {prompt && <p className="mb-3 text-ink-2">{prompt}</p>}
      <div className="grid gap-4 @3xl:grid-cols-[1.15fr_1fr]">
        <div className="space-y-2">
          <CodeEditor
            label="Code X-Ray editor"
            value={code}
            onChange={editable ? setCode : undefined}
            readOnly={!editable}
            height={height}
            highlightLine={stale ? null : ev?.event === "line" || ev?.event === "return" ? ev.line : null}
            errorLine={!stale && atEnd && result?.error?.line ? result.error.line : null}
            onRun={execute}
          />
          {/input\s*\(/.test(code) && (
            <label className="block">
              <span className="text-xs font-semibold text-ink-2">Input (one value per line)</span>
              <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-line bg-paper-2 p-2 font-mono text-sm" />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={execute} loading={status === "running"} disabled={status === "loading"}>
              <Icon name="play" className="size-4" /> {result ? "Run again" : "Run & record"}
            </Button>
            <Button tone="secondary" size="md" aria-label="Step back" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={!trace.length || idx === 0 || stale}>
              <Icon name="back" className="size-4" />
            </Button>
            <Button tone="secondary" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)} disabled={!trace.length || stale}>
              {playing ? "Pause" : "Play"}
            </Button>
            <Button tone="secondary" aria-label="Step forward" onClick={() => setIdx((i) => Math.min(trace.length - 1, i + 1))} disabled={!trace.length || idx >= trace.length - 1 || stale}>
              <Icon name="step" className="size-4" /> Step
            </Button>
            <label className="ml-auto flex items-center gap-2 text-xs text-ink-3">
              Speed
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-md border border-line bg-card px-1 py-0.5">
                <option value={1200}>Slow</option>
                <option value={700}>Normal</option>
                <option value={300}>Fast</option>
              </select>
            </label>
          </div>
          {status === "loading" && <p className="text-sm text-ink-3">Loading Python in your browser (first time only)…</p>}
          {loadError && <p className="text-sm text-bad">Python couldn&apos;t load: {loadError}</p>}
          {stale && <p className="text-sm text-warn">You edited the code. Run again to record the new version.</p>}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl bg-paper-2/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Variables {frame && frame.name !== "main program" ? `in ${frame.name}` : ""}</p>
              {trace.length > 0 && <p className="font-mono text-xs text-ink-3">step {idx + 1}/{trace.length}</p>}
            </div>
            <VariableBoxes vars={varsNow} previous={prevFrame?.vars} highlight={highlight} emptyText={result ? "No variables at this point." : "Press Run & record."} />
          </div>
          {ev && ev.stack.length > 1 && (
            <div className="rounded-xl bg-paper-2/70 p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-3">Call stack</p>
              <ol className="space-y-1 font-mono text-sm">
                {[...ev.stack].reverse().map((f, i) => (
                  <li key={i} className={clsx("rounded-md px-2 py-0.5", i === 0 ? "bg-gold-soft" : "")}>
                    {f.name} {f.line ? `· line ${f.line}` : ""}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <p ref={live} className="min-h-[2.5rem] rounded-xl border border-line px-3 py-2 text-sm" aria-live="polite">
            {explanation || "Each step shows the program's state just before the highlighted line runs."}
          </p>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-3">Output</p>
            <pre className="max-h-40 min-h-[3rem] overflow-auto rounded-xl bg-ink p-3 font-mono text-sm text-paper dark:bg-black/40 dark:text-ink">{output || " "}</pre>
          </div>
          {atEnd && result?.error && (
            <div className="rounded-xl border border-bad/30 bg-bad-soft p-3 text-sm" role="alert">
              <p className="font-mono font-bold text-bad">
                {result.error.type}: {result.error.message} {result.error.line ? `(line ${result.error.line})` : ""}
              </p>
              {ERROR_GUIDE[result.error.type] && <p className="mt-1 text-ink-2">{ERROR_GUIDE[result.error.type]}</p>}
            </div>
          )}
          {result?.truncated && <p className="text-xs text-ink-3">The recording was shortened because the program ran many steps.</p>}
        </div>
      </div>
    </div>
  );
}
