"use client";

import clsx from "clsx";
import { useState } from "react";
import { Button, Icon, Markdown } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { ActivityResult, Block } from "@/lib/types";

type Predict = Extract<Block, { type: "predict" }>;
type Sequence = Extract<Block, { type: "sequence" }>;
type Reflection = Extract<Block, { type: "reflection" }>;

function useSubmit(lesson: string, blockId: string, onDone: (r: ActivityResult) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(response: unknown) {
    setBusy(true);
    setError(null);
    try {
      onDone(await api<ActivityResult>(`lessons/${lesson}/activities/${blockId}`, { body: { response } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your answer.");
    } finally {
      setBusy(false);
    }
  }
  return { submit, busy, error };
}

/** Predict-before-you-see. The answer key stays on the server until the learner commits to an answer. */
export function PredictBlock({ lesson, block, result, onResult }: { lesson: string; block: Predict; result?: ActivityResult; onResult: (r: ActivityResult) => void }) {
  const [choice, setChoice] = useState<string | null>((result?.response as string) ?? null);
  const { submit, busy, error } = useSubmit(lesson, block.id, onResult);
  const answered = !!result;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue">Predict</p>
      <Markdown text={block.question} className="mt-1 text-lg font-semibold" />
      {block.code && <pre className="mt-2 rounded-xl bg-paper-2 p-3 font-mono text-sm">{block.code}</pre>}
      <fieldset className="mt-4 space-y-2">
        <legend className="sr-only">Choose your prediction</legend>
        {block.options.map((o) => {
          const isAnswer = answered && result.answer === o.id;
          const isWrongPick = answered && result.response === o.id && !result.correct;
          return (
            <label key={o.id} className={clsx("flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition",
              isAnswer ? "border-good bg-good-soft" : isWrongPick ? "border-bad bg-bad-soft" : choice === o.id ? "border-blue bg-blue-soft" : "border-line hover:border-line-strong")}>
              <input type="radio" name={block.id} value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} className="size-4 accent-[var(--blue)]" />
              <span className="font-mono">{o.label}</span>
              {isAnswer && <Icon name="check" className="ml-auto text-good" />}
            </label>
          );
        })}
      </fieldset>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={() => choice && submit(choice)} disabled={!choice || (answered && result.response === choice)} loading={busy}>
          {answered ? "Try a different answer" : "Lock in my prediction"}
        </Button>
        {error && <span className="text-sm text-bad">{error}</span>}
      </div>
      {answered && (
        <div className={clsx("mt-4 rounded-xl p-4", result.correct ? "bg-good-soft" : "bg-warn-soft")} aria-live="polite">
          <p className={clsx("font-bold", result.correct ? "text-good" : "text-warn")}>{result.correct ? "Correct!" : "Not quite — and that's useful information."}</p>
          {result.explanation && <Markdown text={result.explanation} className="mt-1" />}
        </div>
      )}
    </div>
  );
}

/** Ordering activity. Reorder with buttons (keyboard and screen-reader friendly) — no drag-and-drop required. */
export function SequenceBlock({ lesson, block, result, onResult }: { lesson: string; block: Sequence; result?: ActivityResult; onResult: (r: ActivityResult) => void }) {
  const [order, setOrder] = useState<string[]>(() => (result?.response as string[]) ?? shuffle(block.items.map((i) => i.id), block.id));
  const { submit, busy, error } = useSubmit(lesson, block.id, onResult);
  const label = (id: string) => block.items.find((i) => i.id === id)?.label ?? id;
  const move = (i: number, d: number) => setOrder((o) => { const c = [...o]; const j = i + d; if (j < 0 || j >= c.length) return c; [c[i], c[j]] = [c[j], c[i]]; return c; });
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">Put in order</p>
      <p className="mt-1 text-lg font-semibold">{block.prompt}</p>
      <ol className="mt-4 space-y-2">
        {order.map((id, i) => {
          const right = result && Array.isArray(result.answer) && result.answer[i] === id && JSON.stringify(result.response) === JSON.stringify(order);
          return (
            <li key={id} className={clsx("flex items-center gap-2 rounded-xl border-2 bg-card px-3 py-2", right ? "border-good" : "border-line")}>
              <span className="grid size-7 place-items-center rounded-lg bg-paper-2 font-mono text-sm font-bold">{i + 1}</span>
              <span className="flex-1">{label(id)}</span>
              <button className="rounded-lg px-2 py-1 hover:bg-paper-2 disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move “${label(id)}” up`}>↑</button>
              <button className="rounded-lg px-2 py-1 hover:bg-paper-2 disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move “${label(id)}” down`}>↓</button>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={() => submit(order)} loading={busy}>{result ? "Check again" : "Check my order"}</Button>
        {error && <span className="text-sm text-bad">{error}</span>}
      </div>
      {result && (
        <div className={clsx("mt-4 rounded-xl p-4", result.correct ? "bg-good-soft" : "bg-warn-soft")} aria-live="polite">
          <p className={clsx("font-bold", result.correct ? "text-good" : "text-warn")}>{result.correct ? "That's the right order." : "Some steps are out of order. Look at which ones depend on others."}</p>
          {result.correct && result.explanation && <Markdown text={result.explanation} className="mt-1" />}
        </div>
      )}
    </div>
  );
}

export function ReflectionBlock({ lesson, block, result, onResult }: { lesson: string; block: Reflection; result?: ActivityResult; onResult: (r: ActivityResult) => void }) {
  const [text, setText] = useState((result?.response as string) ?? "");
  const { submit, busy, error } = useSubmit(lesson, block.id, onResult);
  const min = block.min_chars ?? 20;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet">Reflect</p>
      <label htmlFor={`r-${block.id}`} className="mt-1 block text-lg font-semibold">{block.prompt}</label>
      <textarea id={`r-${block.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={4000}
        className="mt-3 w-full rounded-xl border border-line-strong bg-card p-3" />
      <div className="mt-2 flex items-center gap-3">
        <Button onClick={() => submit(text)} loading={busy} disabled={text.trim().length < min}>{result ? "Update reflection" : "Save reflection"}</Button>
        <span className="text-sm text-ink-3">{text.trim().length}/{min} characters minimum</span>
        {result && <span className="text-sm text-good">Saved</span>}
      </div>
      {error && <p className="mt-1 text-sm text-bad">{error}</p>}
      <p className="mt-2 text-xs text-ink-3">Reflections are for you and your portfolio. They count as completed when saved — they aren&apos;t marked right or wrong.</p>
    </div>
  );
}

// Deterministic shuffle so the initial order is stable across renders but not the answer.
function shuffle(ids: string[], seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.every((x, i) => x === ids[i]) && a.length > 1) [a[0], a[1]] = [a[1], a[0]];
  return a;
}
