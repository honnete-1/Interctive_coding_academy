"use client";

import clsx from "clsx";
import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

export { Icon } from "./icons";
export { Markdown } from "./markdown";

type Tone = "primary" | "secondary" | "ghost" | "danger" | "coral";

const toneClass: Record<Tone, string> = {
  primary: "bg-teal text-white hover:brightness-110 dark:text-paper shadow-card",
  coral: "bg-coral text-white hover:brightness-110 dark:text-paper shadow-card",
  secondary: "bg-card text-ink border border-line-strong hover:bg-paper-2",
  ghost: "text-ink-2 hover:bg-paper-2 hover:text-ink",
  danger: "bg-bad text-white hover:brightness-110",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: "sm" | "md" | "lg"; loading?: boolean }>(
  function Button({ tone = "primary", size = "md", loading, className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
          size === "sm" && "h-8 px-3 text-sm",
          size === "md" && "h-10 px-4 text-[0.95rem]",
          size === "lg" && "h-12 px-6 text-base",
          toneClass[tone],
          className,
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading && <Spinner className="size-4" />}
        {children}
      </button>
    );
  },
);

export function ButtonLink({ href, tone = "primary", size = "md", className, children }: { href: string; tone?: Tone; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4",
        size === "lg" && "h-12 px-6 text-base",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Card({ className, children, as: As = "section", ...rest }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" | "li" } & Record<string, unknown>) {
  return (
    <As className={clsx("rounded-2xl border border-line bg-card shadow-card", className)} {...rest}>
      {children}
    </As>
  );
}

const badgeTone = {
  neutral: "bg-paper-2 text-ink-2 border-line",
  teal: "bg-teal-soft text-teal border-transparent",
  coral: "bg-coral-soft text-coral border-transparent",
  gold: "bg-gold-soft text-gold border-transparent",
  blue: "bg-blue-soft text-blue border-transparent",
  violet: "bg-violet-soft text-violet border-transparent",
  good: "bg-good-soft text-good border-transparent",
  bad: "bg-bad-soft text-bad border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof badgeTone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", badgeTone[tone], className)}>{children}</span>;
}

const barTone = { teal: "bg-teal", gold: "bg-gold", coral: "bg-coral", blue: "bg-blue" };

export function ProgressBar({ value, label, tone = "teal", className }: { value: number; label: string; tone?: "teal" | "gold" | "coral" | "blue"; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className={clsx("h-2.5 w-full overflow-hidden rounded-full bg-paper-2", className)} role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={clsx("h-full rounded-full transition-[width] duration-700", barTone[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx("animate-spin", className ?? "size-5")} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-3" role="status">
      <Spinner className="size-7 text-teal" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <Card className="mx-auto max-w-lg p-6 text-center" role="alert">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-2 text-ink-2">{message}</p>
      {onRetry && (
        <Button className="mt-4" tone="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <div className="mt-1 max-w-md text-ink-2">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }>(
  function TextField({ label, error, hint, id, className, ...rest }, ref) {
    const fieldId = id ?? rest.name;
    return (
      <div className={className}>
        <label htmlFor={fieldId} className="mb-1 block text-sm font-semibold text-ink-2">
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={clsx(
            "h-11 w-full rounded-xl border bg-card px-3 text-ink outline-none transition placeholder:text-ink-3 focus:border-teal focus:ring-2 focus:ring-teal/25",
            error ? "border-bad" : "border-line-strong",
          )}
          {...rest}
        />
        {error ? (
          <p id={`${fieldId}-error`} className="mt-1 text-sm text-bad">
            {error}
          </p>
        ) : hint ? (
          <p id={`${fieldId}-hint`} className="mt-1 text-sm text-ink-3">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">{eyebrow}</p>}
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export const MASTERY_LABEL: Record<string, { label: string; tone: keyof typeof badgeTone; step: number }> = {
  not_started: { label: "Not started", tone: "neutral", step: 0 },
  exploring: { label: "Exploring", tone: "blue", step: 1 },
  practising: { label: "Practising", tone: "violet", step: 2 },
  developing: { label: "Developing", tone: "gold", step: 3 },
  proficient: { label: "Proficient", tone: "teal", step: 4 },
  mastered: { label: "Mastered", tone: "good", step: 5 },
};
