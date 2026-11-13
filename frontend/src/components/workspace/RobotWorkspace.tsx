"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Icon } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { announceXp } from "@/lib/progress";
import { countBlocks, simulate, toPython } from "@/lib/robot";
import type { Challenge, Evaluation, RobotBlock, RobotCmd, RobotResult } from "@/lib/types";
import { RewardBanner } from "./RewardBanner";
import { HintPanel } from "./HintPanel";

const LABEL: Record<RobotCmd, string> = { forward: "Forward", left: "Turn left", right: "Turn right", pick: "Pick up", drop: "Drop off", repeat: "Repeat" };
const CMD_TONE: Record<RobotCmd, string> = {
  forward: "bg-teal-soft text-teal border-teal/30", left: "bg-blue-soft text-blue border-blue/30", right: "bg-blue-soft text-blue border-blue/30",
  pick: "bg-gold-soft text-gold border-gold/30", drop: "bg-coral-soft text-coral border-coral/30", repeat: "bg-violet-soft text-violet border-violet/30",
};
const ARROW = { N: "rotate-[-90deg]", E: "", S: "rotate-90", W: "rotate-180" };

function Grid({ challenge, step }: { challenge: Challenge; step: RobotResult["trace"][number] | null }) {
  const grid = challenge.spec.grid;
  const start = (() => { for (let y = 0; y < grid.length; y++) { const x = grid[y].indexOf("S"); if (x >= 0) return { x, y }; } return { x: 0, y: 0 }; })();
  const pos = step ?? { x: start.x, y: start.y, facing: challenge.spec.facing ?? "E", carrying: false, delivered: false, ok: true, action: "start" };
  return (
    <div className="inline-grid gap-1 rounded-xl bg-paper-2 p-2" style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 3.25rem))` }} role="img"
      aria-label={`Map ${grid[0].length} by ${grid.length}. Robot at column ${pos.x + 1}, row ${pos.y + 1}, facing ${pos.facing}${pos.carrying ? ", carrying the package" : ""}${pos.delivered ? ", package delivered" : ""}.`}>
      {grid.flatMap((row, y) =>
        row.split("").map((cell, x) => {
          const here = pos.x === x && pos.y === y;
          const crashed = here && step?.ok === false;
          return (
            <div key={`${x}-${y}`} className={clsx("relative grid aspect-square place-items-center rounded-lg text-xl",
              cell === "#" ? "bg-ink-2/70" : "bg-card", crashed && "ring-4 ring-bad")}>
              {cell === "#" && <span aria-hidden>🧱</span>}
              {cell === "P" && !(pos.carrying || pos.delivered) && <span aria-hidden>📦</span>}
              {cell === "D" && <span aria-hidden className={pos.delivered ? "" : "opacity-80"}>{pos.delivered ? "✅" : "🏠"}</span>}
              {here && (
                <span className={clsx("absolute grid size-9 place-items-center rounded-xl bg-teal text-white shadow-card transition-transform duration-300 dark:text-paper", ARROW[pos.facing])}>
                  <Icon name="arrow" className="size-5" />
                </span>
              )}
              {here && pos.carrying && <span className="absolute -right-1 -top-1 text-sm" aria-hidden>📦</span>}
            </div>
          );
        }),
      )}
    </div>
  );
}

export function RobotWorkspace({ lessonSlug, challenge, passedBefore, onPassed }: { lessonSlug: string; challenge: Challenge; passedBefore: boolean; onPassed: () => void }) {
  const allowed = (challenge.spec.allowed ?? ["forward", "left", "right", "pick", "drop", "repeat"]) as RobotCmd[];
  const [program, setProgram] = useState<RobotBlock[]>(() => challenge.spec.starter_program ?? []);
  const [target, setTarget] = useState<number | null>(null); // index of the repeat block that receives new blocks
  const [preview, setPreview] = useState<RobotResult | null>(null);
  const [frame, setFrame] = useState(0);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const blocks = countBlocks(program);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const add = (cmd: RobotCmd) => {
    const block: RobotBlock = cmd === "repeat" ? { cmd, times: 2, body: [] } : { cmd };
    setPreview(null);
    if (target !== null && program[target]?.cmd === "repeat" && cmd !== "repeat") {
      setProgram((p) => p.map((b, i) => (i === target ? { ...b, body: [...(b.body ?? []), block] } : b)));
    } else {
      setProgram((p) => [...p, block]);
      if (cmd === "repeat") setTarget(program.length);
    }
  };
  const update = (fn: (p: RobotBlock[]) => RobotBlock[]) => { setPreview(null); setProgram(fn); };
  const move = (i: number, d: number) => update((p) => { const c = [...p]; const j = i + d; if (j < 0 || j >= c.length) return c; [c[i], c[j]] = [c[j], c[i]]; return c; });

  function animate(result: RobotResult) {
    if (timer.current) clearInterval(timer.current);
    setPreview(result);
    setFrame(0);
    let k = 0;
    timer.current = setInterval(() => {
      k++;
      if (k >= result.trace.length) { clearInterval(timer.current!); return; }
      setFrame(k);
    }, 380);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<Evaluation>(`challenges/${challenge.slug}/submit`, { body: { program } });
      setEvaluation(r);
      if (r.robot) animate(r.robot);
      if (r.passed) { onPassed(); announceXp(); }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  const step = preview ? preview.trace[Math.min(frame, preview.trace.length - 1)] : null;
  const finished = preview && frame >= preview.trace.length - 1;

  return (
    <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
      <div className="space-y-3">
        <Grid challenge={challenge} step={step} />
        {finished && preview && (
          <p className={clsx("max-w-xs rounded-xl px-3 py-2 text-sm font-semibold", preview.success ? "bg-good-soft text-good" : "bg-bad-soft text-bad")} aria-live="polite">
            {preview.message}
          </p>
        )}
        <details className="max-w-xs rounded-xl border border-line p-3 text-sm">
          <summary className="cursor-pointer font-semibold">See it as Python</summary>
          <pre className="mt-2 overflow-auto font-mono text-xs">{program.length ? toPython(program) : "# add blocks to see the code"}</pre>
        </details>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-2">Add a block {target !== null && program[target]?.cmd === "repeat" ? <>(inside <b>Repeat {target + 1}</b> — <button className="underline" onClick={() => setTarget(null)}>add to main program instead</button>)</> : ""}</p>
          <div className="flex flex-wrap gap-2">
            {allowed.map((cmd) => (
              <button key={cmd} onClick={() => add(cmd)} className={clsx("rounded-xl border-2 px-3 py-2 font-semibold transition hover:-translate-y-0.5", CMD_TONE[cmd])}>
                + {LABEL[cmd]}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-paper-2/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Program</p>
            <span className="text-sm text-ink-3">{blocks} block{blocks === 1 ? "" : "s"}{challenge.spec.max_blocks ? ` / max ${challenge.spec.max_blocks}` : ""}</span>
          </div>
          {program.length === 0 ? (
            <p className="text-sm text-ink-3">Click blocks above to build your program.</p>
          ) : (
            <ol className="space-y-1.5">
              {program.map((b, i) => (
                <li key={i} className={clsx("rounded-lg border-2", CMD_TONE[b.cmd], target === i && "ring-2 ring-violet")}>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span className="w-6 text-right font-mono text-xs opacity-70">{i + 1}</span>
                    <span className="flex-1 font-semibold">{LABEL[b.cmd]}</span>
                    {b.cmd === "repeat" && (
                      <>
                        <label className="flex items-center gap-1 text-sm">
                          times
                          <input type="number" min={1} max={20} value={b.times} aria-label={`Repeat ${i + 1} count`}
                            onChange={(e) => update((p) => p.map((x, j) => (j === i ? { ...x, times: Math.max(1, Math.min(20, Number(e.target.value) || 1)) } : x)))}
                            className="h-7 w-14 rounded-md border border-line bg-card px-1 text-center font-mono" />
                        </label>
                        <button className="rounded px-1 text-xs underline" onClick={() => setTarget(target === i ? null : i)}>{target === i ? "done" : "add inside"}</button>
                      </>
                    )}
                    <button aria-label={`Move block ${i + 1} up`} className="rounded px-1 hover:bg-card" onClick={() => move(i, -1)}>↑</button>
                    <button aria-label={`Move block ${i + 1} down`} className="rounded px-1 hover:bg-card" onClick={() => move(i, 1)}>↓</button>
                    <button aria-label={`Remove block ${i + 1}`} className="rounded px-1 hover:bg-card" onClick={() => { update((p) => p.filter((_, j) => j !== i)); if (target === i) setTarget(null); }}>✕</button>
                  </div>
                  {b.cmd === "repeat" && (
                    <ol className="ml-8 space-y-1 pb-2 pr-2">
                      {(b.body ?? []).length === 0 && <li className="text-xs opacity-70">empty — choose “add inside”, then click blocks</li>}
                      {(b.body ?? []).map((inner, k) => (
                        <li key={k} className={clsx("flex items-center gap-2 rounded-md border px-2 py-0.5 text-sm", CMD_TONE[inner.cmd])}>
                          <span className="flex-1 font-semibold">{LABEL[inner.cmd]}</span>
                          <button aria-label={`Remove inner block ${k + 1}`} onClick={() => update((p) => p.map((x, j) => (j === i ? { ...x, body: (x.body ?? []).filter((_, m) => m !== k) } : x)))}>✕</button>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button tone="secondary" onClick={() => animate(simulate(challenge.spec, program))} disabled={!program.length}>
            <Icon name="play" className="size-4" /> Test run
          </Button>
          <Button onClick={submit} loading={busy} disabled={!program.length}>
            <Icon name="check" className="size-4" /> Submit
          </Button>
          <Button tone="ghost" onClick={() => { update(() => challenge.spec.starter_program ?? []); setTarget(null); }}>
            <Icon name="reset" className="size-4" /> Reset
          </Button>
          {passedBefore && <Badge tone="good">Passed</Badge>}
        </div>
        {error && <p role="alert" className="text-bad">{error}</p>}
        {evaluation && !evaluation.passed && evaluation.robot && (
          <p className="text-sm text-ink-2">Not delivered yet — the failed step is highlighted on the map. Every attempt is information.</p>
        )}
        {evaluation?.passed && evaluation.reward && <RewardBanner reward={evaluation.reward} />}
        <HintPanel lessonSlug={lessonSlug} challenge={challenge} />
      </div>
    </div>
  );
}
