import type { DailyLog } from "./daily-logs";
import { totalWalkMinutes } from "./daily-logs";

export type AchievementCategory =
  | "Consistency"
  | "Walking"
  | "Health Management"
  | "Nutrition"
  | "Routine"
  | "Surprise Milestones";

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  criteria: string;
  category: AchievementCategory;
  icon: string; // lucide icon name
  color: string; // CSS color for unlocked tint
  evaluate: (ctx: EvalCtx) => boolean;
  progress: (ctx: EvalCtx) => AchievementProgress;
}

export interface EvalCtx {
  logs: DailyLog[]; // sorted ascending by date
  now: Date;
  /** Was the most recently saved log committed between 23:00 and 04:00? */
  savedAtNight: boolean;
  /** Did the most recently saved log occur > 3h after its initial creation? */
  savedAsLateEdit: boolean;
  /** Achievement-id → existing progress snapshots (for cumulative counters). */
  meta: Record<string, number>;
}

// ─────────── helpers ───────────

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}
function maxConsecutive(predicate: (l: DailyLog) => boolean, logs: DailyLog[]): number {
  // logs ascending. Streak across consecutive calendar days where predicate(l) is true.
  let best = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const l of logs) {
    if (!predicate(l)) { cur = 0; prev = null; continue; }
    if (prev && diffDays(prev, l.log_date) === 1) cur += 1;
    else cur = 1;
    prev = l.log_date;
    if (cur > best) best = cur;
  }
  return best;
}
function countDays(predicate: (l: DailyLog) => boolean, logs: DailyLog[]): number {
  let n = 0; for (const l of logs) if (predicate(l)) n += 1; return n;
}
function completedWalks(l: DailyLog): number {
  return (l.walks ?? []).filter((w) => w.completed).length;
}
function isNoIssues(arr: string[] | undefined): boolean {
  return !!arr && arr.length === 1 && arr[0] === "No Issues";
}
function isFormedOnly(arr: string[] | undefined): boolean {
  return !!arr && arr.length === 1 && arr[0] === "formed";
}
function isBadStool(arr: string[] | undefined): boolean {
  return !!arr && (arr.includes("liquid") || arr.includes("blood"));
}
function streakLen(p: (l: DailyLog) => boolean, logs: DailyLog[]): number {
  return maxConsecutive(p, logs);
}

// Walking daily target — kept loose: 60 minutes/day completed walk duration
const DAILY_WALK_TARGET_MIN = 60;

