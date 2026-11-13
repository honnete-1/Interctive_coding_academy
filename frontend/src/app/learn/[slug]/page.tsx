"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { ButtonLink, Card, ErrorState, Icon, PageLoader } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Lesson } from "@/lib/types";

function LessonInner({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const load = useCallback(() => {
    setError(null);
    api<Lesson>(`lessons/${slug}`).then(setLesson).catch((e) => setError({ status: e instanceof ApiError ? e.status : 0, message: e instanceof ApiError ? e.message : "Could not load this lesson." }));
  }, [slug]);
  useEffect(load, [load]);

  if (error?.status === 404) return <ErrorState title="Lesson not found" message="This lesson doesn't exist. It may have been renamed." />;
  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (!lesson || !user) return <PageLoader label="Preparing your lesson…" />;
  if (lesson.locked) {
    return (
      <Card className="mx-auto max-w-xl p-7 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-paper-2 text-ink-3"><Icon name="lock" className="size-7" /></span>
        <h1 className="mt-3 text-2xl font-bold">{lesson.title}</h1>
        <p className="mt-2 text-ink-2">{lesson.lock_reason}</p>
        <ButtonLink href="/map" className="mt-5">Find it on the map</ButtonLink>
      </Card>
    );
  }
  return <LessonPlayer lesson={lesson} defaultMode={user.profile.interface_mode} />;
}

export default function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <AppShell wide>
      <LessonInner slug={slug} />
    </AppShell>
  );
}
