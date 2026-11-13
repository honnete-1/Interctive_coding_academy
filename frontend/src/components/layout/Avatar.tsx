import type { Profile } from "@/lib/types";

export const AVATAR_COLORS = ["#0f766e", "#c2441f", "#1d4ed8", "#a8660a", "#6d3fc0", "#15803d"];
export const AVATAR_BASES = ["round", "square", "spark"] as const;
export const AVATAR_ACCESSORIES = [
  { id: "none", label: "None", unlock: null },
  { id: "cap", label: "Rider cap", unlock: "robot-navigator" },
  { id: "glasses", label: "Debug glasses", unlock: "bug-detective" },
  { id: "crown", label: "Builder crown", unlock: "python-builder" },
] as const;

/** Learner avatar: a friendly geometric character. Accessories are cosmetic unlocks only. */
export function Avatar({ avatar, name, size = 40 }: { avatar: Profile["avatar"]; name: string; size?: number }) {
  const color = avatar.color ?? AVATAR_COLORS[0];
  const base = avatar.base ?? "round";
  const accessory = avatar.accessory ?? "none";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${name}'s avatar`}>
      {base === "round" && <circle cx="32" cy="34" r="24" fill={color} />}
      {base === "square" && <rect x="9" y="11" width="46" height="46" rx="14" fill={color} />}
      {base === "spark" && <path d="M32 8 39 25 56 32 39 39 32 56 25 39 8 32 25 25Z" fill={color} />}
      <circle cx="24.5" cy="32" r="3.4" fill="#fffdf8" />
      <circle cx="39.5" cy="32" r="3.4" fill="#fffdf8" />
      <circle cx="25.2" cy="32.6" r="1.6" fill="#15213b" />
      <circle cx="40.2" cy="32.6" r="1.6" fill="#15213b" />
      <path d="M26 42c3.5 3 8.5 3 12 0" stroke="#fffdf8" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      {accessory === "cap" && <path d="M14 22c4-9 32-9 36 0v3H14Zm32 3h10" stroke="#15213b" strokeWidth="2.5" fill="#f2a541" />}
      {accessory === "glasses" && (
        <g stroke="#15213b" strokeWidth="2.4" fill="none">
          <circle cx="24.5" cy="32" r="6.5" />
          <circle cx="39.5" cy="32" r="6.5" />
          <path d="M31 32h2" />
        </g>
      )}
      {accessory === "crown" && <path d="M18 18 22 6l6 8 4-10 4 10 6-8 4 12Z" fill="#f2a541" stroke="#15213b" strokeWidth="2" />}
    </svg>
  );
}
