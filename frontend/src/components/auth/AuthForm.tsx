"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Logo } from "@/components/layout/AppShell";
import { Button, Card, TextField } from "@/components/ui";
import { useT } from "@/i18n";
import { api, ApiError, fieldErrors } from "@/lib/api";
import type { User } from "@/lib/types";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const body = Object.fromEntries(form.entries());
      const user = await api<User>(mode === "login" ? "auth/login" : "auth/register", { body });
      setUser(user);
      const next = params.get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      router.replace(user.profile.onboarding_completed ? safeNext : "/onboarding");
    } catch (err) {
      setFields(fieldErrors(err));
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";
  return (
    <div className="canvas grid min-h-dvh place-items-center px-4 py-10">
      <Card className="w-full max-w-md p-7">
        <Link href="/" className="mb-6 flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-xl font-extrabold">CodeVerse</span>
        </Link>
        <h1 className="text-2xl font-bold">{isLogin ? "Welcome back" : "Start your journey"}</h1>
        <p className="mt-1 text-ink-2">{isLogin ? "Pick up exactly where you left off." : "No experience needed — we'll start from the very beginning."}</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          {!isLogin && <TextField name="display_name" label={t("auth.displayName")} required maxLength={60} autoComplete="nickname" error={fields.display_name} />}
          <TextField name="email" type="email" label={t("auth.email")} required autoComplete="email" error={fields.email} />
          <TextField
            name="password"
            type="password"
            label={t("auth.password")}
            required
            minLength={8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            hint={isLogin ? undefined : t("auth.passwordHint")}
            error={fields.password}
          />
          {error && !Object.keys(fields).length && (
            <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            {isLogin ? t("auth.login") : t("auth.register")}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-ink-2">
          {isLogin ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
          <Link className="font-semibold text-teal underline-offset-2 hover:underline" href={isLogin ? "/register" : "/login"}>
            {isLogin ? t("auth.register") : t("auth.login")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
