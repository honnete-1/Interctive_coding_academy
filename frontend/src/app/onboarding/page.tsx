"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth, useRequireLearner } from "@/components/auth/AuthProvider";
import { Logo } from "@/components/layout/AppShell";
import { Avatar, AVATAR_BASES, AVATAR_COLORS } from "@/components/layout/Avatar";
import { Button, Card, Icon, PageLoader } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Profile, User } from "@/lib/types";

const EXPERIENCE = [
  { id: "none", label: "Never", sub: "I've never written code" },
  { id: "a_little", label: "A little", sub: "I've tried a tutorial or two" },
  { id: "some", label: "Some", sub: "I've built small programs" },
  { id: "experienced", label: "Comfortable", sub: "I code regularly" },
] as const;

const MOTIVATIONS = ["Get a job in tech", "Build my own app or business tool", "Do better in my studies", "Understand AI", "Just curious"];

const SPECIALIZATIONS = [
  { id: "ml", label: "Machine Learning", icon: "chart" },
  { id: "security", label: "Cybersecurity", icon: "lock" },
  { id: "devops", label: "DevOps & Cloud", icon: "settings" },
  { id: "undecided", label: "Not sure yet", icon: "compass" },
] as const;

const INTERESTS = [
  ["transport", "Transport"], ["finance", "Money & mobile payments"], ["sports", "Sports"], ["farming", "Farming"],
  ["small_business", "Small business"], ["healthcare", "Health admin"], ["education", "School & education"],
  ["logistics", "Delivery & logistics"], ["environment", "Environment"], ["everyday_tech", "Everyday tech"],
] as const;

const TIME = [[60, "About 1 hour"], [120, "2–3 hours"], [300, "5 hours"], [600, "10+ hours"]] as const;

const DIAGNOSTIC = [
  { id: "d1", q: "x = 2\nx = x * 3\nprint(x)", prompt: "What does this print?", options: ["2", "6", "x * 3", "23"] },
  { id: "d2", q: "n = 7\nif n > 10:\n    print('a')\nelse:\n    print('b')", prompt: "Which letter is printed?", options: ["a", "b", "both", "neither"] },
  { id: "d3", q: "for i in range(1, 4):\n    print(i)", prompt: "How many lines are printed?", options: ["3", "4", "1", "0"] },
  { id: "d4", q: 'print("5" + 5)', prompt: "What happens?", options: ["10", "55", "TypeError", "5 5"] },
];

function Choice({ selected, onClick, children, className }: { selected: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        "rounded-2xl border-2 p-4 text-left transition",
        selected ? "border-teal bg-teal-soft" : "border-line bg-card hover:border-line-strong",
        className,
      )}
    >
      {children}
    </button>
  );
}

