import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import {
  DailyLog,
  fetchLogsRange,
  DOSAGE_LABELS,
} from "@/lib/daily-logs";

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

type MetricDef = {
  key: CalendarMetricKey;
  label: string;
  color: string; // CSS color for dot
  getTier: (log: DailyLog) => 0 | 1 | 2;
  describe?: (log: DailyLog) => string;
};

const PRIMARY = "var(--primary)";
const DESTRUCTIVE = "var(--destructive)";

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

const ALL_METRICS: Record<CalendarMetricKey, MetricDef> = {
  medrone: {
    key: "medrone",
    label: "Medrone",
    color: PRIMARY,
    getTier: (log) => {
      const m = log.medications?.["Medrone"];
      if (!m?.taken) return 0;
      return m.is_rescue ? 2 : 1;
    },
    describe: (log) => {
      const m = log.medications?.["Medrone"];
      if (!m?.taken) return "Not taken";
      return `${DOSAGE_LABELS[m.dosage]}${m.is_rescue ? " (Rescue)" : ""}`;
    },
  },
  probiotic: {
    key: "probiotic",
    label: "Probiotic",
    color: PRIMARY,
    getTier: (log) => {
      const m = log.medications?.["Probiotic"];
      if (!m?.taken) return 0;
      return m.is_rescue ? 2 : 1;
    },
    describe: (log) => {
      const m = log.medications?.["Probiotic"];
      if (!m?.taken) return "Not taken";
      return `${DOSAGE_LABELS[m.dosage]}${m.is_rescue ? " (Rescue)" : ""}`;
    },
  },
  flareups: {
    key: "flareups",
    label: "Flare-ups",
    color: DESTRUCTIVE,
    getTier: (log) => (log.flare_up || log.flare_event?.had_flareup ? 2 : 0),
    describe: (log) => (log.flare_up ? "Flare-up logged" : "No flare-up"),
  },
  symptoms: {
    key: "symptoms",
    label: "Symptoms",
    color: PRIMARY,
    getTier: (log) => {
      const count = (log.symptoms || []).filter((s) => s !== "No Issues").length;
      if (count === 0) return 0;
      return count >= 2 ? 2 : 1;
    },
    describe: (log) => {
      const s = (log.symptoms || []).filter((s) => s !== "No Issues");
      return s.length === 0 ? "No issues" : s.join(", ");
    },
  },
  dins: {
    key: "dins",
    label: "DINS %",
    color: PRIMARY,
    getTier: (log) => {
      const v = log.dins_percent;
      if (v == null) return 0;
      if (v >= 80 && v <= 120) return 1;
      return 2;
    },
    describe: (log) => `${log.dins_percent ?? 0}%`,
  },
  stool: {
    key: "stool",
    label: "Stool Quality",
    color: PRIMARY,
    getTier: (log) => {
      const s = log.stool_consistency || [];
      if (s.length === 0) return 0;
      const onlyFormed = s.every((x) => x === "formed");
      return onlyFormed ? 1 : 2;
    },
    describe: (log) => (log.stool_consistency || []).join(", ") || "—",
  },
  walk_freq: {
    key: "walk_freq",
    label: "Walk Frequency",
    color: PRIMARY,
    getTier: (log) => {
      const n = safeCompletedWalks(log.walks);
      if (n === 0) return 0;
      return n >= 2 ? 2 : 1;
    },
    describe: (log) => `${safeCompletedWalks(log.walks)} walk(s)`,
  },
  walk_duration: {
    key: "walk_duration",
    label: "Walk Duration",
    color: PRIMARY,
    getTier: (log) => {
      const m = totalWalkMins(log.walks);
      if (m === 0) return 0;
      return m >= 45 ? 2 : 1;
    },
    describe: (log) => `${totalWalkMins(log.walks)} min`,
  },
  health: {
    key: "health",
    label: "Health Score",
    color: PRIMARY,
    getTier: (log) => {
      if (log.health_score === 3) return 2;
      if (log.health_score === 2) return 1;
      return 2; // poor — still show a dot
    },
    describe: (log) => {
      const map: Record<number, string> = { 1: "Poor", 2: "Neutral", 3: "Good" };
      return map[log.health_score] ?? "—";
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

  const cells: Array<{ key: string; date: string | null; tier: 0 | 1 | 2; tooltip: string }> = [];
  for (let i = 0; i < range.firstDow; i++) {
    cells.push({ key: `pad-${i}`, date: null, tier: 0, tooltip: "" });
  }
  for (let d = 1; d <= range.daysInMonth; d++) {
    const date = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    const log = byDate[date];
    const tier = log ? def.getTier(log) : 0;
    const tooltip = log
      ? `${date} · ${def.describe?.(log) ?? def.label}`
      : `${date} · No log`;
    cells.push({ key: date, date, tier, tooltip });
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
        {cells.map((c) => (
          <div
            key={c.key}
            title={c.tooltip}
            className="aspect-square rounded-md bg-muted/40 flex flex-col items-center justify-center relative"
          >
            {c.date && (
              <span className="text-[9px] text-muted-foreground absolute top-0.5 left-1 tabular-nums">
                {parseInt(c.date.split("-")[2], 10)}
              </span>
            )}
            {c.tier > 0 && (
              <span
                className="rounded-full"
                style={{
                  width: c.tier === 2 ? 14 : 8,
                  height: c.tier === 2 ? 14 : 8,
                  background: def.color,
                  opacity: c.tier === 2 ? 1 : 0.55,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span
            className="rounded-full"
            style={{ width: 8, height: 8, background: def.color, opacity: 0.55 }}
          />
          <span>Low / baseline</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="rounded-full"
            style={{ width: 12, height: 12, background: def.color }}
          />
          <span>High / active</span>
        </div>
      </div>

      {loading && (
        <p className="mt-3 text-center text-[10px] text-muted-foreground">Loading…</p>
      )}
    </div>
  );
}