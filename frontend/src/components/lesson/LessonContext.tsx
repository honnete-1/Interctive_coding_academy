"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Hint } from "@/lib/types";

interface LessonCtx {
  slug: string;
  mode: "adventure" | "focus";
  setMode: (m: "adventure" | "focus") => void;
  drafts: Record<string, string>;
  setDraft: (challenge: string, code: string) => void;
  saveState: "idle" | "saving" | "saved" | "error";
  hints: Record<string, Hint[]>;
  setHints: (challenge: string, hints: Hint[]) => void;
  passed: Set<string>;
  markPassed: (challenge: string) => void;
}

const Ctx = createContext<LessonCtx | null>(null);

/**
 * Lesson-wide state shared by every block. Code drafts live here (not inside a workspace), so switching
 * between Adventure and Focus mode never loses work; they are autosaved to the server (debounced).
 */
export function LessonProvider({ slug, initialDrafts, initialHints, initialPassed, initialMode, children }: {
  slug: string;
  initialDrafts: Record<string, string>;
  initialHints: Record<string, Hint[]>;
  initialPassed: string[];
  initialMode: "adventure" | "focus";
  children: ReactNode;
}) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [hints, setHintsState] = useState(initialHints);
  const [passed, setPassed] = useState(() => new Set(initialPassed));
  const [mode, setMode] = useState(initialMode);
  const [saveState, setSaveState] = useState<LessonCtx["saveState"]>("idle");
  const pending = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const body = pending.current;
    pending.current = {};
    if (!Object.keys(body).length) return;
    setSaveState("saving");
    try {
      await api(`lessons/${slug}/progress`, { body: { drafts: body } });
      setSaveState("saved");
    } catch {
      pending.current = { ...body, ...pending.current };
      setSaveState("error");
    }
  }, [slug]);

  const setDraft = useCallback((challenge: string, code: string) => {
    setDrafts((d) => ({ ...d, [challenge]: code }));
    pending.current[challenge] = code;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1200);
  }, [flush]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    void flush();
  }, [flush]);

  return (
    <Ctx.Provider value={{
      slug, mode, setMode, drafts, setDraft, saveState, hints,
      setHints: (c, h) => setHintsState((s) => ({ ...s, [c]: h })),
      passed, markPassed: (c) => setPassed((s) => new Set(s).add(c)),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLessonContext = () => useContext(Ctx);
