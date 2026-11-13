"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Scene } from "@/components/scenes/Scene";
import { Badge, Button, ButtonLink, Card, Icon, Markdown } from "@/components/ui";
import { CodeXRay } from "@/components/visuals/CodeXRay";
import { FareExplorer, type FareConfig } from "@/components/visuals/FareExplorer";
import { LogicPlayground, type LogicConfig } from "@/components/visuals/LogicPlayground";
import { LoopSimulator, type LoopConfig } from "@/components/visuals/LoopSimulator";
import { ChallengeWorkspace } from "@/components/workspace/ChallengeWorkspace";
import { RobotWorkspace } from "@/components/workspace/RobotWorkspace";
import { useT } from "@/i18n";
import { api, ApiError } from "@/lib/api";
import { announceXp } from "@/lib/progress";
import type { ActivityResult, Block, Lesson, LessonCompleteResult } from "@/lib/types";
import { PredictBlock, ReflectionBlock, SequenceBlock } from "./Activities";
import { LessonProvider, useLessonContext } from "./LessonContext";

const BLOCK_LABEL: Record<Block["type"], string> = {
  story: "Story", explain: "Explanation", visual: "Explore", predict: "Predict", sequence: "Order", xray: "Code X-Ray", challenge: "Challenge", reflection: "Reflect",
};

function BlockView({ lesson, block, responses, setResponse, focus }: {
  lesson: Lesson; block: Block; responses: Record<string, ActivityResult>; setResponse: (id: string, r: ActivityResult) => void; focus: boolean;
}) {
  const ctx = useLessonContext();
  switch (block.type) {
    case "story":
      return (
        <div>
          {!focus && <Scene name={block.scene} className="mb-5 w-full rounded-2xl" />}
          {block.title && <h2 className="text-2xl font-bold">{block.title}</h2>}
          <Markdown text={block.body} className="mt-2 text-lg text-ink-2" />
        </div>
      );
    case "explain":
      return (
        <div>
          {block.title && <h2 className="text-2xl font-bold">{block.title}</h2>}
          <Markdown text={block.body} className="mt-2 text-lg text-ink-2" />
          {(block.analogy || block.actual) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {block.analogy && (
                <div className="rounded-xl border border-gold/40 bg-gold-soft/50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-gold">Analogy</p>
                  <p className="mt-1">{block.analogy}</p>
                </div>
              )}
              {block.actual && (
                <div className="rounded-xl border border-teal/40 bg-teal-soft/50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-teal">What actually happens</p>
                  <p className="mt-1">{block.actual}</p>
                </div>
              )}
            </div>
          )}
          {block.code && <pre className="mt-4 overflow-auto rounded-xl bg-paper-2 p-4 font-mono text-[0.95rem] leading-7">{block.code}</pre>}
          {block.note && <p className="mt-3 flex gap-2 text-ink-2"><Icon name="bulb" className="mt-0.5 size-5 shrink-0 text-gold" />{block.note}</p>}
        </div>
      );
    case "visual": {
      const c = block.config;
      return (
        <div>
          {block.caption && <p className="mb-3 text-ink-2">{block.caption}</p>}
          {block.component === "fare-explorer" && <FareExplorer config={c as unknown as FareConfig} />}
          {block.component === "logic-playground" && <LogicPlayground config={c as unknown as LogicConfig} />}
          {block.component === "loop-simulator" && <LoopSimulator config={c as unknown as LoopConfig} />}
          {block.component === "variable-lab" && (
            <CodeXRay title="Variable Lab" code={String(c.code ?? "")} editable={c.editable !== false} highlight={c.highlight as string[] | undefined}
              prompt="Run it, then step through. Try changing distance on line 1 and running again." />
          )}
        </div>
      );
    }
    case "xray":
      return <CodeXRay title={block.title} prompt={block.prompt} code={block.code} stdin={block.stdin} />;
    case "predict":
      return <PredictBlock lesson={lesson.slug} block={block} result={responses[block.id]} onResult={(r) => setResponse(block.id, r)} />;
    case "sequence":
      return <SequenceBlock lesson={lesson.slug} block={block} result={responses[block.id]} onResult={(r) => setResponse(block.id, r)} />;
    case "reflection":
      return <ReflectionBlock lesson={lesson.slug} block={block} result={responses[block.id]} onResult={(r) => setResponse(block.id, r)} />;
    case "challenge":
      return block.challenge.kind === "robot" ? (
        <div>
          <h2 className="text-2xl font-bold">{block.challenge.title}</h2>
          <Markdown text={block.challenge.prompt} className="mb-4 mt-1 text-ink-2" />
          <RobotWorkspace lessonSlug={lesson.slug} challenge={block.challenge} passedBefore={!!ctx?.passed.has(block.challenge.slug)} onPassed={() => ctx?.markPassed(block.challenge.slug)} />
        </div>
      ) : (
        <ChallengeWorkspace lessonSlug={lesson.slug} challenge={block.challenge} onPassed={() => undefined} />
      );
  }
}

