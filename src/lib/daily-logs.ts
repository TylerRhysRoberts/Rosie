import { supabase } from "@/integrations/supabase/client";

export type HealthScore = 1 | 2 | 3;
export type DosageSize = "whole" | "half" | "quarter" | "eighth";
export type RoutineType = "routine" | "non_routine";

export const SYMPTOM_OPTIONS = [
  "Squelching",
  "Lethargy",
  "Loose Stool",
  "Reduced Appetite",
  "Vomiting",
  "Pain or Suffering",
  "None (Normal)",
] as const;

export type Symptom = (typeof SYMPTOM_OPTIONS)[number];

export const MEDICATION_NAMES = [
  "Medrone",
  "Sulfasalazine",
  "Famotidine",
  "Probiotic",
] as const;

export type MedicationName = (typeof MEDICATION_NAMES)[number];

export const LOCATION_OPTIONS = [
  "Home",
  "Carol's",
  "Jenna's",
  "Simon's",
  "Other",
] as const;

export const DOSAGE_OPTIONS: DosageSize[] = ["whole", "half", "quarter", "eighth"];
export const DOSAGE_LABELS: Record<DosageSize, string> = {
  whole: "Whole",
  half: "Half",
  quarter: "Quarter",
  eighth: "Eighth",
};

export interface Medication {
  taken: boolean;
  dosage: DosageSize;
}

export interface Walk {
  hours: number;
  minutes: number;
}

export interface DailyLog {
  id?: string;
  log_date: string; // YYYY-MM-DD
  health_score: HealthScore;
  symptoms: string[];
  medications: Record<string, Medication>;
  location: string | null;
  routine_type: RoutineType | null;
  walks: Walk[];
  notes: string;
}

export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyMedications(): Record<string, Medication> {
  const out: Record<string, Medication> = {};
  for (const name of MEDICATION_NAMES) out[name] = { taken: false, dosage: "whole" };
  return out;
}

export function emptyLog(date = todayKey()): DailyLog {
  return {
    log_date: date,
    health_score: 2,
    symptoms: [],
    medications: emptyMedications(),
    location: null,
    routine_type: null,
    walks: [],
    notes: "",
  };
}

export const SCORE_META: Record<HealthScore, { label: string; color: string; bg: string; ring: string; emoji: string }> = {
  3: { label: "Good", color: "oklch(0.65 0.18 145)", bg: "oklch(0.93 0.07 145)", ring: "oklch(0.72 0.16 145)", emoji: "😊" },
  2: { label: "Neutral", color: "oklch(0.62 0.17 75)", bg: "oklch(0.95 0.06 80)", ring: "oklch(0.78 0.15 75)", emoji: "😐" },
  1: { label: "Poor", color: "oklch(0.58 0.20 25)", bg: "oklch(0.94 0.05 25)", ring: "oklch(0.68 0.20 25)", emoji: "☹️" },
};

// ───────── Cloud ─────────

export async function fetchLogs(userId: string, limitDays = 180): Promise<DailyLog[]> {
  const since = new Date();
  since.setDate(since.getDate() - limitDays);
  const sinceStr = since.toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", sinceStr)
    .order("log_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToLog);
}

export async function fetchLogByDate(userId: string, date: string): Promise<DailyLog | null> {
  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", date)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToLog(data) : null;
}

export async function upsertLog(userId: string, log: DailyLog): Promise<DailyLog> {
  const payload: any = {
    user_id: userId,
    log_date: log.log_date,
    health_score: log.health_score,
    symptoms: log.symptoms,
    medications: log.medications,
    location: log.location,
    routine_type: log.routine_type,
    walks: log.walks,
    notes: log.notes,
  };
  const { data, error } = await supabase
    .from("daily_logs")
    .upsert([payload], { onConflict: "user_id,log_date" })
    .select()
    .single();
  if (error) throw error;
  return rowToLog(data);
}

function rowToLog(r: any): DailyLog {
  return {
    id: r.id,
    log_date: r.log_date,
    health_score: r.health_score as HealthScore,
    symptoms: r.symptoms ?? [],
    medications: { ...emptyMedications(), ...(r.medications ?? {}) },
    location: r.location,
    routine_type: r.routine_type,
    walks: r.walks ?? [],
    notes: r.notes ?? "",
  };
}

export function averageScore(logs: DailyLog[], days: number): number | null {
  if (logs.length === 0) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const recent = logs.filter((l) => l.log_date >= cutoffStr);
  if (recent.length === 0) return null;
  return recent.reduce((s, l) => s + l.health_score, 0) / recent.length;
}

export function totalWalkMinutes(walks: Walk[]): number {
  return walks.reduce((s, w) => s + (Number(w.hours) || 0) * 60 + (Number(w.minutes) || 0), 0);
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}