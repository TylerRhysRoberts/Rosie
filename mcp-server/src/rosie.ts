// Rosie's daily log model and the rules the app applies when it saves a day.
//
// These mirror src/lib/daily-logs.ts and the persist() step in src/routes/app.tsx.
// They are copied rather than imported because the app's modules pull in the
// browser Supabase client. If the app's options or save rules change, update
// this file to match.

export type HealthScore = 1 | 2 | 3;
export type DosageSize = "whole" | "half" | "third" | "quarter" | "eighth";
export type RoutineType = "routine" | "non_routine";

export const HEALTH_SCORES: Record<HealthScore, string> = {
  3: "Good",
  2: "Neutral",
  1: "Poor",
};

// Stored value -> meaning. The stored names are historical: "soft" covers soft or
// loose stools (synonyms), and "loose" is the value the app's "Mucus" chip saves.
export const STOOL_OPTIONS = {
  formed: "No Issues",
  soft: "Soft / Loose",
  loose: "Mucus",
  liquid: "Liquid / Diarrhoea",
  blood: "Blood",
  constipation: "Constipation",
} as const;
export type StoolConsistency = keyof typeof STOOL_OPTIONS;
export const STOOL_VALUES = Object.keys(STOOL_OPTIONS) as StoolConsistency[];

export const NO_ISSUES = "No Issues";

export const SYMPTOM_OPTIONS = [
  NO_ISSUES,
  "Squelching",
  "Lethargy",
  "Reduced Appetite",
  "Vomiting",
  "Eating Grass",
] as const;

export const MEDICATION_NAMES = [
  "Medrone",
  "Sulfasalazine",
  "Famotidine",
  "Probiotic",
  "Buscopan",
  "Flea Meds",
  "Worming Meds",
  "Vaccination",
] as const;

export const DEFAULT_DOSAGES: Record<string, DosageSize> = {
  Medrone: "half",
  Probiotic: "whole",
  Sulfasalazine: "quarter",
  Famotidine: "third",
  Buscopan: "whole",
  "Flea Meds": "whole",
  "Worming Meds": "whole",
  Vaccination: "whole",
};

export const DOSAGE_OPTIONS: DosageSize[] = ["whole", "half", "third", "quarter", "eighth"];

export const LOCATION_OPTIONS = ["Home", "Carol's", "Jenna's", "Simon's", "Other", "Away"] as const;
export const DEFAULT_TREATS = ["Cheese", "Crompch", "Yak Chews"] as const;
export const DEFAULT_SCAVENGED = ["Twigs", "Floor Food", "Plants"] as const;

export interface Medication {
  taken: boolean;
  dosage: DosageSize;
  is_rescue?: boolean;
}

export interface Walk {
  hours: number;
  minutes: number;
  completed?: boolean;
}

export interface FlareEvent {
  had_flareup: boolean;
  start_time: string | null;
  end_time: string | null;
  symptoms: string[];
  intervention_med: string | null;
}

export const EMPTY_FLARE_EVENT: FlareEvent = {
  had_flareup: false,
  start_time: null,
  end_time: null,
  symptoms: [],
  intervention_med: null,
};

export interface DailyLog {
  log_date: string;
  health_score: HealthScore;
  flare_up: boolean;
  flare_event: FlareEvent;
  stool_consistency: string[];
  symptoms: string[];
  medications: Record<string, Medication>;
  location: string | null;
  routine_type: RoutineType | null;
  dins_percent: number | null;
  dins_prompting: boolean;
  treats: string[];
  scavenged: string[];
  walks: Walk[];
  notes: string;
  holiday_mode: boolean;
}