// ─────────── master list ───────────

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Consistency ──────────────────────────────────────────────
  {
    id: "log_str_30", name: "Monthly Historian",
    description: "A month of unbroken daily logging — Rosie's story, day by day.",
    criteria: "Log data for 30 consecutive calendar days.",
    category: "Consistency", icon: "CalendarCheck", color: "oklch(0.72 0.16 30)",
    evaluate: (c) => streakLen(() => true, c.logs) >= 30,
    progress: (c) => ({ current: Math.min(streakLen(() => true, c.logs), 30), target: 30 }),
  },
  {
    id: "log_str_90", name: "Quarterly Archivist",
    description: "Three months straight — habits become history.",
    criteria: "Log data for 90 consecutive calendar days.",
    category: "Consistency", icon: "BookOpen", color: "oklch(0.65 0.18 250)",
    evaluate: (c) => streakLen(() => true, c.logs) >= 90,
    progress: (c) => ({ current: Math.min(streakLen(() => true, c.logs), 90), target: 90 }),
  },
  {
    id: "log_cum_365", name: "The Full Orbit",
    description: "365 days of total tracking — a full lap of the sun.",
    criteria: "Reach 365 total cumulative days logged.",
    category: "Consistency", icon: "Globe2", color: "oklch(0.70 0.15 200)",
    evaluate: (c) => c.logs.length >= 365,
    progress: (c) => ({ current: Math.min(c.logs.length, 365), target: 365 }),
  },
  {
    id: "log_str_500", name: "Half-Millennium Anchor",
    description: "500 days without missing a beat.",
    criteria: "Log data for 500 consecutive calendar days.",
    category: "Consistency", icon: "Anchor", color: "oklch(0.55 0.15 240)",
    evaluate: (c) => streakLen(() => true, c.logs) >= 500,
    progress: (c) => ({ current: Math.min(streakLen(() => true, c.logs), 500), target: 500 }),
  },
  {
    id: "log_cum_1000", name: "The Millennium Mark",
    description: "One thousand days of dedicated care.",
    criteria: "Reach 1,000 total cumulative days logged.",
    category: "Consistency", icon: "Crown", color: "oklch(0.75 0.16 80)",
    evaluate: (c) => c.logs.length >= 1000,
    progress: (c) => ({ current: Math.min(c.logs.length, 1000), target: 1000 }),
  },

  // ── Walking ──────────────────────────────────────────────
  {
    id: "walk_freq_double", name: "Double Header Master",
    description: "Twice-a-day walkies, again and again.",
    criteria: "Log 2+ separate walk entries in a single day, 25 times total.",
    category: "Walking", icon: "Footprints", color: "oklch(0.65 0.18 145)",
    evaluate: (c) => countDays((l) => completedWalks(l) >= 2, c.logs) >= 25,
    progress: (c) => ({ current: Math.min(countDays((l) => completedWalks(l) >= 2, c.logs), 25), target: 25 }),
  },
  {
    id: "walk_freq_triple", name: "Hat-Trick Hero",
    description: "Three walks in one day — legendary.",
    criteria: "Log 3+ separate walk entries in a single day, 10 times total.",
    category: "Walking", icon: "Medal", color: "oklch(0.70 0.18 60)",
    evaluate: (c) => countDays((l) => completedWalks(l) >= 3, c.logs) >= 10,
    progress: (c) => ({ current: Math.min(countDays((l) => completedWalks(l) >= 3, c.logs), 10), target: 10 }),
  },
  {
    id: "walk_cum_100", name: "Basecamp Reached",
    description: "100 walks tracked — you're on your way.",
    criteria: "Reach 100 completed walk entries.",
    category: "Walking", icon: "Mountain", color: "oklch(0.60 0.12 160)",
    evaluate: (c) => sumCompletedWalks(c.logs) >= 100,
    progress: (c) => ({ current: Math.min(sumCompletedWalks(c.logs), 100), target: 100 }),
  },
  {
    id: "walk_cum_500", name: "Mountain Pathfinder",
    description: "Five hundred walks — paths well worn.",
    criteria: "Reach 500 completed walk entries.",
    category: "Walking", icon: "MountainSnow", color: "oklch(0.55 0.12 220)",
    evaluate: (c) => sumCompletedWalks(c.logs) >= 500,
    progress: (c) => ({ current: Math.min(sumCompletedWalks(c.logs), 500), target: 500 }),
  },
  {
    id: "walk_cum_1500", name: "Great British Trekker",
    description: "1,500 walks logged. From coast to coast and back.",
    criteria: "Reach 1,500 completed walk entries.",
    category: "Walking", icon: "Flag", color: "oklch(0.60 0.18 25)",
    evaluate: (c) => sumCompletedWalks(c.logs) >= 1500,
    progress: (c) => ({ current: Math.min(sumCompletedWalks(c.logs), 1500), target: 1500 }),
  },
  {
    id: "walk_tgt_30", name: "Bullseye Month",
    description: "30 days straight of hitting Rosie's walk target.",
    criteria: `Hit the daily walk duration target (${DAILY_WALK_TARGET_MIN}+ min) for 30 consecutive days.`,
    category: "Walking", icon: "Target", color: "oklch(0.65 0.20 15)",
    evaluate: (c) => streakLen((l) => totalWalkMinutes(l.walks) >= DAILY_WALK_TARGET_MIN, c.logs) >= 30,
    progress: (c) => ({
      current: Math.min(streakLen((l) => totalWalkMinutes(l.walks) >= DAILY_WALK_TARGET_MIN, c.logs), 30),
      target: 30,
    }),
  },

  // ── Health Management ──────────────────────────────────────────────
  {
    id: "symp_free_14", name: "Fortnight of Calm",
    description: "Two weeks of pure, symptom-free days.",
    criteria: "14 consecutive days logged with No Issues in symptoms.",
    category: "Health Management", icon: "Leaf", color: "oklch(0.70 0.15 145)",
    evaluate: (c) => streakLen((l) => isNoIssues(l.symptoms), c.logs) >= 14,
    progress: (c) => ({ current: Math.min(streakLen((l) => isNoIssues(l.symptoms), c.logs), 14), target: 14 }),
  },
  {
    id: "symp_free_30", name: "Golden Month",
    description: "An entire month free of symptoms — beautiful.",
    criteria: "30 consecutive days logged with No Issues in symptoms.",
    category: "Health Management", icon: "Sun", color: "oklch(0.78 0.16 85)",
    evaluate: (c) => streakLen((l) => isNoIssues(l.symptoms), c.logs) >= 30,
    progress: (c) => ({ current: Math.min(streakLen((l) => isNoIssues(l.symptoms), c.logs), 30), target: 30 }),
  },
  {
    id: "flare_free_90", name: "Iron Defence",
    description: "Three months without a single flare-up.",
    criteria: "90 consecutive days with no flare-up.",
    category: "Health Management", icon: "Shield", color: "oklch(0.55 0.15 240)",
    evaluate: (c) => streakLen((l) => !l.flare_up, c.logs) >= 90,
    progress: (c) => ({ current: Math.min(streakLen((l) => !l.flare_up, c.logs), 90), target: 90 }),
  },
  {
    id: "flare_free_180", name: "The Long Peace",
    description: "Half a year of calm.",
    criteria: "180 consecutive days with no flare-up.",
    category: "Health Management", icon: "ShieldCheck", color: "oklch(0.55 0.15 200)",
    evaluate: (c) => streakLen((l) => !l.flare_up, c.logs) >= 180,
    progress: (c) => ({ current: Math.min(streakLen((l) => !l.flare_up, c.logs), 180), target: 180 }),
  },
  {
    id: "flare_free_365", name: "Perpetual Sanctuary",
    description: "A whole year without a flare-up. Extraordinary.",
    criteria: "365 consecutive days with no flare-up.",
    category: "Health Management", icon: "Sparkles", color: "oklch(0.75 0.16 80)",
    evaluate: (c) => streakLen((l) => !l.flare_up, c.logs) >= 365,
    progress: (c) => ({ current: Math.min(streakLen((l) => !l.flare_up, c.logs), 365), target: 365 }),
  },
  {
    id: "recovery_bounce", name: "Bounce-Back Vanguard",
    description: "Rapid recoveries after rough days.",
    criteria: "10 times logged No Issues the day after a flare-up day.",
    category: "Health Management", icon: "Zap", color: "oklch(0.70 0.18 60)",
    evaluate: (c) => countBounces(c.logs) >= 10,
    progress: (c) => ({ current: Math.min(countBounces(c.logs), 10), target: 10 }),
  },

  // ── Nutrition ──────────────────────────────────────────────
  {
    id: "dins_100_14", name: "Clean Plate Fortnight",
    description: "Two weeks of every dinner cleared.",
    criteria: "Dinner % at 100 for 14 consecutive days.",
    category: "Nutrition", icon: "Utensils", color: "oklch(0.65 0.18 30)",
    evaluate: (c) => streakLen((l) => l.dins_percent === 100, c.logs) >= 14,
    progress: (c) => ({ current: Math.min(streakLen((l) => l.dins_percent === 100, c.logs), 14), target: 14 }),
  },
  {
    id: "dins_100_30", name: "Flawless Appetite Month",
    description: "Thirty straight days of perfect dinners.",
    criteria: "Dinner % at 100 for 30 consecutive days.",
    category: "Nutrition", icon: "ChefHat", color: "oklch(0.70 0.16 50)",
    evaluate: (c) => streakLen((l) => l.dins_percent === 100, c.logs) >= 30,
    progress: (c) => ({ current: Math.min(streakLen((l) => l.dins_percent === 100, c.logs), 30), target: 30 }),
  },
  {
    id: "dins_cum_100", name: "The Century Feast",
    description: "100 perfect dinners served and devoured.",
    criteria: "100 cumulative days at 100% dinner.",
    category: "Nutrition", icon: "Cookie", color: "oklch(0.65 0.16 40)",
    evaluate: (c) => countDays((l) => l.dins_percent === 100, c.logs) >= 100,
    progress: (c) => ({ current: Math.min(countDays((l) => l.dins_percent === 100, c.logs), 100), target: 100 }),
  },
  {
    id: "dins_cum_500", name: "Infinite Gourmet",
    description: "500 perfect dinners. Chef's kiss.",
    criteria: "500 cumulative days at 100% dinner.",
    category: "Nutrition", icon: "Salad", color: "oklch(0.65 0.18 145)",
    evaluate: (c) => countDays((l) => l.dins_percent === 100, c.logs) >= 500,
    progress: (c) => ({ current: Math.min(countDays((l) => l.dins_percent === 100, c.logs), 500), target: 500 }),
  },

  // ── Routine ──────────────────────────────────────────────
  {
    id: "time_night", name: "Midnight Sentry",
    description: "Logging late-night devotion.",
    criteria: "Submit a log between 11pm–4am, 30 times in total.",
    category: "Routine", icon: "Moon", color: "oklch(0.55 0.15 280)",
    evaluate: (c) => (c.meta.time_night ?? 0) >= 30,
    progress: (c) => ({ current: Math.min(c.meta.time_night ?? 0, 30), target: 30 }),
  },
  {
    id: "mode_holiday", name: "Jet Setter",
    description: "Two weeks of holiday mode — adventures together.",
    criteria: "Holiday mode on for 14 consecutive days.",
    category: "Routine", icon: "Plane", color: "oklch(0.65 0.16 220)",
    evaluate: (c) => streakLen((l) => !!l.holiday_mode, c.logs) >= 14,
    progress: (c) => ({ current: Math.min(streakLen((l) => !!l.holiday_mode, c.logs), 14), target: 14 }),
  },
  {
    id: "treat_variety", name: "Connoisseur's Selection",
    description: "Five distinct treats across history.",
    criteria: "Log 5 unique treat names across all entries.",
    category: "Routine", icon: "Cookie", color: "oklch(0.65 0.16 35)",
    evaluate: (c) => uniqueTreats(c.logs).size >= 5,
    progress: (c) => ({ current: Math.min(uniqueTreats(c.logs).size, 5), target: 5 }),
  },

  // ── Surprise Milestones ──────────────────────────────────────────────
  {
    id: "health_peak_7", name: "Seventh Heaven",
    description: "A whole week of Good health scores.",
    criteria: "Health score Good for 7 consecutive days.",
    category: "Surprise Milestones", icon: "HeartPulse", color: "oklch(0.65 0.18 145)",
    evaluate: (c) => streakLen((l) => l.health_score === 3, c.logs) >= 7,
    progress: (c) => ({ current: Math.min(streakLen((l) => l.health_score === 3, c.logs), 7), target: 7 }),
  },
  {
    id: "med_streak_30", name: "Rx Commander",
    description: "A month of perfect medication adherence.",
    criteria: "All scheduled medications taken for 30 consecutive days.",
    category: "Surprise Milestones", icon: "Pill", color: "oklch(0.65 0.16 5)",
    evaluate: (c) => streakLen((l) => allScheduledMedsTaken(l, c.logs), c.logs) >= 30,
    progress: (c) => ({
      current: Math.min(streakLen((l) => allScheduledMedsTaken(l, c.logs), c.logs), 30),
      target: 30,
    }),
  },
  {
    id: "stool_perfect_14", name: "Textbook Digestion",
    description: "Two textbook weeks.",
    criteria: "14 consecutive days of No Issues stool consistency.",
    category: "Surprise Milestones", icon: "Sparkle", color: "oklch(0.70 0.15 145)",
    evaluate: (c) => streakLen((l) => isFormedOnly(l.stool_consistency), c.logs) >= 14,
    progress: (c) => ({
      current: Math.min(streakLen((l) => isFormedOnly(l.stool_consistency), c.logs), 14),
      target: 14,
    }),
  },
  {
    id: "stool_recovery", name: "The Great Turnaround",
    description: "Quick recoveries after rough days.",
    criteria: "No Issues stool the day after a Liquid/Blood log, 5 times.",
    category: "Surprise Milestones", icon: "RefreshCw", color: "oklch(0.65 0.16 200)",
    evaluate: (c) => countStoolRecoveries(c.logs) >= 5,
    progress: (c) => ({ current: Math.min(countStoolRecoveries(c.logs), 5), target: 5 }),
  },
  {
    id: "weekend_warrior", name: "Weekend Warrior",
    description: "Four weekends of double-walks across both days.",
    criteria: "Sat AND Sun both with 2+ completed walks, 4 weekends in a row.",
    category: "Surprise Milestones", icon: "Swords", color: "oklch(0.60 0.18 25)",
    evaluate: (c) => weekendWarriorStreak(c.logs) >= 4,
    progress: (c) => ({ current: Math.min(weekendWarriorStreak(c.logs), 4), target: 4 }),
  },
  {
    id: "treat_discipline", name: "Zen Master",
    description: "Disciplined days of treat-free harmony.",
    criteria: "No Issues symptoms + zero treats, 10 times.",
    category: "Surprise Milestones", icon: "Flower2", color: "oklch(0.70 0.14 280)",
    evaluate: (c) => countDays((l) => isNoIssues(l.symptoms) && (l.treats?.length ?? 0) === 0, c.logs) >= 10,
    progress: (c) => ({
      current: Math.min(countDays((l) => isNoIssues(l.symptoms) && (l.treats?.length ?? 0) === 0, c.logs), 10),
      target: 10,
    }),
  },
  {
    id: "update_diligent", name: "Perfectionist Editor",
    description: "Refining the record long after the fact.",
    criteria: "Edit a log 3+ hours after first creating it, 15 times.",
    category: "Surprise Milestones", icon: "PencilLine", color: "oklch(0.60 0.15 260)",
    evaluate: (c) => (c.meta.update_diligent ?? 0) >= 15,
    progress: (c) => ({ current: Math.min(c.meta.update_diligent ?? 0, 15), target: 15 }),
  },
  {
    id: "perfectionist_30", name: "Data Completeness Vanguard",
    description: "Full-spectrum days — every module covered.",
    criteria: "30 days where Medications, Walks, Food, Symptoms, Stools are all filled.",
    category: "Surprise Milestones", icon: "CheckCircle2", color: "oklch(0.65 0.18 145)",
    evaluate: (c) => countDays(isFullyComplete, c.logs) >= 30,
    progress: (c) => ({ current: Math.min(countDays(isFullyComplete, c.logs), 30), target: 30 }),
  },
];

