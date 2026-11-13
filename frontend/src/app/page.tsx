"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Logo } from "@/components/layout/AppShell";
import { Scene } from "@/components/scenes/Scene";
import { ButtonLink, Icon } from "@/components/ui";

const LOOP = ["Experience", "Visualize", "Understand", "Experiment", "Code", "Build", "Evaluate", "Master"];

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="canvas min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-xl font-extrabold">CodeVerse</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <ButtonLink href="/dashboard">Go to home base</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" tone="ghost">Log in</ButtonLink>
              <ButtonLink href="/register">Start learning</ButtonLink>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-6 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-14">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-sm font-semibold text-ink-2">
              <span className="size-2 rounded-full bg-good" /> Free · runs Python right in your browser
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-6xl">
              Don&apos;t just read about code.
              <span className="block text-teal">See it run.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">
              CodeVerse is a visual coding academy for complete beginners. Calculate a moto fare, approve a mobile-money payment,
              plan a delivery round — and watch every variable change as your Python runs.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href={user ? "/dashboard" : "/register"} size="lg">
                Begin your journey <Icon name="arrow" />
              </ButtonLink>
              <ButtonLink href="/login" size="lg" tone="secondary">I already have an account</ButtonLink>
            </div>
            <p className="mt-4 text-sm text-ink-3">No experience needed. Learn it. See it. Build it.</p>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-3xl border border-line bg-card p-3 shadow-lift">
              <Scene name="moto" />
              <div className="mt-3 rounded-2xl bg-editor-bg p-4 font-mono text-sm" style={{ background: "var(--editor-bg)" }}>
                <div><span className="text-violet">distance</span> = <span className="text-gold">4</span></div>
                <div><span className="text-violet">rate</span> = <span className="text-gold">300</span></div>
                <div><span className="text-violet">fare</span> = distance * rate</div>
                <div>print(fare)  <span className="text-ink-3"># 1200</span></div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-4 hidden rotate-[-4deg] rounded-2xl border border-line bg-card px-4 py-3 shadow-lift sm:block">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Variable X-ray</p>
              <div className="mt-1 flex gap-2 font-mono text-sm">
                {[["distance", "4"], ["rate", "300"], ["fare", "1200"]].map(([k, v]) => (
                  <span key={k} className="rounded-lg border border-teal/40 bg-teal-soft px-2 py-1">
                    {k} <b>{v}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-paper-2/60 py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold">How every lesson works</h2>
            <ol className="mt-6 flex flex-wrap justify-center gap-2">
              {LOOP.map((step, i) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="rounded-full border border-line bg-card px-3 py-1.5 font-semibold">
                    <span className="mr-1.5 text-ink-3">{i + 1}</span>
                    {step}
                  </span>
                  {i < LOOP.length - 1 && <Icon name="arrow" className="size-4 text-ink-3" />}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-8 md:grid-cols-[1fr_1fr]">
            <div>
              <h2 className="text-3xl font-bold">Five worlds, one journey</h2>
              <p className="mt-3 text-ink-2">
                Start in <b>Discover Programming</b> by commanding a delivery robot, move into <b>Python Foundations</b>, then choose where to
                go next. Specialisations are being built in the open — we show you exactly what&apos;s ready.
              </p>
            </div>
            <ul className="space-y-3">
              {[
                ["coral", "World 0", "Discover Programming", "Robot missions · algorithms · debugging", "Ready"],
                ["teal", "World 1", "Python Foundations", "Variables · decisions · loops · capstone", "Ready"],
                ["violet", "World 2", "Machine Learning Laboratory", "Data · models · responsible AI", "Being built"],
                ["blue", "World 3", "Cybersecurity Fortress", "Networks · secure code · defence", "Being built"],
                ["gold", "World 4", "DevOps City", "Git · CI/CD · containers · cloud", "Being built"],
              ].map(([tone, n, title, sub, status]) => (
                <li key={title} className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4">
                  <span className={`grid size-11 shrink-0 place-items-center rounded-xl font-display font-bold text-white ${
                    { coral: "bg-coral", teal: "bg-teal", violet: "bg-violet", blue: "bg-blue", gold: "bg-gold" }[tone]
                  } dark:text-paper`}>{n.split(" ")[1]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{title}</p>
                    <p className="text-sm text-ink-3">{sub}</p>
                  </div>
                  <span className={`text-sm font-semibold ${status === "Ready" ? "text-good" : "text-ink-3"}`}>{status}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["eye", "Make the invisible visible", "Code X-Ray steps through real Python execution, showing every variable, branch and loop iteration."],
              ["check", "Proof, not just progress", "Every challenge is checked by automated tests — including hidden ones — so mastery reflects what you can actually do."],
              ["spark", "AI as a coach, not a shortcut", "Nova gives questions and hints first, never full solutions in practice, and stays quiet during assessments."],
            ].map(([icon, title, body]) => (
              <div key={title} className="rounded-2xl border border-line bg-card p-5">
                <Icon name={icon} className="size-6 text-teal" />
                <h3 className="mt-3 text-lg font-bold">{title}</h3>
                <p className="mt-1 text-ink-2">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-line py-6 text-center text-sm text-ink-3">
        CodeVerse — Learn it. See it. Build it. · <Link href="/help" className="underline">Help & documentation</Link>
      </footer>
    </div>
  );
}
