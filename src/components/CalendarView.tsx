import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { DailyLog, DOSAGE_LABELS, fetchLogsRange, totalWalkMinutes } from "@/lib/daily-logs";

export type CalendarMetricKey =
  | "medrone"
  | "probiotic"
  | "flareups"
  | "symptoms"
  | "dins"
  | "stool"
  | "walk_freq"
  | "walk_duration"
  | "health";

type CellValue = {
  display: string; // text shown in cell ("" = empty)
  bg: string | null; // CSS background; null = no tint
  textWhite?: boolean; // force white text for high-contrast alert backgrounds
};

type MetricDef = {
  key: CalendarMetricKey;
  label: string;
  getValue: (log: DailyLog) => CellValue;
};

// Overfeed accent (matches DINS slider overfeed color in app.tsx)
const OVERFEED_COLOR = "oklch(0.62 0.17 55)";

function pinkBg(intensity: number): string {
  const i = Math.max(0, Math.min(1, intensity));
  const pct = Math.round((0.1 + 0.9 * i) * 100);
  return `color-mix(in srgb, var(--primary) ${pct}%, transparent)`;
}

// Lightly tinted background for explicit zero logs
const ZERO_BG = pinkBg(0);

function safeCompletedWalks(walks: unknown): number {
  try {
    const arr = typeof walks === "string" ? JSON.parse(walks) : walks;
    if (!Array.isArray(arr)) return 0;
    return arr.filter((w: any) => w && w.completed === true).length;
  } catch {
    return 0;
  }
}

function totalWalkMins(walks: unknown): number {
  try {
    const arr = typeof walks === "string" ? JSON.parse(walks) : walks;
    if (!Array.isArray(arr)) return 0;
    return arr.reduce(
      (s: number, w: any) => s + ((w?.hours || 0) * 60 + (w?.minutes || 0)),
      0,
    );
  } catch {
    return 0;
  }
}

function dosageNumeric(d: string | undefined): number {
  switch (d) {
    case "whole": return 1;
    case "half": return 0.5;
    case "third": return 1 / 3;
    case "quarter": return 0.25;
    case "eighth": return 0.125;
    default: return 0;
  }
}

function dosageDisplay(n: number): string {
  if (n === 1) return "1";
  if (n === 0.5) return "½";
  if (Math.abs(n - 1 / 3) < 0.01) return "⅓";
  if (n === 0.25) return "¼";
  if (n === 0.125) return "⅛";
  return n.toString();
}