/** Today's date in the UK, as YYYY-MM-DD. The Worker runs in UTC, Rosie doesn't. */
export function todayInLondon(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function emptyMedications(): Record<string, Medication> {
  const out: Record<string, Medication> = {};
  for (const name of MEDICATION_NAMES) {
    out[name] = { taken: false, dosage: DEFAULT_DOSAGES[name] ?? "whole", is_rescue: false };
  }
  return out;
}

/** The blank day the app starts from when nothing has been logged yet. */
export function emptyLog(date: string): DailyLog {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const isWeekend = dow === 0 || dow === 6;
  return {
    log_date: date,
    health_score: 3,
    flare_up: false,
    flare_event: { ...EMPTY_FLARE_EVENT },
    stool_consistency: ["formed"],
    symptoms: [NO_ISSUES],
    medications: emptyMedications(),
    location: "Home",
    routine_type: isWeekend ? "non_routine" : "routine",
    dins_percent: null,
    dins_prompting: false,
    treats: ["Cheese"],
    scavenged: [],
    walks: [],
    notes: "",
    holiday_mode: false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToLog(r: any): DailyLog {
  const rawFlare = r.flare_event ?? {};
  const meds = emptyMedications();
  for (const [name, m] of Object.entries((r.medications ?? {}) as Record<string, Partial<Medication>>)) {
    meds[name] = {
      taken: !!m?.taken,
      dosage: (m?.dosage ?? "whole") as DosageSize,
      is_rescue: !!m?.is_rescue,
    };
  }
  return {
    log_date: r.log_date,
    health_score: r.health_score as HealthScore,
    flare_up: !!r.flare_up,
    flare_event: {
      had_flareup: !!rawFlare.had_flareup,
      start_time: rawFlare.start_time ?? null,
      end_time: rawFlare.end_time ?? null,
      symptoms: Array.isArray(rawFlare.symptoms) ? rawFlare.symptoms : [],
      intervention_med: rawFlare.intervention_med ?? null,
    },
    stool_consistency: Array.isArray(r.stool_consistency)
      ? r.stool_consistency
      : r.stool_consistency
        ? [String(r.stool_consistency)]
        : [],
    symptoms: r.symptoms ?? [],
    medications: meds,
    location: r.location ?? null,
    routine_type: r.routine_type ?? null,
    dins_percent: typeof r.dins_percent === "number" ? r.dins_percent : null,
    dins_prompting: !!r.dins_prompting,
    treats: r.treats ?? [],
    scavenged: r.scavenged ?? [],
    walks: r.walks ?? [],
    notes: r.notes ?? "",
    holiday_mode: !!r.holiday_mode,
  };
}

/** A partial update to a day, as Claude would describe it from a chat message. */
export interface LogChanges {
  health_score?: HealthScore;
  add_symptoms?: string[];
  remove_symptoms?: string[];
  stool_consistency?: StoolConsistency[];
  add_walks?: { minutes: number }[];
  replace_walks?: boolean;
  dins_percent?: number | null;
  dins_prompting?: boolean;
  add_treats?: string[];
  remove_treats?: string[];
  add_scavenged?: string[];
  remove_scavenged?: string[];
  medications?: Record<string, { taken: boolean; dosage?: DosageSize; is_rescue?: boolean }>;
  location?: string;
  routine_type?: RoutineType;
  flare?: {
    had_flareup: boolean;
    start_time?: string | null;
    end_time?: string | null;
    intervention_med?: string | null;
  };
  notes?: string;
  notes_mode?: "append" | "replace";
  holiday_mode?: boolean;
}

const unique = (items: string[]) => Array.from(new Set(items));

/**
 * Applies changes on top of an existing day. Anything not mentioned is left as
 * it was, so "she also ate grass" never wipes the walks logged earlier.
 */
export function applyChanges(base: DailyLog, c: LogChanges): DailyLog {
  const log: DailyLog = structuredClone(base);

  if (c.health_score !== undefined) log.health_score = c.health_score;

  if (c.remove_symptoms?.length) {
    log.symptoms = log.symptoms.filter((s) => !c.remove_symptoms!.includes(s));
  }
  if (c.add_symptoms?.length) {
    const adding = c.add_symptoms;
    // Same rule as the app's chips: "No Issues" is exclusive of every other symptom.
    log.symptoms = adding.includes(NO_ISSUES)
      ? [NO_ISSUES]
      : unique([...log.symptoms.filter((s) => s !== NO_ISSUES), ...adding]);
  }
  if (log.symptoms.length === 0) log.symptoms = [NO_ISSUES];

  if (c.stool_consistency?.length) {
    log.stool_consistency = c.stool_consistency.includes("formed") && c.stool_consistency.length > 1
      ? c.stool_consistency.filter((s) => s !== "formed")
      : unique(c.stool_consistency);
  }

  if (c.add_walks || c.replace_walks) {
    const added = (c.add_walks ?? []).map(({ minutes }) => ({
      hours: Math.floor(minutes / 60),
      minutes: minutes % 60,
    }));
    log.walks = c.replace_walks ? added : [...log.walks, ...added];
  }

  if (c.dins_percent !== undefined) log.dins_percent = c.dins_percent;
  if (c.dins_prompting !== undefined) log.dins_prompting = c.dins_prompting;

  if (c.remove_treats?.length) log.treats = log.treats.filter((t) => !c.remove_treats!.includes(t));
  if (c.add_treats?.length) log.treats = unique([...log.treats, ...c.add_treats]);
  if (c.remove_scavenged?.length) log.scavenged = log.scavenged.filter((t) => !c.remove_scavenged!.includes(t));
  if (c.add_scavenged?.length) log.scavenged = unique([...log.scavenged, ...c.add_scavenged]);

  for (const [name, m] of Object.entries(c.medications ?? {})) {
    const current = log.medications[name] ?? { taken: false, dosage: DEFAULT_DOSAGES[name] ?? "whole" };
    log.medications[name] = {
      taken: m.taken,
      dosage: m.dosage ?? current.dosage,
      is_rescue: m.is_rescue ?? current.is_rescue ?? false,
    };
  }

  if (c.location !== undefined) log.location = c.location;
  if (c.routine_type !== undefined) log.routine_type = c.routine_type;

  if (c.flare) {
    log.flare_up = c.flare.had_flareup;
    log.flare_event = c.flare.had_flareup
      ? {
          ...log.flare_event,
          had_flareup: true,
          start_time: c.flare.start_time !== undefined ? c.flare.start_time : log.flare_event.start_time,
          end_time: c.flare.end_time !== undefined ? c.flare.end_time : log.flare_event.end_time,
          intervention_med:
            c.flare.intervention_med !== undefined ? c.flare.intervention_med : log.flare_event.intervention_med,
        }
      : { ...EMPTY_FLARE_EVENT };
  }

  if (c.notes !== undefined) {
    const text = c.notes.trim();
    log.notes = c.notes_mode === "replace" || !log.notes.trim() ? text : text ? `${log.notes.trim()}\n${text}` : log.notes;
  }

  if (c.holiday_mode !== undefined) log.holiday_mode = c.holiday_mode;

  return log;
}

/** The normalisation the app's persist() does just before every save. */
export function prepareForSave(input: DailyLog): DailyLog {
  let log = input;
  if (log.holiday_mode) {
    log = {
      ...log,
      stool_consistency: ["formed"],
      symptoms: [NO_ISSUES],
      dins_percent: 100,
      treats: ["Cheese"],
      scavenged: [],
      walks: [{ hours: 0, minutes: 30, completed: true }],
      routine_type: "non_routine",
      health_score: log.flare_up ? 1 : 2,
      flare_event: log.flare_up
        ? { ...log.flare_event, had_flareup: true, start_time: "00:00", end_time: "23:59" }
        : { ...EMPTY_FLARE_EVENT },
    };
  }
  return {
    ...log,
    walks: log.walks.map((w) => ({
      ...w,
      completed: (Number(w.hours) || 0) * 60 + (Number(w.minutes) || 0) > 0,
    })),
    flare_event: { ...log.flare_event, symptoms: log.flare_up ? [...log.symptoms] : [] },
  };
}

/** Tablets the app deducts from stock for a day's meds (only Medrone and Probiotic are tracked). */
export function inventoryUse(medications: Record<string, Medication>) {
  const medrone = medications.Medrone;
  const probiotic = medications.Probiotic;
  return {
    medrone: medrone?.taken ? (medrone.dosage === "whole" ? 1 : medrone.dosage === "half" ? 0.5 : 0) : 0,
    probiotic: probiotic?.taken && probiotic.dosage === "whole" ? 1 : 0,
  };
}

export function totalWalkMinutes(walks: Walk[]): number {
  return walks.reduce((s, w) => s + (Number(w.hours) || 0) * 60 + (Number(w.minutes) || 0), 0);
}

/** A short human-readable line per day, so Claude can read results back without parsing JSON. */
export function summarise(log: DailyLog): string {
  const meds = Object.entries(log.medications)
    .filter(([, m]) => m.taken)
    .map(([n, m]) => `${n} (${m.dosage}${m.is_rescue ? ", rescue" : ""})`);
  const walkMins = log.walks.map((w) => (Number(w.hours) || 0) * 60 + (Number(w.minutes) || 0));
  const parts = [
    `${log.log_date}: ${HEALTH_SCORES[log.health_score]} (${log.health_score}/3)`,
    log.holiday_mode ? "holiday mode" : null,
    log.flare_up
      ? `FLARE-UP${log.flare_event.start_time ? ` ${log.flare_event.start_time}–${log.flare_event.end_time ?? "?"}` : ""}${log.flare_event.intervention_med ? `, treated with ${log.flare_event.intervention_med}` : ""}`
      : null,
    `symptoms: ${log.symptoms.join(", ") || "none"}`,
    `stool: ${log.stool_consistency.map((s) => STOOL_OPTIONS[s as StoolConsistency] ?? s).join(", ") || "not logged"}`,
    `dins: ${log.dins_percent == null ? "not logged" : `${log.dins_percent}%`}${log.dins_prompting ? " (needed prompting)" : ""}`,
    `walks: ${walkMins.length ? `${walkMins.map((m) => `${m} min`).join(" + ")} = ${totalWalkMinutes(log.walks)} min` : "none"}`,
    `meds: ${meds.join(", ") || "none"}`,
    `treats: ${log.treats.join(", ") || "none"}`,
    log.scavenged.length ? `scavenged: ${log.scavenged.join(", ")}` : null,
    `location: ${log.location ?? "—"} (${log.routine_type === "non_routine" ? "non-routine" : log.routine_type ?? "—"})`,
    log.notes ? `notes: ${log.notes}` : null,
  ];
  return parts.filter(Boolean).join("; ");
}
