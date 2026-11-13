"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { usePython } from "@/components/workspace/usePython";

type Operand = number | { var: string };
interface Condition { left: string; op: "<" | "<=" | ">" | ">=" | "==" | "!="; right: Operand }
interface Branch { condition: Condition; result: string; tone?: "good" | "bad" | "warn" }
interface InputDef { name: string; label: string; min: number; max: number; step?: number; default: number }
export interface LogicConfig { inputs: InputDef[]; branches: Branch[]; else: { result: string; tone?: "good" | "bad" | "warn" } }

const OPS: Record<Condition["op"], (a: number, b: number) => boolean> = {
  "<": (a, b) => a < b, "<=": (a, b) => a <= b, ">": (a, b) => a > b, ">=": (a, b) => a >= b, "==": (a, b) => a === b, "!=": (a, b) => a !== b,
};
const toneClass = { good: "border-good bg-good-soft text-good", bad: "border-bad bg-bad-soft text-bad", warn: "border-warn bg-warn-soft text-warn" };

const rhs = (r: Operand) => (typeof r === "number" ? String(r) : r.var);
export const conditionText = (c: Condition) => `${c.left} ${c.op} ${rhs(c.right)}`;

export function evaluate(config: LogicConfig, values: Record<string, number>) {
  const checks: { text: string; value: boolean }[] = [];
  for (let i = 0; i < config.branches.length; i++) {
    const b = config.branches[i];
    const right = typeof b.condition.right === "number" ? b.condition.right : values[b.condition.right.var];
    const value = OPS[b.condition.op](values[b.condition.left], right);
    checks.push({ text: conditionText(b.condition), value });
    if (value) return { taken: i, checks };
  }
  return { taken: config.branches.length, checks };
}

export function toPython(config: LogicConfig, values: Record<string, number>) {
  const lines = config.inputs.map((i) => `${i.name} = ${values[i.name]}`);
  config.branches.forEach((b, i) => {
    lines.push(`${i === 0 ? "if" : "elif"} ${conditionText(b.condition)}:`);
    lines.push(`    print("${b.result}")`);
  });
  lines.push("else:", `    print("${config.else.result}")`);
  return lines.join("\n");
}

/**
 * Decision playground: change inputs, predict the branch, then reveal. The decision is computed in the browser
 * from the same rules, and "Verify with Python" runs the generated program in the real runtime.
 */