// ─────────── helpers used above ───────────

function sumCompletedWalks(logs: DailyLog[]): number {
  let n = 0; for (const l of logs) n += completedWalks(l); return n;
}
function countBounces(logs: DailyLog[]): number {
  let n = 0;
  for (let i = 1; i < logs.length; i++) {
    const prev = logs[i - 1], curr = logs[i];
    if (diffDays(prev.log_date, curr.log_date) !== 1) continue;
    if (prev.flare_up && isNoIssues(curr.symptoms)) n += 1;
  }
  return n;
}
function countStoolRecoveries(logs: DailyLog[]): number {
  let n = 0;
  for (let i = 1; i < logs.length; i++) {
    const prev = logs[i - 1], curr = logs[i];
    if (diffDays(prev.log_date, curr.log_date) !== 1) continue;
    if (isBadStool(prev.stool_consistency) && isFormedOnly(curr.stool_consistency)) n += 1;
  }
  return n;
}
function uniqueTreats(logs: DailyLog[]): Set<string> {
  const s = new Set<string>();
  for (const l of logs) for (const t of l.treats ?? []) if (t && typeof t === "string") s.add(t.trim());
  return s;
}
function scheduledMeds(logs: DailyLog[]): Set<string> {
  // Any med taken at least once across history is considered "scheduled".
  const s = new Set<string>();
  for (const l of logs) {
    for (const [name, m] of Object.entries(l.medications ?? {})) {
      if ((m as any)?.taken) s.add(name);
    }
  }
  return s;
}
function allScheduledMedsTaken(l: DailyLog, allLogs: DailyLog[]): boolean {
  const sched = scheduledMeds(allLogs);
  if (sched.size === 0) return false;
  for (const name of sched) {
    if (!(l.medications?.[name] as any)?.taken) return false;
  }
  return true;
}
function weekendWarriorStreak(logs: DailyLog[]): number {
  // Group by week starting Saturday. For each weekend pair (Sat & Sun) require >=2 completed walks each.
  const byDate = new Map<string, DailyLog>();
  for (const l of logs) byDate.set(l.log_date, l);
  // Find all Saturdays in logged range
  const weekends: { sat: string; sun: string }[] = [];
  for (const l of logs) {
    const dow = parseDate(l.log_date).getDay();
    if (dow !== 6) continue; // 6=Sat
    const satD = parseDate(l.log_date);
    const sunD = new Date(satD); sunD.setDate(sunD.getDate() + 1);
    const sunKey = `${sunD.getFullYear()}-${String(sunD.getMonth() + 1).padStart(2, "0")}-${String(sunD.getDate()).padStart(2, "0")}`;
    weekends.push({ sat: l.log_date, sun: sunKey });
  }
  let best = 0, cur = 0;
  let prevSat: string | null = null;
  for (const wkd of weekends) {
    const sat = byDate.get(wkd.sat);
    const sun = byDate.get(wkd.sun);
    const ok = sat && sun && completedWalks(sat) >= 2 && completedWalks(sun) >= 2;
    if (!ok) { cur = 0; prevSat = null; continue; }
    if (prevSat && diffDays(prevSat, wkd.sat) === 7) cur += 1;
    else cur = 1;
    prevSat = wkd.sat;
    if (cur > best) best = cur;
  }
  return best;
}
function isFullyComplete(l: DailyLog): boolean {
  const medsScheduled = Object.values(l.medications ?? {}).some((m: any) => m?.taken);
  const hasWalks = (l.walks ?? []).some((w) => w.completed);
  const hasFood = typeof l.dins_percent === "number" && l.dins_percent > 0;
  const hasSymp = (l.symptoms ?? []).length > 0;
  const hasStool = (l.stool_consistency ?? []).length > 0;
  return medsScheduled && hasWalks && hasFood && hasSymp && hasStool;
}

// ─────────── public entry ───────────

export function evaluateAchievements(ctx: EvalCtx, existing: Set<string>): AchievementDef[] {
  const newly: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (existing.has(a.id)) continue;
    try { if (a.evaluate(ctx)) newly.push(a); } catch { /* ignore individual eval errors */ }
  }
  return newly;
}

export function getAchievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  "Consistency", "Walking", "Health Management", "Nutrition", "Routine", "Surprise Milestones",
];