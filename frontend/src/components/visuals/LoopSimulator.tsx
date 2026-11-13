"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Button, Icon } from "@/components/ui";

interface Range { min: number; max: number; step?: number; default: number }
export interface LoopConfig { deliveries: Range; pay: Range; max_iterations?: number }

interface Frame { line: number; count: number; total: number; condition: boolean | null; note: string; delivered: number }

/**
 * Builds the step-by-step states of the delivery while-loop. With `forgetIncrement`, the counter never
 * changes and the run is cut off at `limit` iterations — the same safety idea the real runtime uses.
 */
export function buildFrames(n: number, pay: number, forgetIncrement: boolean, limit: number): { frames: Frame[]; stopped: boolean } {
  const frames: Frame[] = [];
  let count = 1;
  let total = 0;
  let delivered = 0;
  let iterations = 0;
  frames.push({ line: 1, count, total, condition: null, note: `count starts at 1, total at 0.`, delivered });
  while (true) {
    const cond = count <= n;
    frames.push({ line: 3, count, total, condition: cond, note: `Check: ${count} <= ${n} is ${cond ? "True — run the loop body" : "False — leave the loop"}.`, delivered });
    if (!cond) break;
    if (iterations >= limit) return { frames, stopped: true };
    iterations++;
    total += pay;
    delivered++;
    frames.push({ line: 4, count, total, condition: cond, note: `Delivery ${count}: total grows by ${pay} to ${total}.`, delivered });
    if (!forgetIncrement) {
      count += 1;
      frames.push({ line: 5, count, total, condition: cond, note: `count increases to ${count}.`, delivered });
    }
  }
  frames.push({ line: 6, count, total, condition: false, note: `Loop finished after ${delivered} deliveries. Total: ${total}.`, delivered });
  return { frames, stopped: false };
}

export function LoopSimulator({ config }: { config: LoopConfig }) {
  const [n, setN] = useState(config.deliveries.default);
  const [pay, setPay] = useState(config.pay.default);
  const [bug, setBug] = useState(false);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const limit = config.max_iterations ?? 25;
  const { frames, stopped } = useMemo(() => buildFrames(n, pay, bug, limit), [n, pay, bug, limit]);
  const f = frames[Math.min(i, frames.length - 1)];
  const atEnd = i >= frames.length - 1;

  useEffect(() => setI(0), [n, pay, bug]);
  useEffect(() => {
    if (!playing) return;
    if (atEnd) return setPlaying(false);
    const t = setTimeout(() => setI((x) => x + 1), 450);
    return () => clearTimeout(t);
  }, [playing, atEnd, i]);

  const code = [
    "count = 1",
    "total = 0",
    `while count <= ${n}:`,
    `    total = total + ${pay}`,
    bug ? "    # (forgot: count = count + 1)" : "    count = count + 1",
    'print("Total:", total)',
  ];
  const houses = Math.max(n, 1);

  return (
    <div className="@container rounded-2xl border border-line bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Loop simulator</h3>
        <span className="rounded-full bg-paper-2 px-2 py-0.5 text-xs font-semibold text-ink-3">Browser simulation of the code shown</span>
      </div>
      <div className="mt-4 grid gap-4 @xl:grid-cols-3">
        <label>
          <span className="font-semibold">Deliveries: <output className="font-mono">{n}</output></span>
          <input type="range" className="mt-2 w-full accent-[var(--coral)]" min={config.deliveries.min} max={config.deliveries.max} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Number of deliveries" />
        </label>
        <label>
          <span className="font-semibold">Pay each: <output className="font-mono">{pay}</output></span>
          <input type="range" className="mt-2 w-full accent-[var(--gold)]" min={config.pay.min} max={config.pay.max} step={config.pay.step ?? 1} value={pay} onChange={(e) => setPay(Number(e.target.value))} aria-label="Pay per delivery" />
        </label>
        <label className="flex items-center gap-2 self-end rounded-xl border border-line px-3 py-2">
          <input type="checkbox" checked={bug} onChange={(e) => setBug(e.target.checked)} className="size-4 accent-[var(--bad)]" />
          <span className="font-semibold">Bug: forget to count</span>
        </label>
      </div>

      {/* route */}
      <div className="mt-5 overflow-x-auto" aria-hidden="true">
        <div className="flex min-w-max items-end gap-3 rounded-xl bg-paper-2/70 px-4 py-3">
          {Array.from({ length: houses }, (_, h) => (
            <div key={h} className="flex flex-col items-center">
              <div className={clsx("grid size-11 place-items-center rounded-lg border-2", h < f.delivered ? "border-good bg-good-soft" : "border-line bg-card")}>
                {h < f.delivered ? <Icon name="check" className="size-5 text-good" /> : <Icon name="home" className="size-5 text-ink-3" />}
              </div>
              <span className="mt-1 font-mono text-xs">{h + 1}</span>
            </div>
          ))}
          {bug && f.delivered > houses && <span className="font-mono text-sm text-bad">+{f.delivered - houses} repeats of delivery {f.count}…</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-4 @2xl:grid-cols-2">
        <pre className="overflow-auto rounded-xl bg-paper-2 py-2 font-mono text-sm">
          {code.map((l, idx) => (
            <div key={idx} className={clsx("px-3", f.line === idx + 1 && "bg-gold-soft font-bold", bug && idx === 4 && "text-bad")}>{l}</div>
          ))}
        </pre>
        <div className="space-y-3">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-line p-2"><dt className="text-xs text-ink-3">count</dt><dd className="font-mono text-xl font-bold">{f.count}</dd></div>
            <div className="rounded-xl border border-line p-2"><dt className="text-xs text-ink-3">condition</dt><dd className={clsx("font-mono text-xl font-bold", f.condition === false && "text-bad", f.condition && "text-good")}>{f.condition === null ? "—" : String(f.condition)}</dd></div>
            <div className="rounded-xl border border-line p-2"><dt className="text-xs text-ink-3">total</dt><dd className="font-mono text-xl font-bold">{f.total}</dd></div>
          </dl>
          <p className="min-h-[2.5rem] rounded-xl border border-line px-3 py-2 text-sm" aria-live="polite">{f.note}</p>
          {stopped && atEnd && (
            <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-semibold text-bad" role="alert">
              Stopped after {limit} iterations: count never changes, so “count &lt;= {n}” stays True forever. This is an infinite loop.
            </p>
          )}
          <div className="flex gap-2">
            <Button tone="secondary" onClick={() => setI(0)} aria-label="Restart"><Icon name="reset" className="size-4" /></Button>
            <Button tone="secondary" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} aria-label="Step back"><Icon name="back" className="size-4" /></Button>
            <Button onClick={() => setI((x) => Math.min(frames.length - 1, x + 1))} disabled={atEnd}><Icon name="step" className="size-4" /> Step</Button>
            <Button tone="secondary" onClick={() => setPlaying((p) => !p)} disabled={atEnd}>{playing ? "Pause" : "Play"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
