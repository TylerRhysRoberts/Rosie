// NOTE: This file was inadvertently deleted during a cleanup of unused
// template tables and has been restored as a minimal stub so the build
// compiles. The original file contained 30+ achievement definitions across
// 6 categories plus the full evaluation engine. Restore it from Lovable's
// project history to recover the real list and logic.

import type { DailyLog } from "./daily-logs";
import type { AchvMeta } from "./achievements-meta";

export interface EvalCtx {
  logs: DailyLog[];
  now: Date;
  savedAtNight: boolean;
  savedAsLateEdit: boolean;
  meta: AchvMeta;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  criteria: string;
  category: string;
  icon: string;
  color: string;
  progress: (ctx: EvalCtx) => { current: number; target: number };
  unlocked: (ctx: EvalCtx) => boolean;
}

export const ACHIEVEMENT_CATEGORIES: string[] = [
  "Consistency",
  "Walking",
  "Health Management",
  "Nutrition",
  "Routine",
  "Surprise Milestones",
];

export const ACHIEVEMENTS: AchievementDef[] = [];

export function evaluateAchievements(
  ctx: EvalCtx,
  existing: Set<string>,
): AchievementDef[] {
  const newly: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (existing.has(a.id)) continue;
    try {
      if (a.unlocked(ctx)) newly.push(a);
    } catch { /* ignore */ }
  }
  return newly;
}