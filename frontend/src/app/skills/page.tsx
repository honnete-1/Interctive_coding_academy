"use client";

import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, Card, EmptyState, ErrorState, MASTERY_LABEL, PageLoader, SectionTitle } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { LevelInfo, SkillState, Streak } from "@/lib/types";

interface Analytics {
  streak: Streak;
  level: LevelInfo;
  skills: SkillState[];
  history: { challenge: string; passed: boolean; score: number; created_at: string; hint_level: number }[];
  lessons_completed: { slug: string; title: string; completed_at: string; assessment: Record<string, number | string | null> }[];
}

const LEVELS = ["exploring", "practising", "developing", "proficient", "mastered"];

function SkillsInner() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<Analytics>("analytics").then(setData).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load analytics."));
  }, []);
  useEffect(load, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <PageLoader />;
  const practise = data.skills.filter((s) => ["exploring", "practising", "developing"].includes(s.level));
  const strong = data.skills.filter((s) => ["proficient", "mastered"].includes(s.level));
  const stats: [string, number][] = [
    ["Level", data.level.level],
    ["Total XP", data.level.xp],
    ["Lessons completed", data.lessons_completed.length],
    ["Active days (last 7)", data.streak.active_days_last_7],
  ];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">Skills &amp; progress</h1>
        <p className="mt-1 max-w-3xl text-ink-2">
          Mastery is earned from evidence: passing challenges (projects, transfers and capstones count more), applying a skill to a new problem,
          and solving without hints. Opening a lesson never makes you &ldquo;proficient&rdquo; on its own.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <Card key={k} className="p-4">
            <p className="text-sm text-ink-3">{k}</p>
            <p className="font-display text-3xl font-extrabold">{v}</p>
          </Card>
        ))}
      </section>

      <section>
        <SectionTitle eyebrow="Evidence-based" title="Skill mastery" />
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Mastery level for each skill</caption>
            <thead className="border-b border-line text-ink-3">
              <tr>
                <th className="p-3">Skill</th>
                {LEVELS.map((l) => <th key={l} className="p-3">{MASTERY_LABEL[l].label}</th>)}
                <th className="p-3">Evidence points</th>
              </tr>
            </thead>
            <tbody>
              {data.skills.map((s) => {
                const step = MASTERY_LABEL[s.level].step;
                return (
                  <tr key={s.slug} className="border-b border-line last:border-0">
                    <th className="p-3 font-semibold">
                      {s.name}
                      <span className="block font-normal text-ink-3">{s.description}</span>
                    </th>
                    {LEVELS.map((l, i) => (
                      <td key={l} className="p-3">
                        <span className={clsx("block h-3 rounded-full", i < step ? "bg-teal" : "bg-paper-2")} />
                        <span className="sr-only">{i < step ? "reached" : "not yet"}</span>
                      </td>
                    ))}
                    <td className="p-3 font-mono">{s.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="font-bold">Strong</p>
            <p className="text-ink-2">{strong.length ? strong.map((s) => s.name).join(", ") : "Nothing at Proficient yet. Transfer challenges get you there."}</p>
          </Card>
          <Card className="p-4">
            <p className="font-bold">Worth practising</p>
            <p className="text-ink-2">{practise.length ? practise.map((s) => s.name).join(", ") : "Start a lesson to begin building skills."}</p>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle title="Assessment history" />
          <Card className="p-4">
            {data.history.length === 0 ? (
              <EmptyState title="No submissions yet">Submit a challenge to see your history.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {data.history.map((h, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {h.challenge}
                      <span className="block text-xs text-ink-3">{new Date(h.created_at).toLocaleString()} · hint levels opened: {h.hint_level}</span>
                    </span>
                    <Badge tone={h.passed ? "good" : "bad"}>{h.passed ? `passed · ${h.score}` : "not yet"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div>
          <SectionTitle title="Lesson reports" />
          <Card className="p-4">
            {data.lessons_completed.length === 0 ? (
              <p className="text-ink-2">Complete a lesson to get a report across correctness, understanding, independence, quality and reflection.</p>
            ) : (
              <ul className="space-y-3">
                {data.lessons_completed.map((l) => (
                  <li key={l.slug}>
                    <p className="font-semibold">{l.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {Object.entries(l.assessment)
                        .filter(([k, v]) => k !== "note" && v !== null)
                        .map(([k, v]) => (
                          <Badge key={k}>{k.replaceAll("_", " ")} {Math.round(Number(v) * 100)}%</Badge>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

export default function SkillsPage() {
  return (
    <AppShell>
      <SkillsInner />
    </AppShell>
  );
}
