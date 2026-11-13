"use client";

import clsx from "clsx";
import Link from "next/link";
import { Icon } from "@/components/ui";
import type { LessonSummary, World } from "@/lib/types";

export const WORLD_TONE: Record<string, { bg: string; text: string; soft: string; stroke: string }> = {
  coral: { bg: "bg-coral", text: "text-coral", soft: "bg-coral-soft", stroke: "var(--coral)" },
  teal: { bg: "bg-teal", text: "text-teal", soft: "bg-teal-soft", stroke: "var(--teal)" },
  violet: { bg: "bg-violet", text: "text-violet", soft: "bg-violet-soft", stroke: "var(--violet)" },
  navy: { bg: "bg-blue", text: "text-blue", soft: "bg-blue-soft", stroke: "var(--blue)" },
  gold: { bg: "bg-gold", text: "text-gold", soft: "bg-gold-soft", stroke: "var(--gold)" },
};

const KIND_ICON: Record<string, string> = { lesson: "bulb", mission: "star", boss: "flame", capstone: "trophy" };

function nodeLabel(l: LessonSummary) {
  const st = { completed: "completed", in_progress: "in progress", available: "ready to start", locked: "locked" }[l.status];
  return `${l.title} — ${l.kind}, ${st}${l.lock_reason ? `. ${l.lock_reason}` : ""}`;
}

/**
 * A winding trail of lesson nodes per world. Nodes are real links (keyboard + screen-reader friendly);
 * the SVG path is decorative.
 */
export function WorldTrail({ world, highlight }: { world: World; highlight?: string | null }) {
  const tone = WORLD_TONE[world.theme] ?? WORLD_TONE.teal;
  const lessons = world.modules.flatMap((m) => m.lessons);
  const W = 120;
  const points = lessons.map((_, i) => ({ x: 60 + i * W, y: i % 2 === 0 ? 46 : 96 }));
  const width = Math.max(points.length * W, 240);
  const path = points.map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `S${p.x - W / 2} ${p.y} ${p.x} ${p.y}`)).join(" ");
  const doneIdx = lessons.reduce((acc, l, i) => (l.status === "completed" ? i : acc), -1);

  if (!world.is_available) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-5 text-ink-2">
        <Icon name="lock" className="size-5 shrink-0" />
        <p>
          <b>Being built.</b> {world.prerequisite_note} Stages: {world.description}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative" style={{ width, height: 150 }}>
        <svg width={width} height={150} className="absolute inset-0" aria-hidden="true">
          <path d={path} stroke="var(--line-strong)" strokeWidth="6" strokeDasharray="2 12" strokeLinecap="round" fill="none" />
          {doneIdx >= 0 && (
            <path
              d={points.slice(0, doneIdx + 1).map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `S${p.x - W / 2} ${p.y} ${p.x} ${p.y}`)).join(" ")}
              stroke={tone.stroke}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </svg>
        <ol className="contents">
          {lessons.map((l, i) => {
            const p = points[i];
            const locked = l.status === "locked";
            const node = (
              <span
                className={clsx(
                  "grid size-14 place-items-center rounded-2xl border-[3px] shadow-card transition",
                  l.status === "completed" && `${tone.bg} border-transparent text-white dark:text-paper`,
                  l.status === "in_progress" && `border-current bg-card ${tone.text}`,
                  l.status === "available" && `border-current bg-card ${tone.text} animate-float`,
                  locked && "border-line bg-paper-2 text-ink-3",
                  highlight === l.slug && "ring-4 ring-gold/60",
                  l.kind === "capstone" && "size-16 rounded-full",
                )}
              >
                <Icon name={locked ? "lock" : l.status === "completed" ? "check" : KIND_ICON[l.kind]} className="size-6" />
              </span>
            );
            return (
              <li key={l.slug} className="absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" style={{ left: p.x, top: p.y + 10 }}>
                {locked ? (
                  <span aria-label={nodeLabel(l)} title={l.lock_reason ?? undefined} role="img">
                    {node}
                  </span>
                ) : (
                  <Link href={`/learn/${l.slug}`} aria-label={nodeLabel(l)} className="rounded-2xl">
                    {node}
                  </Link>
                )}
                <span className={clsx("mt-1.5 line-clamp-2 text-xs font-semibold leading-tight", locked ? "text-ink-3" : "text-ink")}>{l.title.replace(/^(Mission|Capstone): /, "")}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export function WorldHeader({ world }: { world: World }) {
  const tone = WORLD_TONE[world.theme] ?? WORLD_TONE.teal;
  return (
    <div className="flex items-start gap-4">
      <span className={clsx("grid size-12 shrink-0 place-items-center rounded-2xl font-display text-xl font-extrabold text-white dark:text-paper", tone.bg)}>{world.order}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-bold">{world.title}</h3>
          {world.is_available ? (
            <span className="text-sm text-ink-3">
              {world.completed_count}/{world.lesson_count} complete
            </span>
          ) : (
            <span className="rounded-full bg-paper-2 px-2 py-0.5 text-xs font-semibold text-ink-3">Being built</span>
          )}
        </div>
        <p className="text-ink-2">{world.tagline}</p>
      </div>
    </div>
  );
}