const ALL_METRICS: Record<CalendarMetricKey, MetricDef> = {
  medrone: {
    key: "medrone",
    label: "Medrone",
    getValue: (log) => {
      const m = log.medications?.["Medrone"];
      if (!m?.taken) return { display: "0", bg: ZERO_BG };
      const n = dosageNumeric(m.dosage);
      const intensity = m.is_rescue ? 1 : Math.min(1, n);
      return { display: dosageDisplay(n), bg: pinkBg(intensity) };
    },
  },
  probiotic: {
    key: "probiotic",
    label: "Probiotic",
    getValue: (log) => {
      const m = log.medications?.["Probiotic"];
      if (!m?.taken) return { display: "0", bg: ZERO_BG };
      const n = dosageNumeric(m.dosage);
      const intensity = m.is_rescue ? 1 : Math.min(1, n);
      return { display: dosageDisplay(n), bg: pinkBg(intensity) };
    },
  },
  flareups: {
    key: "flareups",
    label: "Flare-ups",
    getValue: (log) => {
      const yes = !!(log.flare_up || log.flare_event?.had_flareup);
      if (!yes) return { display: "", bg: null };
      return { display: "Yes", bg: "var(--destructive)", textWhite: true };
    },
  },
  symptoms: {
    key: "symptoms",
    label: "Symptoms",
    getValue: (log) => {
      const count = (log.symptoms || []).filter((s) => s !== "No Issues").length;
      if (count === 0) return { display: "0", bg: ZERO_BG };
      return { display: String(count), bg: pinkBg(Math.min(1, count / 4)) };
    },
  },
  dins: {
    key: "dins",
    label: "DINS %",
    getValue: (log) => {
      const v = log.dins_percent;
      if (v == null) return { display: "", bg: null };
      if (v > 100) {
        return { display: String(v), bg: OVERFEED_COLOR, textWhite: true };
      }
      // Higher % → darker / more saturated pink. 0% = lightest, 100% = full.
      return { display: String(v), bg: pinkBg(v / 100) };
    },
  },
  stool: {
    key: "stool",
    label: "Stool Quality",
    getValue: (log) => {
      const s = log.stool_consistency || [];
      if (s.length === 0) return { display: "0", bg: ZERO_BG };
      const bad = s.filter((x) => x !== "formed").length;
      const intensity = bad === 0 ? 0.2 : Math.min(1, 0.4 + bad * 0.3);
      return { display: String(s.length), bg: pinkBg(intensity) };
    },
  },
  walk_freq: {
    key: "walk_freq",
    label: "Walk Frequency",
    getValue: (log) => {
      const n = safeCompletedWalks(log.walks);
      if (n === 0) return { display: "0", bg: ZERO_BG };
      return { display: String(n), bg: pinkBg(Math.min(1, n / 3)) };
    },
  },
  walk_duration: {
    key: "walk_duration",
    label: "Walk Duration",
    getValue: (log) => {
      const m = totalWalkMins(log.walks);
      if (m === 0) return { display: "0", bg: ZERO_BG };
      return { display: String(m), bg: pinkBg(Math.min(1, m / 90)) };
    },
  },
  health: {
    key: "health",
    label: "Health Score",
    getValue: (log) => {
      if (!log.health_score) return { display: "", bg: null };
      // Status mapping: 1 = poor (red), 2 = warning (yellow), 3 = optimal (green)
      const map: Record<number, { bg: string }> = {
        1: { bg: "var(--destructive)" },
        2: { bg: "var(--warning)" },
        3: { bg: "var(--success)" },
      };
      const e = map[log.health_score];
      if (!e) return { display: String(log.health_score), bg: null };
      return { display: String(log.health_score), bg: e.bg, textWhite: true };
    },
  },
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function monthRange(year: number, month: number): { start: string; end: string; daysInMonth: number; firstDow: number } {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();
  const firstDow = (first.getDay() + 6) % 7; // 0 = Mon
  const start = `${year}-${pad2(month + 1)}-01`;
  const end = `${year}-${pad2(month + 1)}-${pad2(daysInMonth)}`;
  return { start, end, daysInMonth, firstDow };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DOW_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarView({
  userId,
  metrics,
}: {
  userId: string;
  metrics: CalendarMetricKey[];
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [metric, setMetric] = useState<CalendarMetricKey>(metrics[0]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!metrics.includes(metric)) setMetric(metrics[0]);
  }, [metrics, metric]);

  const range = useMemo(() => monthRange(year, month), [year, month]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLogsRange(userId, range.start, range.end)
      .then((rows) => {
        if (!cancelled) setLogs(rows);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, range.start, range.end]);

  const byDate = useMemo(() => {
    const m: Record<string, DailyLog> = {};
    for (const l of logs) m[l.log_date] = l;
    return m;
  }, [logs]);

  const def = ALL_METRICS[metric];

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const cells: Array<{
    key: string;
    date: string | null;
    value: CellValue;
    tooltip: string;
  }> = [];
  for (let i = 0; i < range.firstDow; i++) {
    cells.push({
      key: `pad-${i}`,
      date: null,
      value: { display: "", bg: null },
      tooltip: "",
    });
  }
  for (let d = 1; d <= range.daysInMonth; d++) {
    const date = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    const log = byDate[date];
    const value: CellValue = log
      ? def.getValue(log)
      : { display: "", bg: null };
    const tooltip = log
      ? `${date} · ${def.label}: ${value.display || "—"}`
      : `${date} · No log`;
    cells.push({ key: date, date, value, tooltip });
  }

  const visibleMetrics = metrics.map((k) => ALL_METRICS[k]);

  const [activeDate, setActiveDate] = useState<string | null>(null);

  // Clear selection when month changes
  useEffect(() => {
    setActiveDate(null);
  }, [year, month]);

  const activeLog = activeDate ? byDate[activeDate] : null;

  return (
    <>
    <div className="rounded-2xl bg-card border border-border p-4">
      {/* Header: month nav */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous month"
          className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold tabular-nums min-w-[8rem] text-center">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next month"
          className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Metric selector */}
      <div className="mt-3 flex justify-center">
        <div className="relative">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as CalendarMetricKey)}
            className="appearance-none rounded-full bg-muted text-foreground text-xs font-medium pl-3 pr-8 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {visibleMetrics.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="mt-4 grid grid-cols-7 gap-1 px-1">
        {DOW_LABELS.map((d, i) => (
          <div
            key={i}
            className="text-[10px] text-center text-muted-foreground font-medium"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="mt-1 grid grid-cols-7 gap-1 px-1">
        {cells.map((c) => {
          const { display, bg, textWhite } = c.value;
          const valueTextClass = textWhite ? "text-white" : "text-foreground/80";
          const hasLog = !!(c.date && byDate[c.date]);
          const isActive = !!(c.date && activeDate === c.date);
          return (
            <div
              key={c.key}
              title={c.tooltip}
              onClick={hasLog ? () => setActiveDate((prev) => (prev === c.date ? null : c.date)) : undefined}
              role={hasLog ? "button" : undefined}
              tabIndex={hasLog ? 0 : undefined}
              onKeyDown={hasLog ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveDate((prev) => (prev === c.date ? null : c.date));
                }
              } : undefined}
              className={`aspect-square rounded-md flex items-center justify-center relative transition ${hasLog ? "cursor-pointer active:scale-95 hover:brightness-95" : ""} ${isActive ? "ring-2 ring-foreground ring-offset-1 ring-offset-card" : ""}`}
              style={c.date && bg ? { background: bg } : undefined}
            >
              {c.date && (
                <span className={`text-[9px] absolute top-0.5 left-1 tabular-nums ${textWhite ? "text-white/80" : "text-muted-foreground"}`}>
                  {parseInt(c.date.split("-")[2], 10)}
                </span>
              )}
              {display && (
                <span className={`text-[11px] font-semibold tabular-nums ${valueTextClass}`}>
                  {display}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {loading && (
        <p className="mt-3 text-center text-[10px] text-muted-foreground">Loading…</p>
      )}
    </div>

    {activeDate && (
      <DailySummaryCard date={activeDate} log={activeLog} />
    )}
    </>
  );
}

function formatDateLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function DailySummaryCard({ date, log }: { date: string; log: DailyLog | null }) {
  return (
    <div className="mt-3 rounded-2xl bg-card border border-border p-4">
      <h3 className="text-sm font-semibold">Log Summary: {formatDateLong(date)}</h3>
      {!log ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No logs recorded for this date.
        </p>
      ) : (
        <SummaryBody log={log} />
      )}
    </div>
  );
}

function SummaryBody({ log }: { log: DailyLog }) {
  const meds = Object.entries(log.medications || {}).filter(([, m]) => m?.taken);
  const symptoms = (log.symptoms || []).filter((s) => s && s !== "No Issues");
  const stool = (log.stool_consistency || []).filter(Boolean);
  const flareYes = !!(log.flare_up || log.flare_event?.had_flareup);
  const walkMins = totalWalkMinutes(log.walks || []);
  const walkCount = (log.walks || []).filter((w) => w.completed).length;
  const treats = (log.treats || []).filter(Boolean);
  const scavenged = (log.scavenged || []).filter(Boolean);

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-foreground">{children}</span>
    </div>
  );

  const dinsExtras: string[] = [];
  if (log.dins_prompting) dinsExtras.push("prompting needed");

  return (
    <div className="mt-3 space-y-2">
      <Row label="Health Score">{log.health_score}/3</Row>
      <Row label="Flare-up">{flareYes ? "Yes" : "No"}</Row>
      {meds.length > 0 && (
        <Row label="Medications">
          {meds
            .map(([n, m]) => `${n} (${DOSAGE_LABELS[m.dosage] ?? m.dosage})${m.is_rescue ? " · rescue" : ""}`)
            .join(", ")}
        </Row>
      )}
      <Row label="DINS">
        {log.dins_percent}%{dinsExtras.length ? ` (${dinsExtras.join(", ")})` : ""}
      </Row>
      <Row label="Symptoms">{symptoms.length > 0 ? symptoms.join(", ") : "None"}</Row>
      <Row label="Stool Quality">{stool.length > 0 ? stool.join(", ") : "—"}</Row>
      <Row label="Walks">
        {walkCount > 0 || walkMins > 0
          ? `${walkCount} walk${walkCount === 1 ? "" : "s"} · ${walkMins} min`
          : "None"}
      </Row>
      {treats.length > 0 && <Row label="Treats">{treats.join(", ")}</Row>}
      {scavenged.length > 0 && <Row label="Scavenged">{scavenged.join(", ")}</Row>}
      {log.location && <Row label="Location">{log.location}</Row>}
      {log.routine_type && <Row label="Routine">{log.routine_type === "routine" ? "Routine" : "Non-routine"}</Row>}
      {log.notes && log.notes.trim() && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">Notes</p>
          <p className="text-sm whitespace-pre-wrap">{log.notes}</p>
        </div>
      )}
    </div>
  );
}