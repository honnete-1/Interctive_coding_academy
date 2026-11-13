"use client";

import clsx from "clsx";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar } from "@/components/layout/Avatar";
import { WorldHeader, WorldTrail } from "@/components/layout/WorldMap";
import { Badge, ButtonLink, Card, EmptyState, ErrorState, Icon, MASTERY_LABEL, PageLoader, ProgressBar, SectionTitle } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Dashboard } from "@/lib/types";

function DashboardInner() {
  const { user } = useAuth();
  const params = useSearchParams();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<Dashboard>("dashboard").then(setData).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load your dashboard."));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data || !user) return <PageLoader label="Loading your home base…" />;

  const current = data.worlds.find((w) => w.slug === data.current_world) ?? data.worlds[0];
  const skillsInPlay = data.skills.filter((s) => s.level !== "not_started");
  const mastered = data.skills.filter((s) => ["proficient", "mastered"].includes(s.level));
  const welcome = params.get("welcome") === "1";

  return (
    <div className="space-y-8">
      {/* Hero: who you are, where you are, what's next */}
      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="relative overflow-hidden p-6">
          <div className="flex items-center gap-4">
            <Avatar avatar={data.profile.avatar} name={data.profile.display_name} size={64} />
            <div>
              <p className="text-sm font-semibold text-ink-3">{welcome ? "Welcome to CodeVerse" : "Welcome back"}</p>
              <h1 className="text-2xl font-extrabold sm:text-3xl">{data.profile.display_name}</h1>
            </div>
          </div>
          {data.continue ? (
            <div className="mt-6 rounded-2xl border border-line bg-paper-2/60 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                {data.continue.world} · {data.continue.module}
              </p>
              <h2 className="mt-1 text-xl font-bold">{data.continue.title}</h2>
              <p className="mt-1 text-ink-2">{data.continue.summary}</p>
              <ButtonLink href={`/learn/${data.continue.slug}`} size="lg" className="mt-4">
                <Icon name="play" /> Continue learning
              </ButtonLink>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-line bg-good-soft p-5">
              <h2 className="text-xl font-bold">You&apos;ve completed every available lesson!</h2>
              <p className="mt-1 text-ink-2">New worlds are being built. Meanwhile, experiment freely in the Visual Lab.</p>
              <ButtonLink href="/lab" className="mt-3">Open the Visual Lab</ButtonLink>
            </div>
          )}
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-ink-2">Level {data.level.level}</p>
              <p className="font-mono text-sm text-ink-3">
                {data.level.xp} / {data.level.next_level_at} XP
              </p>
            </div>
            <ProgressBar className="mt-3" value={data.level.progress} label="Progress to next level" tone="gold" />
            <p className="mt-2 text-sm text-ink-3">
              XP comes only from verified work: passed tests, completed lessons, earned achievements.{" "}
              <Link href="/achievements#rules" className="underline">How XP works</Link>
            </p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Icon name="flame" className="size-5 text-coral" />
              <p className="font-semibold">
                {data.streak.current > 0 ? `${data.streak.current}-day streak` : "Start a streak today"}
              </p>
            </div>
            <ol className="mt-3 flex justify-between" aria-label="Activity in the last 7 days">
              {data.streak.week.map((d) => (
                <li key={d.date} className="flex flex-col items-center gap-1">
                  <span className={clsx("size-7 rounded-lg", d.active ? "bg-coral" : "bg-paper-2")} aria-label={`${d.date}: ${d.active ? "active" : "no activity"}`} />
                  <span className="text-[0.7rem] text-ink-3">{new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-sm text-ink-3">Breaks are fine — nothing is lost when you miss a day.</p>
          </Card>
        </div>
      </section>

      {/* Adventure map: current world */}
      {current && (
        <section>
          <SectionTitle eyebrow="Adventure map" title="Your current world" action={<ButtonLink href="/map" tone="ghost" size="sm">All worlds <Icon name="arrow" className="size-4" /></ButtonLink>} />
          <Card className="space-y-4 p-5">
            <WorldHeader world={current} />
            <WorldTrail world={current} highlight={data.continue?.slug} />
          </Card>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle eyebrow="Mastery" title="Skills" action={<ButtonLink href="/skills" tone="ghost" size="sm">Details</ButtonLink>} />
          <Card className="p-5">
            {skillsInPlay.length === 0 ? (
              <EmptyState title="No skills yet" icon={<Icon name="spark" className="size-8" />}>
                Skills appear here as you practise. Mastery is based on evidence — passed challenges and transfer tasks — not just lessons opened.
              </EmptyState>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {skillsInPlay.map((s) => {
                  const m = MASTERY_LABEL[s.level];
                  return (
                    <li key={s.slug} className="rounded-xl border border-line p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{s.name}</span>
                        <Badge tone={m.tone}>{m.label}</Badge>
                      </div>
                      <div className="mt-2 flex gap-1" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span key={i} className={clsx("h-1.5 flex-1 rounded-full", i <= m.step ? "bg-teal" : "bg-paper-2")} />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {mastered.length > 0 && <p className="mt-3 text-sm text-ink-3">{mastered.length} skill(s) at Proficient or above.</p>}
          </Card>
        </div>

        <div>
          <SectionTitle eyebrow="Next steps" title="Recommended" />
          <Card as="div" className="divide-y divide-line">
            {data.recommendations.map((r) => (
              <Link key={r.title} href={r.href} className="block p-4 hover:bg-paper-2/60">
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-ink-3">{r.reason}</p>
              </Link>
            ))}
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div>
          <SectionTitle eyebrow="Recent" title="Achievements" action={<ButtonLink href="/achievements" tone="ghost" size="sm">All</ButtonLink>} />
          <Card className="p-4">
            {data.recent_achievements.length === 0 ? (
              <p className="text-ink-2">Your first achievement is one mission away. Each one is tied to real evidence.</p>
            ) : (
              <ul className="space-y-2">
                {data.recent_achievements.map((a) => (
                  <li key={a.slug} className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-gold-soft text-gold">
                      <Icon name={a.icon} />
                    </span>
                    <span className="font-semibold">{a.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div>
          <SectionTitle eyebrow="Built by you" title="Projects" action={<ButtonLink href="/portfolio" tone="ghost" size="sm">Portfolio</ButtonLink>} />
          <Card className="p-4">
            {data.projects.length === 0 ? (
              <p className="text-ink-2">Pass a project, transfer or capstone challenge and it appears in your portfolio.</p>
            ) : (
              <ul className="space-y-2">
                {data.projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{p.title}</span>
                    <Badge tone="good">{p.tests_passed}/{p.tests_total} tests</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div>
          <SectionTitle eyebrow="Ledger" title="Recent XP" />
          <Card className="p-4">
            {data.recent_xp.length === 0 ? (
              <p className="text-ink-2">No XP yet. Complete an activity to earn your first.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.recent_xp.map((x, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-ink-2">{x.reason}</span>
                    <span className="font-mono font-semibold text-gold">+{x.amount}</span>
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

export default function DashboardPage() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoader />}>
        <DashboardInner />
      </Suspense>
    </AppShell>
  );
}
