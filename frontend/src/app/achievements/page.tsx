"use client";

import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, ErrorState, Icon, PageLoader } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Achievement } from "@/lib/types";

function AchievementsInner() {
  const [items, setItems] = useState<Achievement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<Achievement[]>("achievements").then(setItems).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load achievements."));
  }, []);
  useEffect(load, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <PageLoader />;
  const earned = items.filter((a) => a.earned).length;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">Achievements</h1>
        <p className="mt-1 text-ink-2">
          {earned} of {items.length} earned. Each one is granted only when the server finds real evidence: passed tests or completed lessons.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <Card as="li" key={a.slug} className={clsx("flex gap-4 p-5", !a.earned && "opacity-75")}>
            <span className={clsx("grid size-14 shrink-0 place-items-center rounded-2xl", a.earned ? "bg-gold text-white dark:text-paper" : "bg-paper-2 text-ink-3")}>
              <Icon name={a.earned ? a.icon : "lock"} className="size-7" />
            </span>
            <div>
              <p className="font-bold">{a.title}</p>
              <p className="text-sm text-ink-2">{a.description}</p>
              <p className="mt-1 text-xs text-ink-3">
                {a.earned ? `Earned ${new Date(a.earned_at!).toLocaleDateString()}` : `How: ${a.criteria}`} · +{a.xp} XP
              </p>
            </div>
          </Card>
        ))}
      </ul>
      <section id="rules" className="scroll-mt-20">
        <h2 className="text-xl font-bold">How XP and levels work</h2>
        <Card className="mt-3 p-5 text-ink-2">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><b>Passing a challenge</b> for the first time awards its XP. Re-submitting never awards it again.</li>
            <li><b>Solving without hints</b> adds a 20% independence bonus on that first pass.</li>
            <li><b>Completing a lesson</b> awards its XP once, after every required activity is done and verified by the server.</li>
            <li><b>Achievements</b> each add their XP once.</li>
            <li>Running code, checking visible tests and opening lessons don&apos;t award XP, so practise as much as you like.</li>
            <li>Level <i>L</i> starts at 50 × <i>L</i> × (<i>L</i> − 1) XP: level 2 at 100, level 3 at 300, level 4 at 600, level 5 at 1000.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}

export default function AchievementsPage() {
  return (
    <AppShell>
      <AchievementsInner />
    </AppShell>
  );
}
