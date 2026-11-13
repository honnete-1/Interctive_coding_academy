"use client";

import { useEffect, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { useT } from "@/i18n";
import { api, ApiError } from "@/lib/api";
import type { Challenge, Hint } from "@/lib/types";
import { useLessonContext } from "@/components/lesson/LessonContext";

const LEVEL_NAME = ["", "Clarifying question", "Concept nudge", "Look at it visually", "Pseudocode", "Direct help"];

/** Progressive, authored hint ladder. Each level must be opened in order and is recorded (affects independence). */
export function HintPanel({ challenge }: { lessonSlug: string; challenge: Challenge }) {
  const t = useT();
  const lesson = useLessonContext();
  const [hints, setHints] = useState<Hint[]>(() => lesson?.hints[challenge.slug] ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setHints(lesson?.hints[challenge.slug] ?? []), [lesson?.hints, challenge.slug]);
  if (!challenge.hint_count) return null;

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ hints: Hint[] }>(`challenges/${challenge.slug}/hints`, { body: { level: hints.length + 1 } });
      setHints(r.hints);
      lesson?.setHints(challenge.slug, r.hints);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load the hint.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-card p-3" aria-label={t("hint.title")}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold"><Icon name="bulb" className="size-5 text-gold" /> {t("hint.title")}</p>
        {hints.length < challenge.hint_count && (
          <Button size="sm" tone="secondary" onClick={open} loading={busy}>
            {t("hint.open", { level: hints.length + 1, total: challenge.hint_count })}
          </Button>
        )}
      </div>
      {hints.length === 0 && <p className="mt-1 text-sm text-ink-3">{t("hint.note")}</p>}
      <ol className="mt-2 space-y-2">
        {hints.map((h) => (
          <li key={h.level} className="rounded-lg bg-gold-soft/60 px-3 py-2 text-sm">
            <span className="block text-xs font-bold uppercase tracking-wide text-gold">{h.level}. {LEVEL_NAME[h.level] ?? "Hint"}</span>
            {h.text}
          </li>
        ))}
      </ol>
      {error && <p className="mt-1 text-sm text-bad">{error}</p>}
    </section>
  );
}
