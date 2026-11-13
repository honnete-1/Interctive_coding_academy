"use client";

import clsx from "clsx";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CodeXRay } from "@/components/visuals/CodeXRay";
import { FareExplorer } from "@/components/visuals/FareExplorer";
import { LogicPlayground } from "@/components/visuals/LogicPlayground";
import { LoopSimulator } from "@/components/visuals/LoopSimulator";
import { NovaPanel } from "@/components/workspace/NovaPanel";

const EXAMPLES: Record<string, { label: string; code: string; stdin?: string }> = {
  fare: { label: "Moto fare", code: 'distance = 4\nrate = 300\nservice_fee = 200\nfare = distance * rate + service_fee\nprint("Fare:", fare)' },
  decision: {
    label: "Mobile money check",
    code: 'balance = 3000\namount = int(input("Amount: "))\nif amount <= 0:\n    print("Invalid amount")\nelif amount > balance:\n    print("Insufficient balance")\nelse:\n    balance = balance - amount\n    print("Approved. New balance:", balance)',
    stdin: "1200",
  },
  loop: { label: "Delivery loop", code: 'total = 0\nfor delivery in range(1, 5):\n    total = total + 500\n    print("Delivery", delivery, "total", total)' },
  function: { label: "Functions & call stack", code: "def fare(distance, rate):\n    base = distance * rate\n    return base + 200\n\ntrip1 = fare(3, 300)\ntrip2 = fare(5, 250)\nprint(trip1 + trip2)" },
  list: { label: "Shopping list", code: 'basket = []\nbasket.append("rice")\nbasket.append("beans")\nbasket.append("avocado")\nbasket.remove("beans")\nprint(len(basket), basket)' },
};

const TABS = ["xray", "fare", "logic", "loop"] as const;
const TAB_LABEL = { xray: "Code X-Ray", fare: "Variables: fare explorer", logic: "Conditions: logic playground", loop: "Loops: loop simulator" };

export default function LabPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("xray");
  const [example, setExample] = useState("fare");
  return (
    <AppShell wide>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-extrabold">Visual Learning Lab</h1>
          <p className="mt-1 max-w-3xl text-ink-2">
            A free playground. Code X-Ray runs real Python in your browser and records every step: variables, call stack and output.
            It supports core Python (variables, conditions, loops, functions, lists, dictionaries). External packages aren&apos;t available, and
            recordings stop after 1,500 steps.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Visualizers">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={clsx("rounded-xl border-2 px-4 py-2 font-semibold", tab === t ? "border-teal bg-teal-soft" : "border-line bg-card")}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        {tab === "xray" && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink-3">Start from:</span>
                {Object.entries(EXAMPLES).map(([k, e]) => (
                  <button key={k} onClick={() => setExample(k)}
                    className={clsx("rounded-full border px-3 py-1 text-sm", example === k ? "border-ink bg-ink text-paper dark:bg-paper-2 dark:text-ink" : "border-line")}>
                    {e.label}
                  </button>
                ))}
              </div>
              <CodeXRay key={example} code={EXAMPLES[example].code} stdin={EXAMPLES[example].stdin} height={300} />
            </div>
            <NovaPanel />
          </div>
        )}
        {tab === "fare" && (
          <FareExplorer config={{ distance: { min: 1, max: 25, default: 6 }, rate: { min: 100, max: 1000, step: 50, default: 300 }, disclaimer: "Example rates for learning only — not official transport prices." }} />
        )}
        {tab === "logic" && (
          <LogicPlayground
            config={{
              inputs: [
                { name: "balance", label: "Balance (RWF)", min: 0, max: 20000, step: 500, default: 5000 },
                { name: "amount", label: "Amount (RWF)", min: -1000, max: 20000, step: 500, default: 6000 },
              ],
              branches: [
                { condition: { left: "amount", op: "<=", right: 0 }, result: "Invalid amount", tone: "warn" },
                { condition: { left: "amount", op: ">", right: { var: "balance" } }, result: "Insufficient balance", tone: "bad" },
              ],
              else: { result: "Approved", tone: "good" },
            }}
          />
        )}
        {tab === "loop" && <LoopSimulator config={{ deliveries: { min: 0, max: 10, default: 5 }, pay: { min: 100, max: 2000, step: 100, default: 600 }, max_iterations: 25 }} />}
      </div>
    </AppShell>
  );
}
