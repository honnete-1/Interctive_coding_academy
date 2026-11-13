"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AVATAR_ACCESSORIES, AVATAR_BASES, AVATAR_COLORS } from "@/components/layout/Avatar";
import { Button, Card, TextField } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Achievement, Profile } from "@/lib/types";

const INTERESTS = [
  ["transport", "Transport"], ["finance", "Money & mobile payments"], ["sports", "Sports"], ["farming", "Farming"],
  ["small_business", "Small business"], ["healthcare", "Health admin"], ["education", "Education"],
  ["logistics", "Logistics"], ["environment", "Environment"], ["everyday_tech", "Everyday tech"],
] as const;

function SettingsInner() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState<Profile | null>(user?.profile ?? null);
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Achievement[]>("achievements").then((a) => setEarned(new Set(a.filter((x) => x.earned).map((x) => x.slug)))).catch(() => undefined);
  }, []);
  if (!form || !user) return null;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm({ ...form, [k]: v });

  async function save() {
    if (!form) return;
    setState("saving");
    setError(null);
    try {
      const { onboarding_completed, diagnostic_score, ...patch } = form;
      void onboarding_completed;
      void diagnostic_score;
      await updateProfile(patch);
      setState("saved");
    } catch (e) {
      setState("error");
      setError(e instanceof ApiError ? e.message : "Couldn't save.");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-extrabold">Settings</h1>

      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-bold">Profile &amp; avatar</h2>
        <TextField label="Display name" value={form.display_name} maxLength={60} onChange={(e) => set("display_name", e.target.value)} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar avatar={form.avatar} name={form.display_name} size={96} />
          <div className="space-y-3">
            <div className="flex gap-2" role="group" aria-label="Shape">
              {AVATAR_BASES.map((b) => (
                <button key={b} aria-pressed={form.avatar.base === b} onClick={() => set("avatar", { ...form.avatar, base: b })} className={clsx("rounded-xl border-2 p-1", form.avatar.base === b ? "border-teal" : "border-line")}>
                  <Avatar avatar={{ ...form.avatar, base: b }} name={b} size={40} />
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Colour">
              {AVATAR_COLORS.map((c) => (
                <button key={c} aria-label={`Colour ${c}`} aria-pressed={form.avatar.color === c} onClick={() => set("avatar", { ...form.avatar, color: c })}
                  className={clsx("size-9 rounded-full border-4", form.avatar.color === c ? "border-ink" : "border-transparent")} style={{ background: c }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Accessory">
              {AVATAR_ACCESSORIES.map((a) => {
                const locked = !!a.unlock && !earned.has(a.unlock);
                return (
                  <button key={a.id} disabled={locked} aria-pressed={(form.avatar.accessory ?? "none") === a.id} onClick={() => set("avatar", { ...form.avatar, accessory: a.id })}
                    className={clsx("rounded-full border px-3 py-1 text-sm", (form.avatar.accessory ?? "none") === a.id ? "border-teal bg-teal-soft" : "border-line", locked && "opacity-50")}
                    title={locked ? "Unlock by earning an achievement" : undefined}>
                    {a.label}{locked ? " 🔒" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-bold">Display &amp; accessibility</h2>
        <fieldset>
          <legend className="mb-2 font-semibold">Theme</legend>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button key={t} aria-pressed={form.theme === t} onClick={() => set("theme", t)} className={clsx("rounded-xl border-2 px-4 py-2 capitalize", form.theme === t ? "border-teal bg-teal-soft" : "border-line")}>{t}</button>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={form.reduced_motion} onChange={(e) => set("reduced_motion", e.target.checked)} className="size-5 accent-[var(--teal)]" />
          <span>Reduce motion (turns off animations)</span>
        </label>
        <label className="block">
          <span className="font-semibold">Text size: {Math.round(form.font_scale * 100)}%</span>
          <input type="range" min={0.85} max={1.5} step={0.05} value={form.font_scale} onChange={(e) => set("font_scale", Number(e.target.value))} className="mt-2 w-full max-w-sm accent-[var(--teal)]" />
        </label>
        <fieldset>
          <legend className="mb-2 font-semibold">Default lesson mode</legend>
          <div className="flex gap-2">
            {(["adventure", "focus"] as const).map((m) => (
              <button key={m} aria-pressed={form.interface_mode === m} onClick={() => set("interface_mode", m)} className={clsx("rounded-xl border-2 px-4 py-2 capitalize", form.interface_mode === m ? "border-teal bg-teal-soft" : "border-line")}>{m}</button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="font-semibold">Language</span>
          <select value={form.language} onChange={(e) => set("language", e.target.value)} className="mt-1 block h-10 rounded-xl border border-line-strong bg-card px-3">
            <option value="en">English</option>
          </select>
          <span className="text-sm text-ink-3">Kinyarwanda is planned. The interface is ready for more languages.</span>
        </label>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-bold">Learning preferences</h2>
        <fieldset>
          <legend className="mb-2 font-semibold">Guidance</legend>
          <div className="flex flex-wrap gap-2">
            {(["guided", "balanced", "exploratory"] as const).map((g) => (
              <button key={g} aria-pressed={form.guidance === g} onClick={() => set("guidance", g)} className={clsx("rounded-xl border-2 px-4 py-2 capitalize", form.guidance === g ? "border-teal bg-teal-soft" : "border-line")}>{g}</button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 font-semibold">Example topics you enjoy</legend>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(([id, label]) => {
              const on = form.interests.includes(id);
              return (
                <button key={id} aria-pressed={on} onClick={() => set("interests", on ? form.interests.filter((x) => x !== id) : [...form.interests, id])}
                  className={clsx("rounded-full border px-3 py-1 text-sm", on ? "border-teal bg-teal-soft" : "border-line")}>{label}</button>
              );
            })}
          </div>
        </fieldset>
        <label className="block">
          <span className="font-semibold">Weekly time goal (minutes)</span>
          <input type="number" min={15} max={3000} value={form.weekly_minutes} onChange={(e) => set("weekly_minutes", Number(e.target.value))} className="mt-1 block h-10 w-32 rounded-xl border border-line-strong bg-card px-3" />
        </label>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} loading={state === "saving"} size="lg">Save settings</Button>
        <span aria-live="polite" className={state === "error" ? "text-bad" : "text-good"}>{state === "saved" ? "Saved" : error}</span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsInner />
    </AppShell>
  );
}