function isDone(block: Block, responses: Record<string, ActivityResult>, passed: Set<string>) {
  if (block.type === "challenge") return passed.has(block.challenge.slug) || !block.challenge.required;
  if (block.type === "predict" || block.type === "sequence" || block.type === "reflection") return block.id in responses;
  return true;
}

function CompletionPanel({ lesson, result, onJump }: { lesson: Lesson; result: LessonCompleteResult; onJump: (id: string) => void }) {
  if (!result.completed) {
    return (
      <Card className="border-warn/40 p-5" role="alert">
        <h3 className="text-lg font-bold">Almost there</h3>
        <p className="text-ink-2">These activities still need to be finished:</p>
        <ul className="mt-2 space-y-1">
          {result.missing.map((m) => (
            <li key={m.block_id}>
              <button className="text-left font-semibold text-teal underline" onClick={() => onJump(m.block_id)}>{m.reason}</button>
            </li>
          ))}
        </ul>
      </Card>
    );
  }
  const xp = (result.xp_awarded ?? []).reduce((s, x) => s + x.amount, 0) + (result.achievements ?? []).reduce((s, a) => s + a.xp, 0);
  const a = result.assessment ?? {};
  const rows: [string, unknown][] = [
    ["Functional correctness", a.functional_correctness], ["Understanding (first-try predictions)", a.understanding],
    ["Independence", a.independence], ["Code quality", a.quality], ["Reflection", a.reflection],
  ];
  return (
    <Card className="animate-pop overflow-hidden">
      <div className="bg-good-soft p-6 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-good text-white dark:text-paper"><Icon name="trophy" className="size-8" /></span>
        <h3 className="mt-3 text-2xl font-extrabold">{result.newly_completed ? "Lesson complete!" : "Already completed"}</h3>
        {xp > 0 && <p className="mt-1 font-mono text-lg font-bold text-gold">+{xp} XP</p>}
        {result.level && <p className="text-sm text-ink-2">Level {result.level.level} · {result.level.xp} XP total</p>}
      </div>
      <div className="space-y-5 p-6">
        {(result.achievements ?? []).length > 0 && (
          <div>
            <p className="font-bold">Achievements unlocked</p>
            <ul className="mt-2 space-y-2">
              {result.achievements!.map((ach) => (
                <li key={ach.slug} className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold-soft/50 p-3">
                  <Icon name={ach.icon} className="size-6 text-gold" />
                  <div><p className="font-bold">{ach.title}</p><p className="text-sm text-ink-2">{ach.description}</p></div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="font-bold">Your assessment</p>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {rows.filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-lg bg-paper-2 px-3 py-2 text-sm"><dt>{k}</dt><dd className="font-mono font-bold">{Math.round(Number(v) * 100)}%</dd></div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-ink-3">{String(a.note ?? "")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {(result.unlocked ?? []).map((u) => (
            <ButtonLink key={u.slug} href={`/learn/${u.slug}`} size="lg"><Icon name="arrow" /> Next: {u.title}</ButtonLink>
          ))}
          {!(result.unlocked ?? []).length && lesson.next_lesson && <ButtonLink href={`/learn/${lesson.next_lesson.slug}`} size="lg">Next: {lesson.next_lesson.title}</ButtonLink>}
          <ButtonLink href="/dashboard" tone="secondary" size="lg">Back to home base</ButtonLink>
        </div>
      </div>
    </Card>
  );
}

function Player({ lesson }: { lesson: Lesson }) {
  const t = useT();
  const ctx = useLessonContext()!;
  const { updateProfile } = useAuth();
  const blocks = lesson.blocks ?? [];
  const [index, setIndex] = useState(Math.min(lesson.progress?.current_block ?? 0, blocks.length - 1));
  const [responses, setResponses] = useState(lesson.progress?.responses ?? {});
  const [result, setResult] = useState<LessonCompleteResult | null>(null);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const focus = ctx.mode === "focus";
  const block = blocks[index];
  const last = index === blocks.length - 1;

  useEffect(() => {
    api(`lessons/${lesson.slug}/progress`, { body: { current_block: index } }).catch(() => undefined);
  }, [index, lesson.slug]);

  const go = (i: number) => {
    setIndex(Math.max(0, Math.min(blocks.length - 1, i)));
    setResult(null);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  async function complete() {
    setCompleting(true);
    setError(null);
    try {
      const r = await api<LessonCompleteResult>(`lessons/${lesson.slug}/complete`, { method: "POST" });
      setResult(r);
      if (r.completed) announceXp();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't complete the lesson.");
    } finally {
      setCompleting(false);
    }
  }

  const doneCount = blocks.filter((b) => isDone(b, responses, ctx.passed)).length;

  return (
    <div ref={top} className="scroll-mt-20">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href={`/worlds/${lesson.world.slug}`} className="text-sm font-semibold text-ink-3 hover:text-ink">← {lesson.world.title}</Link>
        <span className="text-ink-3">/</span>
        <span className="text-sm text-ink-3">{lesson.module.title}</span>
        <div className="ml-auto flex items-center gap-1 rounded-xl border border-line bg-card p-1" role="group" aria-label={t("mode.label")}>
          {(["adventure", "focus"] as const).map((m) => (
            <button key={m} aria-pressed={ctx.mode === m} onClick={() => { ctx.setMode(m); updateProfile({ interface_mode: m }).catch(() => undefined); }}
              className={clsx("rounded-lg px-3 py-1.5 text-sm font-semibold", ctx.mode === m ? "bg-ink text-paper dark:bg-paper-2 dark:text-ink" : "text-ink-2")}>
              {t(m === "adventure" ? "mode.adventure" : "mode.focus")}
            </button>
          ))}
        </div>
      </div>

      {!focus && (
        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="teal">{lesson.kind}</Badge>
            <Badge tone="gold">{lesson.xp} XP</Badge>
            <Badge>{lesson.estimated_minutes} min</Badge>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{lesson.title}</h1>
          <p className="mt-1 max-w-3xl text-lg text-ink-2">{lesson.summary}</p>
          {index === 0 && lesson.objectives.length > 0 && (
            <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {lesson.objectives.map((o) => <li key={o} className="flex gap-2 text-ink-2"><Icon name="check" className="mt-0.5 size-4 shrink-0 text-teal" />{o}</li>)}
            </ul>
          )}
        </header>
      )}

      <div className={clsx("grid gap-6", focus ? "" : "lg:grid-cols-[220px_minmax(0,1fr)]")}>
        {/* outline */}
        <nav aria-label="Lesson steps" className={clsx(focus ? "flex flex-wrap gap-1.5" : "hidden lg:block")}>
          <p className={clsx("mb-2 text-xs font-bold uppercase tracking-wider text-ink-3", focus && "sr-only")}>{doneCount}/{blocks.length} done</p>
          <ol className={clsx(focus ? "flex flex-wrap gap-1.5" : "space-y-1")}>
            {blocks.map((b, i) => {
              const done = isDone(b, responses, ctx.passed);
              return (
                <li key={b.id}>
                  <button onClick={() => go(i)} aria-current={i === index ? "step" : undefined}
                    className={clsx("flex w-full items-center gap-2 rounded-lg text-left text-sm",
                      focus ? "px-2.5 py-1 border" : "px-2 py-1.5",
                      i === index ? "bg-card font-bold shadow-card" : "text-ink-2 hover:bg-card/60", focus && (i === index ? "border-teal" : "border-line"))}>
                    <span className={clsx("grid size-5 shrink-0 place-items-center rounded-full text-[0.65rem]", done ? "bg-teal text-white dark:text-paper" : "border border-line-strong")}>
                      {done ? "✓" : i + 1}
                    </span>
                    {!focus && <span className="truncate">{b.type === "challenge" ? b.challenge.title : BLOCK_LABEL[b.type]}</span>}
                    {focus && <span>{BLOCK_LABEL[b.type]}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 lg:hidden" aria-hidden="true">
            {blocks.map((b, i) => <span key={b.id} className={clsx("h-1.5 flex-1 rounded-full", i === index ? "bg-teal" : isDone(b, responses, ctx.passed) ? "bg-teal/40" : "bg-line")} />)}
          </div>
          <Card className={clsx(focus ? "p-4" : "p-5 sm:p-7")}>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">Step {index + 1} of {blocks.length} · {BLOCK_LABEL[block.type]}</p>
            <BlockView key={block.id} lesson={lesson} block={block} responses={responses} setResponse={(id, r) => setResponses((s) => ({ ...s, [id]: r }))} focus={focus} />
          </Card>

          <div className="mt-4 flex items-center justify-between gap-3">
            <Button tone="ghost" onClick={() => go(index - 1)} disabled={index === 0}>← {t("common.back")}</Button>
            {last ? (
              <Button size="lg" onClick={complete} loading={completing}><Icon name="trophy" className="size-5" /> Complete lesson</Button>
            ) : (
              <Button size="lg" onClick={() => go(index + 1)}>{t("common.next")} →</Button>
            )}
          </div>
          {error && <p className="mt-2 text-bad" role="alert">{error}</p>}
          {result && (
            <div className="mt-5">
              <CompletionPanel lesson={lesson} result={result} onJump={(id) => go(blocks.findIndex((b) => b.id === id))} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LessonPlayer({ lesson, defaultMode }: { lesson: Lesson; defaultMode: "adventure" | "focus" }) {
  return (
    <LessonProvider
      slug={lesson.slug}
      initialDrafts={lesson.progress?.drafts ?? {}}
      initialHints={lesson.progress?.hints ?? {}}
      initialPassed={lesson.progress?.completion.passed_challenges ?? []}
      initialMode={defaultMode}
    >
      <Player lesson={lesson} />
    </LessonProvider>
  );
}
