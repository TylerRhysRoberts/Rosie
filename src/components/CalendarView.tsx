import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { DailyLog, fetchLogsRange } from "@/lib/daily-logs";

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
  intensity: number; // 0..1
  display: string; // raw value text shown inside the cell ("" = empty)
  hasData: boolean;
};

type MetricDef = {
  key: CalendarMetricKey;
  label: string;
  binary?: boolean; // flare-ups use destructive binary toggle
  getValue: (log: DailyLog) => CellValue;
};

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
      if (!m?.taken) return { intensity: 0, display: "", hasData: false };
      const n = dosageNumeric(m.dosage);
      return {
        intensity: m.is_rescue ? 1 : Math.min(1, n),
        display: dosageDisplay(n),
        hasData: true,
      };
    },
  },
  probiotic: {
    key: "probiotic",
    label: "Probiotic",
    getValue: (log) => {
      const m = log.medications?.["Probiotic"];
      if (!m?.taken) return { intensity: 0, display: "", hasData: false };
      const n = dosageNumeric(m.dosage);
      return {
        intensity: m.is_rescue ? 1 : Math.min(1, n),
        display: dosageDisplay(n),
        hasData: true,
      };
    },
  },
  flareups: {
    key: "flareups",
    label: "Flare-ups",
    binary: true,
    getValue: (log) => {
      const yes = !!(log.flare_up || log.flare_event?.had_flareup);
      return { intensity: yes ? 1 : 0, display: yes ? "Yes" : "No", hasData: true };
    },
  },
  symptoms: {
    key: "symptoms",
    label: "Symptoms",
    getValue: (log) => {
      const count = (log.symptoms || []).filter((s) => s !== "No Issues").length;
      return {
        intensity: Math.min(1, count / 4),
        display: String(count),
        hasData: (log.symptoms || []).length > 0,
      };
    },
  },
  dins: {
    key: "dins",
    label: "DINS %",
    getValue: (log) => {
      const v = log.dins_percent;
      if (v == null) return { intensity: 0, display: "", hasData: false };
      // Distance from baseline (100%) → intensity. 0% diff = light, ≥60% diff = max.
      const diff = Math.abs(v - 100);
      return {
        intensity: Math.min(1, 0.15 + diff / 60),
        display: String(v),
        hasData: true,
      };
    },
  },
  stool: {
    key: "stool",
    label: "Stool Quality",
    getValue: (log) => {
      const s = log.stool_consistency || [];
      if (s.length === 0) return { intensity: 0, display: "", hasData: false };
      const bad = s.filter((x) => x !== "formed").length;
      return {
        intensity: bad === 0 ? 0.2 : Math.min(1, 0.4 + bad * 0.3),
        display: String(s.length),
        hasData: true,
      };
    },
  },
  walk_freq: {
    key: "walk_freq",
    label: "Walk Frequency",
    getValue: (log) => {
      const n = safeCompletedWalks(log.walks);
      return {
        intensity: Math.min(1, n / 3),
        display: String(n),
        hasData: n > 0,
      };
    },
  },
  walk_duration: {
    key: "walk_duration",
    label: "Walk Duration",
    getValue: (log) => {
      const m = totalWalkMins(log.walks);
      return {
        intensity: Math.min(1, m / 90),
        display: String(m),
        hasData: m > 0,
      };
    },
  },
  health: {
    key: "health",
    label: "Health Score",
    getValue: (log) => {
      if (!log.health_score) return { intensity: 0, display: "", hasData: false };
      const map: Record<number, { i: number; d: string }> = {
        1: { i: 1, d: "1" },
        2: { i: 0.5, d: "2" },
        3: { i: 0.2, d: "3" },
      };
      const e = map[log.health_score];
      return { intensity: e?.i ?? 0, display: e?.d ?? "", hasData: true };
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
      value: { intensity: 0, display: "", hasData: false },
      tooltip: "",
    });
  }
  for (let d = 1; d <= range.daysInMonth; d++) {
    const date = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    const log = byDate[date];
    const value: CellValue = log
      ? def.getValue(log)
      : { intensity: 0, display: "", hasData: false };
    const tooltip = log
      ? `${date} · ${def.label}: ${value.display || "—"}`
      : `${date} · No log`;
    cells.push({ key: date, date, value, tooltip });
  }

  const visibleMetrics = metrics.map((k) => ALL_METRICS[k]);

  return (
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
          const { intensity, display, hasData } = c.value;
          let bg = "transparent";
          if (c.date && hasData && intensity > 0) {
            if (def.binary) {
              bg = "var(--destructive)";
            } else {
              // Scale brand pink from ~10% (very light) to 100% (saturated)
              const pct = Math.round((0.1 + 0.9 * intensity) * 100);
              bg = `color-mix(in srgb, var(--primary) ${pct}%, transparent)`;
            }
          }
          const valueTextClass =
            def.binary && intensity > 0
              ? "text-destructive-foreground"
              : intensity >= 0.7
                ? "text-foreground"
                : "text-foreground/80";
          return (
            <div
              key={c.key}
              title={c.tooltip}
              className={`aspect-square rounded-md flex items-center justify-center relative ${
                c.date && !hasData ? "bg-muted/40" : c.date ? "" : ""
              }`}
              style={c.date ? { background: bg === "transparent" && !hasData ? undefined : bg } : undefined}
            >
              {c.date && (
                <span className="text-[9px] text-muted-foreground absolute top-0.5 left-1 tabular-nums">
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
  );
}