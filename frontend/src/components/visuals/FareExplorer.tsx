"use client";

import { useState } from "react";
import { Button, Icon } from "@/components/ui";
import { usePython } from "@/components/workspace/usePython";

interface Range { min: number; max: number; step?: number; default: number }
export interface FareConfig { distance: Range; rate: Range; currency?: string; disclaimer?: string }

/**
 * Fare explorer. The slider maths is a browser simulation and is labelled as such;
 * "Check with Python" runs the equivalent program in the real Python runtime and shows its actual output.
 */
export function FareExplorer({ config }: { config: FareConfig }) {
  const [distance, setDistance] = useState(config.distance.default);
  const [rate, setRate] = useState(config.rate.default);
  const [pyOut, setPyOut] = useState<{ for: string; text: string; ok: boolean } | null>(null);
  const { run, status } = usePython({ preload: false });
  const currency = config.currency ?? "RWF";
  const fare = distance * rate;
  const code = `distance = ${distance}\nrate = ${rate}\nfare = distance * rate\nprint(fare)`;
  const pct = (distance - config.distance.min) / (config.distance.max - config.distance.min || 1);

  async function verify() {
    const r = await run(code);
    setPyOut({ for: code, text: r.error ? `${r.error.type}: ${r.error.message}` : r.printed.trim(), ok: !r.error });
  }

  return (
    <div className="@container rounded-2xl border border-line bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Fare explorer</h3>
        <span className="rounded-full bg-paper-2 px-2 py-0.5 text-xs font-semibold text-ink-3">Browser simulation</span>
      </div>

      {/* road with the moto positioned by distance */}
      <div className="relative mt-5 h-16" aria-hidden="true">
        <div className="absolute inset-x-0 top-9 h-3 rounded-full bg-ink-2/80" />
        <div className="absolute top-9 h-3 rounded-full bg-teal transition-all duration-500" style={{ width: `${Math.max(4, pct * 100)}%` }} />
        <div className="absolute top-0 -translate-x-1/2 transition-all duration-500" style={{ left: `${Math.max(4, pct * 100)}%` }}>
          <Icon name="moto" className="size-9 text-coral" />
        </div>
        <span className="absolute -bottom-1 left-0 text-xs text-ink-3">Start</span>
        <span className="absolute -bottom-1 right-0 text-xs text-ink-3">{config.distance.max} km</span>
      </div>

      <div className="mt-5 grid gap-5 @lg:grid-cols-2">
        <label className="block">
          <span className="flex justify-between font-semibold">
            Distance <output className="font-mono text-teal">{distance} km</output>
          </span>
          <input type="range" className="mt-2 w-full accent-[var(--teal)]" min={config.distance.min} max={config.distance.max} step={config.distance.step ?? 1}
            value={distance} onChange={(e) => setDistance(Number(e.target.value))} aria-label="Distance in kilometres" />
        </label>
        <label className="block">
          <span className="flex justify-between font-semibold">
            Price per km <output className="font-mono text-gold">{rate} {currency}</output>
          </span>
          <input type="range" className="mt-2 w-full accent-[var(--gold)]" min={config.rate.min} max={config.rate.max} step={config.rate.step ?? 1}
            value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Price per kilometre" />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-paper-2/70 p-4 font-mono text-lg" aria-live="polite">
        <span className="rounded-lg bg-teal-soft px-2 py-1 text-teal">{distance}</span>
        <span>×</span>
        <span className="rounded-lg bg-gold-soft px-2 py-1 text-gold">{rate}</span>
        <span>=</span>
        <span className="rounded-lg bg-coral-soft px-3 py-1 text-xl font-bold text-coral">{fare.toLocaleString()} {currency}</span>
      </div>

      <div className="mt-4 grid gap-3 @lg:grid-cols-[1fr_auto] @lg:items-start">
        <pre className="overflow-auto rounded-xl bg-paper-2 p-3 font-mono text-sm">{code}</pre>
        <div className="space-y-2">
          <Button tone="secondary" onClick={verify} loading={status === "running" || status === "loading"}>
            <Icon name="play" className="size-4" /> Check with real Python
          </Button>
          {pyOut && (
            <p className="text-sm" aria-live="polite">
              {pyOut.for === code ? (
                <>Python printed: <b className="font-mono">{pyOut.text}</b> {pyOut.ok && Number(pyOut.text) === fare ? "✓ matches" : ""}</>
              ) : (
                <span className="text-ink-3">Values changed — check again.</span>
              )}
            </p>
          )}
        </div>
      </div>
      {config.disclaimer && <p className="mt-3 text-xs text-ink-3">{config.disclaimer}</p>}
    </div>
  );
}