export default function Onboarding() {
  const { user, ready } = useRequireLearner({ allowIncompleteOnboarding: true });
  const { setUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Profile>>({
    experience: "none", motivation: "", specializations: [], interests: ["transport", "finance"],
    english_comfort: 3, guidance: "guided", weekly_minutes: 120, avatar: { base: "round", color: AVATAR_COLORS[0], accessory: "none" },
  });
  const [diag, setDiag] = useState<Record<string, string>>({});
  const [takeDiag, setTakeDiag] = useState<boolean | null>(null);

  if (!ready || !user) return <PageLoader />;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: "interests" | "specializations", v: string) =>
    setForm((f) => {
      const list = (f[k] as string[]) ?? [];
      return { ...f, [k]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] };
    });

  const showDiagnostic = form.experience !== "none";
  const steps = [
    {
      title: `Muraho, ${user.profile.display_name}! Have you programmed before?`,
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          {EXPERIENCE.map((e) => (
            <Choice key={e.id} selected={form.experience === e.id} onClick={() => set("experience", e.id)}>
              <p className="font-bold">{e.label}</p>
              <p className="text-sm text-ink-2">{e.sub}</p>
            </Choice>
          ))}
        </div>
      ),
    },
    {
      title: "Why do you want to learn to code?",
      body: (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {MOTIVATIONS.map((m) => (
              <Choice key={m} className="px-4 py-2.5" selected={form.motivation === m} onClick={() => set("motivation", m)}>
                {m}
              </Choice>
            ))}
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-ink-2">Or in your own words</span>
            <input
              className="mt-1 h-11 w-full rounded-xl border border-line-strong bg-card px-3"
              maxLength={200}
              value={MOTIVATIONS.includes(form.motivation ?? "") ? "" : form.motivation}
              onChange={(e) => set("motivation", e.target.value)}
            />
          </label>
        </div>
      ),
    },
    {
      title: "Which paths interest you after Python?",
      sub: "Pick any — you can explore all of them. Everyone starts with Python Foundations.",
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          {SPECIALIZATIONS.map((s) => (
            <Choice key={s.id} selected={!!form.specializations?.includes(s.id)} onClick={() => toggle("specializations", s.id)}>
              <Icon name={s.icon} className="mb-2 size-6 text-teal" />
              <p className="font-bold">{s.label}</p>
            </Choice>
          ))}
        </div>
      ),
    },
    {
      title: "What kinds of examples do you enjoy?",
      sub: "We'll use these to suggest practice. The lessons stay correct whichever you choose.",
      body: (
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map(([id, label]) => (
            <Choice key={id} className="px-4 py-2.5" selected={!!form.interests?.includes(id)} onClick={() => toggle("interests", id)}>
              {label}
            </Choice>
          ))}
        </div>
      ),
    },
    {
      title: "How should we teach?",
      body: (
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 font-semibold">How comfortable are you reading technical English?</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Choice key={n} className="w-24 px-3 py-2 text-center" selected={form.english_comfort === n} onClick={() => set("english_comfort", n)}>
                  <b>{n}</b>
                  <span className="block text-xs text-ink-3">{["Hard", "Some help", "OK", "Good", "Fluent"][n - 1]}</span>
                </Choice>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">Do you prefer step-by-step guidance or exploring on your own?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {([["guided", "Guide me step by step"], ["balanced", "A bit of both"], ["exploratory", "Let me explore"]] as const).map(([id, label]) => (
                <Choice key={id} selected={form.guidance === id} onClick={() => set("guidance", id)}>
                  {label}
                </Choice>
              ))}
            </div>
          </fieldset>
        </div>
      ),
    },
    {
      title: "How much time would you like to spend each week?",
      sub: "There are no penalties for missing days. This just helps us pace suggestions.",
      body: (
        <div className="grid gap-3 sm:grid-cols-4">
          {TIME.map(([m, label]) => (
            <Choice key={m} selected={form.weekly_minutes === m} onClick={() => set("weekly_minutes", m)}>
              {label}
            </Choice>
          ))}
        </div>
      ),
    },
    ...(showDiagnostic
      ? [
          {
            title: "Optional: a 1-minute warm-up",
            sub: "This only helps us recommend where to start. It isn't graded and you can skip it.",
            body:
              takeDiag !== true ? (
                <div className="flex gap-3">
                  <Button onClick={() => setTakeDiag(true)}>Try the warm-up</Button>
                  <Button tone="secondary" onClick={() => { setTakeDiag(false); setStep((s) => s + 1); }}>
                    Skip
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {DIAGNOSTIC.map((d) => (
                    <fieldset key={d.id} className="rounded-2xl border border-line bg-card p-4">
                      <legend className="sr-only">{d.prompt}</legend>
                      <pre className="rounded-lg bg-paper-2 p-3 font-mono text-sm">{d.q}</pre>
                      <p className="mt-2 font-semibold">{d.prompt}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {d.options.map((o, i) => {
                          const value = d.id === "d2" ? ["a", "b", "both", "neither"][i] : o;
                          return (
                            <Choice key={o} className="px-3 py-1.5 font-mono text-sm" selected={diag[d.id] === value} onClick={() => setDiag((x) => ({ ...x, [d.id]: value }))}>
                              {o}
                            </Choice>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>
              ),
          },
        ]
      : []),
    {
      title: "Create your avatar",
      sub: "Unlock accessories as you earn achievements.",
      body: (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <Avatar avatar={form.avatar ?? {}} name={user.profile.display_name} size={120} />
          <div className="space-y-4">
            <div className="flex gap-2" role="group" aria-label="Avatar shape">
              {AVATAR_BASES.map((b) => (
                <Choice key={b} className="p-2" selected={form.avatar?.base === b} onClick={() => set("avatar", { ...form.avatar, base: b })}>
                  <Avatar avatar={{ ...form.avatar, base: b }} name={b} size={44} />
                </Choice>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Avatar colour">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  aria-pressed={form.avatar?.color === c}
                  onClick={() => set("avatar", { ...form.avatar, color: c })}
                  className={clsx("size-10 rounded-full border-4", form.avatar?.color === c ? "border-ink" : "border-transparent")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];

  const last = step === steps.length - 1;
  const current = steps[step];

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await api("onboarding", { body: { ...form, ...(takeDiag && Object.keys(diag).length ? { diagnostic_answers: diag } : {}) } });
      const me = await api<User>("auth/me");
      setUser(me);
      router.replace("/dashboard?welcome=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="canvas min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <span className="text-sm text-ink-3" aria-live="polite">
            Step {step + 1} of {steps.length}
          </span>
        </div>
        <div className="mb-6 flex gap-1.5" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={clsx("h-1.5 flex-1 rounded-full", i <= step ? "bg-teal" : "bg-line")} />
          ))}
        </div>
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold sm:text-3xl">{current.title}</h1>
          {"sub" in current && current.sub && <p className="mt-2 text-ink-2">{current.sub}</p>}
          <div className="mt-6">{current.body}</div>
          {error && <p role="alert" className="mt-4 text-bad">{error}</p>}
          <div className="mt-8 flex justify-between">
            <Button tone="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
              Back
            </Button>
            {last ? (
              <Button onClick={finish} loading={busy} size="lg">
                Enter CodeVerse <Icon name="arrow" />
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
            )}
          </div>
        </Card>
        <p className="mt-4 text-center text-sm text-ink-3">You can change any of these later in Settings.</p>
      </div>
    </div>
  );
}
