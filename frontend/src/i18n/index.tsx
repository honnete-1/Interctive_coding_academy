"use client";

/**
 * Minimal i18n layer. UI strings live in message catalogues (en.ts), never inline in components,
 * so Kinyarwanda (rw) or other languages can be added by dropping in a catalogue.
 * Lesson content is translated separately, in backend/content.
 */
import { createContext, useContext, type ReactNode } from "react";
import { en, type Messages } from "./en";

const catalogues: Record<string, Messages> = { en };

const I18nContext = createContext<Messages>(en);

export function I18nProvider({ locale, children }: { locale: string; children: ReactNode }) {
  return <I18nContext.Provider value={catalogues[locale] ?? en}>{children}</I18nContext.Provider>;
}

export function useT() {
  const messages = useContext(I18nContext);
  return function t(key: keyof Messages, vars?: Record<string, string | number>) {
    let s: string = messages[key] ?? en[key] ?? String(key);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
