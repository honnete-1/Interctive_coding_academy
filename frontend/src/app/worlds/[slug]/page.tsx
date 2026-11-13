"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { WorldHeader } from "@/components/layout/WorldMap";
import { Badge, Card, ErrorState, Icon, PageLoader } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { World } from "@/lib/types";

const STATUS = {
  completed: { tone: "good", label: "Completed" },
  in_progress: { tone: "blue", label: "In progress" },
  available: { tone: "teal", label: "Ready" },
  locked: { tone: "neutral", label: "Locked" },
} as const;

function WorldInner({ slug }: { slug: string }) {
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<World>(`worlds/${slug}`).then(setWorld).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load this world."));
  }, [slug]);
  useEffect(load, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!world) return <PageLoader />;
  return (
    <div className="space-y-6">
      <Link href="/map" className="text-sm font-semibold text-ink-3 hover:text-ink">← World map</Link>
      <WorldHeader world={world} />
      <p className="max-w-3xl text-ink-2">{world.description}</p>
      {world.modules.map((m) => (
        <section key={m.slug}>
          <h2 className="text-xl font-bold">{m.title}</h2>
          <p className="text-ink-2">{m.description}</p>
          <ol className="mt-3 grid gap-3 md:grid-cols-2">
            {m.lessons.map((l, i) => {
              const s = STATUS[l.status];
              const inner = (
                <Card as="div" className={`h-full p-4 ${l.status === "locked" ? "opacity-70" : "transition hover:-translate-y-0.5 hover:shadow-lift"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-ink-3">{i + 1} · {l.kind} · {l.estimated_minutes} min · {l.xp} XP</span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  <h3 className="mt-1 text-lg font-bold">{l.title}</h3>
                  <p className="text-ink-2">{l.summary}</p>
                  {l.lock_reason && <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-3"><Icon name="lock" className="size-4" /> {l.lock_reason}</p>}
                </Card>
              );
              return <li key={l.slug}>{l.status === "locked" ? inner : <Link href={`/learn/${l.slug}`}>{inner}</Link>}</li>;
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

export default function WorldPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <AppShell>
      <WorldInner slug={slug} />
    </AppShell>
  );
}
