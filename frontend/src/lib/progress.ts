import type { LevelInfo } from "./types";

/** Mirrors backend progression.level_info: level L starts at 50·L·(L−1) XP. */
export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  while (xp >= 50 * (level + 1) * level) level++;
  const floor = 50 * level * (level - 1);
  const ceiling = 50 * (level + 1) * level;
  return { level, xp, level_floor: floor, next_level_at: ceiling, progress: (xp - floor) / (ceiling - floor) };
}

/** Lets any component announce that XP changed so the header refreshes. */
export function announceXp() {
  window.dispatchEvent(new Event("cv:xp"));
}
