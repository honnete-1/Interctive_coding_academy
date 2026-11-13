"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { WorldHeader, WorldTrail } from "@/components/layout/WorldMap";
import { Card, ErrorState, Icon, PageLoader } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { World } from "@/lib/types";

function MapInner() {
  const [worlds, setWorlds] = useState<World[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<World[]>("worlds").then(setWorlds).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the map."));
  }, []);
  useEffect(load, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!worlds) return <PageLoader label="Unfolding the map…" />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">The CodeVerse map</h1>
        <p className="mt-1 max-w-2xl text-ink-2">
          Each node is a lesson, mission or capstone. Locked nodes tell you exactly what to finish first — nothing is locked arbitrarily.
        </p>
      </div>
      <ol className="space-y-5">
        {worlds.map((w) => (
          <li key={w.slug}>
            <Card className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <WorldHeader world={w} />
                {w.is_available && (
                  <Link href={`/worlds/${w.slug}`} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-teal hover:underline">
                    Overview <Icon name="arrow" className="size-4" />
                  </Link>
                )}
              </div>
              <WorldTrail world={w} />
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function MapPage() {
  return (
    <AppShell>
      <MapInner />
    </AppShell>
  );
}