export function LogicPlayground({ config }: { config: LogicConfig }) {
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(config.inputs.map((i) => [i.name, i.default])));
  const [prediction, setPrediction] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [py, setPy] = useState<{ code: string; out: string } | null>(null);
  const { run, status } = usePython({ preload: false });
  const outcome = useMemo(() => evaluate(config, values), [config, values]);
  const code = toPython(config, values);
  const results = [...config.branches.map((b) => b), config.else];
  const codeLines = code.split("\n");
  const activeLine = config.inputs.length + (outcome.taken < config.branches.length ? outcome.taken * 2 + 1 : config.branches.length * 2 + 1) + 1;

  const change = (name: string, v: number) => {
    setValues((s) => ({ ...s, [name]: v }));
    setRevealed(false);
    setPrediction(null);
  };

  return (
    <div className="@container rounded-2xl border border-line bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Logic playground</h3>
        <span className="rounded-full bg-paper-2 px-2 py-0.5 text-xs font-semibold text-ink-3">Browser simulation · verify with Python</span>
      </div>
      <div className="mt-4 grid gap-4 @lg:grid-cols-2">
        {config.inputs.map((i) => (
          <label key={i.name} className="block">
            <span className="flex justify-between font-semibold">
              {i.label} <output className="font-mono">{values[i.name]}</output>
            </span>
            <input type="range" min={i.min} max={i.max} step={i.step ?? 1} value={values[i.name]} onChange={(e) => change(i.name, Number(e.target.value))} className="mt-2 w-full accent-[var(--blue)]" aria-label={i.label} />
            <input type="number" value={values[i.name]} onChange={(e) => change(i.name, Number(e.target.value))} className="mt-1 h-8 w-28 rounded-md border border-line bg-paper-2 px-2 font-mono text-sm" aria-label={`${i.label} exact value`} />
          </label>
        ))}
      </div>

      <fieldset className="mt-5">
        <legend className="font-semibold">Predict first: which message will the program print?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {results.map((r, i) => (
            <button key={r.result} aria-pressed={prediction === i} onClick={() => { setPrediction(i); setRevealed(false); }}
              className={clsx("rounded-xl border-2 px-3 py-1.5 font-semibold", prediction === i ? "border-blue bg-blue-soft" : "border-line")}>
              {r.result}
            </button>
          ))}
          <Button tone="secondary" size="sm" className="h-auto" onClick={() => setRevealed(true)} disabled={prediction === null}>
            Reveal
          </Button>
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 @2xl:grid-cols-2">
        {/* decision path */}
        <ol className="space-y-2" aria-label="Decision path">
          {config.branches.map((b, i) => {
            const check = outcome.checks[i];
            const reached = revealed && i <= outcome.taken && check;
            return (
              <li key={i} className="flex items-stretch gap-2">
                <div className={clsx("flex-1 rounded-xl border-2 px-3 py-2 font-mono text-sm", reached ? (check.value ? "border-blue bg-blue-soft" : "border-line bg-paper-2") : "border-dashed border-line")}>
                  {i === 0 ? "if" : "elif"} {conditionText(b.condition)}
                  {reached && <span className="ml-2 font-bold">→ {String(check.value)}</span>}
                </div>
                <div className={clsx("grid w-40 place-items-center rounded-xl border-2 px-2 text-center text-sm font-semibold",
                  revealed && outcome.taken === i ? toneClass[b.tone ?? "good"] : "border-line text-ink-3")}>
                  {b.result}
                </div>
              </li>
            );
          })}
          <li className="flex items-stretch gap-2">
            <div className="flex-1 rounded-xl border-2 border-dashed border-line px-3 py-2 font-mono text-sm">else</div>
            <div className={clsx("grid w-40 place-items-center rounded-xl border-2 px-2 text-center text-sm font-semibold",
              revealed && outcome.taken === config.branches.length ? toneClass[config.else.tone ?? "good"] : "border-line text-ink-3")}>
              {config.else.result}
            </div>
          </li>
        </ol>
        <div>
          <pre className="overflow-auto rounded-xl bg-paper-2 py-2 font-mono text-sm">
            {codeLines.map((l, i) => (
              <div key={i} className={clsx("px-3", revealed && i + 1 === activeLine && "bg-gold-soft font-bold")}>{l || " "}</div>
            ))}
          </pre>
          <div className="mt-2 flex items-center gap-3">
            <Button tone="secondary" size="sm" loading={status === "running" || status === "loading"} onClick={async () => {
              const r = await run(code);
              setPy({ code, out: r.error ? `${r.error.type}: ${r.error.message}` : r.printed.trim() });
            }}>
              <Icon name="play" className="size-4" /> Verify with Python
            </Button>
            {py && <span className="text-sm">{py.code === code ? <>Python printed <b>{py.out}</b></> : <span className="text-ink-3">Inputs changed — verify again.</span>}</span>}
          </div>
        </div>
      </div>

      {revealed && prediction !== null && (
        <p className={clsx("mt-4 rounded-xl px-3 py-2 font-semibold", prediction === outcome.taken ? "bg-good-soft text-good" : "bg-warn-soft text-warn")} aria-live="polite">
          {prediction === outcome.taken
            ? "Your prediction was right."
            : `Not quite — Python checks conditions from top to bottom and runs the first one that is True. Look at which check turned True first.`}
        </p>
      )}
    </div>
  );
}
