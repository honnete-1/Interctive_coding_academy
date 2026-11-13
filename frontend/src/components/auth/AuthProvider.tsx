"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import type { Profile, Theme, User } from "@/lib/types";
import { I18nProvider } from "@/i18n";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<User | null>;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function applyPreferences(p: Pick<Profile, "theme" | "reduced_motion" | "font_scale"> | null) {
  const root = document.documentElement;
  let theme: Theme = p?.theme ?? "system";
  if (!p) {
    try {
      theme = (localStorage.getItem("cv-theme") as Theme) || "system";
    } catch {
      /* storage unavailable */
    }
  }
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.reducedMotion = String(!!p?.reduced_motion);
  root.style.setProperty("--font-scale", String(p?.font_scale ?? 1));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api<User>("auth/me");
      setUser(me);
      setError(null);
      return me;
    } catch (err) {
      setUser(null);
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setError(null);
      else setError(err instanceof Error ? err.message : "Could not reach the server.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    applyPreferences(user?.profile ?? null);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyPreferences(user?.profile ?? null);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [user]);

  const logout = useCallback(async () => {
    await api("auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    const profile = await api<Profile>("profile", { method: "PATCH", body: patch });
    setUser((u) => (u ? { ...u, profile } : u));
    try {
      if (patch.theme) localStorage.setItem("cv-theme", patch.theme);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, refresh, setUser, logout, updateProfile }}>
      <I18nProvider locale={user?.profile.language ?? "en"}>{children}</I18nProvider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Redirects to login (or onboarding) when needed; renders children once the learner is ready. */
export function useRequireLearner({ allowIncompleteOnboarding = false } = {}) {
  const { user, loading, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (loading || error) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (!allowIncompleteOnboarding && !user.profile.onboarding_completed) router.replace("/onboarding");
  }, [user, loading, error, router, pathname, allowIncompleteOnboarding]);
  const ready = !!user && (allowIncompleteOnboarding || user.profile.onboarding_completed);
  return { user, ready, loading, error };
}
