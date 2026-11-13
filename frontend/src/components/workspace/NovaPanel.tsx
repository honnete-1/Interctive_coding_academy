"use client";

import { useEffect, useState } from "react";
import { Button, Icon, Markdown } from "@/components/ui";
import { useT } from "@/i18n";
import { api, ApiError } from "@/lib/api";
import type { TutorStatus } from "@/lib/types";

const MODES = [
  ["guided", "Guide me (hints & questions)"],
  ["explain", "Explain the concept"],
  ["review", "Review my code"],
  ["challenge", "Quiz me"],
  ["ai_era", "How do I check code I didn't write?"],
] as const;

let statusCache: Promise<TutorStatus> | null = null;

/**
 * Nova, the AI companion. Talks to the server only (no keys in the browser). When no AI provider is configured
 * it says so plainly instead of pretending. Replies are labelled as AI-generated.
 */
export function NovaPanel({ lesson, challenge, code, output, assessment }: { lesson?: string; challenge?: string; code?: string; output?: string; assessment?: boolean }) {
  const t = useT();
  const [status, setStatus] = useState<TutorStatus | null>(null);
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<string>("guided");
  const [answer, setAnswer] = useState<{ text: string; redacted: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    statusCache ??= api<TutorStatus>("tutor/status");
    statusCache.then(setStatus).catch(() => setStatus({ available: false, provider: "none", model: null, message: "Nova's status couldn't be checked.", daily_limit: 0 }));
  }, []);

  async function ask() {
    if (!question.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ answer: string; redacted: boolean }>("tutor/ask", { body: { question, mode, lesson, challenge, code, output } });
      setAnswer({ text: r.answer, redacted: r.redacted });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nova couldn't answer right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-card p-3" aria-label="Nova AI companion">
      <p className="flex items-center gap-2 font-semibold">
        <span className="grid size-7 place-items-center rounded-full bg-violet-soft text-violet"><Icon name="spark" className="size-4" /></span>
        {t("nova.title")}
        {status && <span className={`ml-auto text-xs ${status.available ? "text-good" : "text-ink-3"}`}>{status.available ? "online" : "offline"}</span>}
      </p>
      {status && !status.available ? (
        <p className="mt-2 text-sm text-ink-2">{status.message ?? t("nova.offline")}</p>
      ) : (
        <>
          {assessment && <p className="mt-2 rounded-lg bg-warn-soft px-2 py-1 text-xs text-warn">This is an assessment: Nova can explain concepts but won&apos;t write code for it.</p>}
          <label className="mt-2 block text-xs font-semibold text-ink-3" htmlFor="nova-mode">Mode</label>
          <select id="nova-mode" value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line bg-paper-2 px-2 text-sm">
            {MODES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1500} rows={2} placeholder={t("nova.placeholder")}
            aria-label={t("nova.placeholder")} className="mt-2 w-full rounded-lg border border-line bg-paper-2 p-2 text-sm" />
          <Button size="sm" onClick={ask} loading={busy} disabled={!question.trim() || !status}>
            <Icon name="send" className="size-4" /> {t("nova.ask")}
          </Button>
          {error && <p className="mt-2 text-sm text-bad" role="alert">{error}</p>}
          {answer && (
            <div className="mt-3 rounded-lg border border-violet/30 bg-violet-soft/40 p-3 text-sm" aria-live="polite">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-violet">{t("nova.label")}</p>
              <Markdown text={answer.text} />
              {answer.redacted && <p className="mt-1 text-xs text-ink-3">Part of this reply was removed by CodeVerse&apos;s hint policy.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
