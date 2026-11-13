"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth, useRequireLearner } from "@/components/auth/AuthProvider";
import { Avatar } from "@/components/layout/Avatar";
import { ErrorState, Icon, PageLoader } from "@/components/ui";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import { levelInfo } from "@/lib/progress";
import type { LevelInfo } from "@/lib/types";

const NAV = [
  { href: "/dashboard", key: "nav.dashboard", icon: "home" },
  { href: "/map", key: "nav.map", icon: "map" },
  { href: "/lab", key: "nav.lab", icon: "flask" },
  { href: "/skills", key: "nav.skills", icon: "chart" },
  { href: "/achievements", key: "nav.achievements", icon: "trophy" },
  { href: "/portfolio", key: "nav.portfolio", icon: "folder" },
] as const;

/** Level chip refreshes on route changes and whenever XP is awarded (cv:xp event). */
function LevelChip() {
  const [level, setLevel] = useState<LevelInfo | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    let live = true;
    const load = () =>
      api<{ total: number }>("xp")
        .then((d) => live && setLevel(levelInfo(d.total)))
        .catch(() => undefined);
    load();
    window.addEventListener("cv:xp", load);
    return () => {
      live = false;
      window.removeEventListener("cv:xp", load);
    };
  }, [pathname]);
  if (!level) return null;
  return (
    <Link href="/achievements" className="flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-sm font-semibold" aria-label={`Level ${level.level}, ${level.xp} XP`}>
      <span className="grid size-6 place-items-center rounded-full bg-gold text-xs font-bold text-white dark:text-paper">{level.level}</span>
      <span className="tabular-nums">{level.xp} XP</span>
    </Link>
  );
}

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { user, ready, error } = useRequireLearner();
  const { logout, updateProfile } = useAuth();
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  if (error) return <div className="p-6"><ErrorState message={error} onRetry={() => location.reload()} /></div>;
  if (!ready || !user) return <PageLoader />;

  const isDark = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">
        {t("nav.skip")}
      </a>

      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-line bg-paper-2/95 backdrop-blur transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Main navigation"
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <Logo />
          <span className="font-display text-xl font-extrabold">CodeVerse</span>
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition",
                  active ? "bg-card text-ink shadow-card" : "text-ink-2 hover:bg-card/60 hover:text-ink",
                )}
              >
                <Icon name={item.icon} className={clsx("size-5", active && "text-teal")} />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-line px-3 py-3">
          <Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2 text-ink-2 hover:bg-card/60 hover:text-ink">
            <Icon name="settings" /> {t("nav.settings")}
          </Link>
          <Link href="/help" className="flex items-center gap-3 rounded-xl px-3 py-2 text-ink-2 hover:bg-card/60 hover:text-ink">
            <Icon name="help" /> {t("nav.help")}
          </Link>
          <button
            onClick={async () => {
              await logout();
              router.push("/");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-ink-2 hover:bg-card/60 hover:text-ink"
          >
            <Icon name="logout" /> {t("nav.logout")}
          </button>
        </div>
      </aside>
      {menuOpen && <button className="fixed inset-0 z-30 bg-ink/30 lg:hidden" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur lg:px-8">
          <button className="rounded-lg p-1.5 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <div className="flex-1" />
          <LevelChip />
          <button
            className="rounded-full p-2 text-ink-2 hover:bg-paper-2"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => updateProfile({ theme: isDark ? "light" : "dark" })}
          >
            <Icon name={isDark ? "sun" : "moon"} />
          </button>
          <Link href="/settings" aria-label="Profile and settings">
            <Avatar avatar={user.profile.avatar} name={user.profile.display_name} size={34} />
          </Link>
        </header>
        <main id="main" className={clsx("canvas mx-auto w-full px-4 pb-24 pt-6 lg:px-8", wide ? "max-w-[1500px]" : "max-w-6xl")}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className ?? "size-9"} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="var(--ink)" />
      <path d="M14 13 8 20l6 7" stroke="var(--teal)" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m26 13 6 7-6 7" stroke="var(--coral)" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="3.2" fill="var(--gold)" />
    </svg>
  );
}
