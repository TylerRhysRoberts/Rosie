import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  DailyLog,
  fetchLogs,
  DOSAGE_LABELS,
  DosageSize,
  FlareEvent,
} from "@/lib/daily-logs";
import { Pill } from "lucide-react";
import rosieLogo from "@/assets/rosie-icon.png";
import { BottomNav } from "@/components/BottomNav";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/medications")({
  component: MedicationsPage,
  head: () => ({
    meta: [
      { title: "Rosie Health Hub — Medications" },
      { name: "description", content: "Medication tracking grid by day." },
    ],
  }),
});

const SHORT_DOSAGE: Record<DosageSize, string> = {
  whole: "1",
  half: "1/2",
  third: "1/3",
  quarter: "1/4",
  eighth: "1/8",
};

const DOSAGE_DECIMAL: Record<DosageSize, number> = {
  whole: 1,
  half: 0.5,
  third: 0.33,
  quarter: 0.25,
  eighth: 0.125,
};

const DOSAGE_FILL_PCT: Record<DosageSize, number> = {
  whole: 100,
  half: 50,
  third: 33,
  quarter: 25,
  eighth: 12,
};

const WINDOW_DAYS = 14;

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function MedicationsPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [mounted, setMounted] = useState(false);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(7);
  const trackRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const syncScroll = (source: HTMLDivElement) => {
    const left = source.scrollLeft;
    Object.values(trackRefs.current).forEach((el) => {
      if (el && el !== source && el.scrollLeft !== left) {
        el.scrollLeft = left;
      }
    });
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    fetchLogs(user.id, 180)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setMounted(true));
  }, [user, isLoading, navigate]);

  // Build list of days within range (oldest -> newest)
  const days = useMemo(() => {
    const arr: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const span = rangeDays === 7 ? WINDOW_DAYS : rangeDays;
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(dateKey(d));
    }
    return arr;
  }, [rangeDays]);

  const daySet = useMemo(() => new Set(days), [days]);

  // Aggregate medications: per name, total taken count across ALL history
  // and per-day dosage info within active range.
  const meds = useMemo(() => {
    const totals: Record<string, number> = {};
    const perDay: Record<string, Record<string, { dosage: DosageSize; is_rescue: boolean }>> = {};
    for (const log of logs) {
      for (const [name, m] of Object.entries(log.medications || {})) {
        if (!m?.taken) continue;
        totals[name] = (totals[name] || 0) + 1;
        if (daySet.has(log.log_date)) {
          if (!perDay[name]) perDay[name] = {};
          perDay[name][log.log_date] = { dosage: m.dosage, is_rescue: !!m.is_rescue };
        }
      }
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, days: perDay[name] || {} }));
  }, [logs, daySet]);

  const healthByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of logs) {
      if (daySet.has(log.log_date)) map[log.log_date] = log.health_score;
    }
    return map;
  }, [logs, daySet]);

  const flareByDate = useMemo(() => {
    const map: Record<string, FlareEvent> = {};
    for (const log of logs) {
      if (daySet.has(log.log_date) && log.flare_event?.had_flareup) {
        map[log.log_date] = log.flare_event;
      }
    }
    return map;
  }, [logs, daySet]);

  useEffect(() => {
    if (rangeDays !== 7) return;
    // Pin to far right (Today) on render / range change.
    requestAnimationFrame(() => {
      Object.values(trackRefs.current).forEach((el) => {
        if (el) el.scrollLeft = el.scrollWidth;
      });
    });
  }, [rangeDays, meds.length, mounted]);

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto px-5 pt-10 pb-28">
        {/* Header — matches other tabs (logo right) */}
        <div className="flex items-start justify-between animate-fade-up-blur">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              Dosage history
            </p>
            <h1 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">
              Medications
            </h1>
          </div>
          <img src={rosieLogo} alt="Rosie" className="h-12 w-12 rounded-full object-cover" />
        </div>

        {/* Sticky range filter */}
        <div className="sticky top-0 z-10 -mx-5 px-5 pt-5 pb-3 bg-background">
          <div className="flex gap-2 bg-muted rounded-full p-1">
            {([7, 30, 90] as const).map((n) => (
              <button
                key={n}
                onClick={() => setRangeDays(n)}
                className={`flex-1 text-sm font-medium py-2 rounded-full transition-colors ${
                  rangeDays === n
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {n} Days
              </button>
            ))}
          </div>
        </div>

        {meds.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
            <Pill className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">No medication history yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-1">
            {meds.map((m) => (
              <div
                key={m.name}
                className="rounded-2xl bg-card border border-border p-4"
              >
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {m.name}
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    {m.count} {m.count === 1 ? "dose" : "doses"} total
                  </span>
                </div>

                {rangeDays === 7 ? (
                  <CapsuleTrack
                    days={days}
                    doses={m.days}
                    trackRef={(el) => {
                      trackRefs.current[m.name] = el;
                    }}
                    onSync={syncScroll}
                  />
                ) : (
                  <DoseTrendChart
                    days={days}
                    doses={m.days}
                    health={healthByDate}
                    flares={flareByDate}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

type DoseEntry = { dosage: DosageSize; is_rescue: boolean };

const RESCUE_STRIPE =
  "repeating-linear-gradient(45deg, oklch(0.72 0.16 0), oklch(0.72 0.16 0) 4px, oklch(0.85 0.10 0) 4px, oklch(0.85 0.10 0) 8px)";

function CapsuleTrack({
  days,
  doses,
  trackRef,
  onSync,
}: {
  days: string[];
  doses: Record<string, DoseEntry>;
  trackRef: (el: HTMLDivElement | null) => void;
  onSync?: (source: HTMLDivElement) => void;
}) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ active: boolean; startX: number; startScroll: number }>({
    active: false,
    startX: 0,
    startScroll: 0,
  });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!localRef.current) return;
    dragState.current = {
      active: true,
      startX: e.pageX,
      startScroll: localRef.current.scrollLeft,
    };
  };
  const endDrag = () => {
    dragState.current.active = false;
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState.current.active || !localRef.current) return;
    e.preventDefault();
    const walk = e.pageX - dragState.current.startX;
    localRef.current.scrollLeft = dragState.current.startScroll - walk;
    onSync?.(localRef.current);
  };

  return (
    <div
      ref={(el) => {
        localRef.current = el;
        trackRef(el);
      }}
      onMouseDown={handleMouseDown}
      onMouseLeave={endDrag}
      onMouseUp={endDrag}
      onMouseMove={handleMouseMove}
      onScroll={(e) => onSync?.(e.currentTarget)}
      className="flex flex-row overflow-x-auto gap-4 pb-2 w-full touch-pan-x cursor-grab active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {days.map((d) => {
        const entry = doses[d];
        const taken = !!entry;
        const dosage = entry?.dosage;
        const isRescue = !!entry?.is_rescue;
        const pct = taken ? DOSAGE_FILL_PCT[dosage!] : 0;
        const [, mm, dd] = d.split("-");
        const stamp = `${parseInt(dd, 10)}/${parseInt(mm, 10)}`;
        return (
          <div
            key={d}
            className="flex flex-col items-center shrink-0 w-[calc((100%-6rem)/7)]"
          >
            <div
              title={`${d}${dosage ? ` · ${DOSAGE_LABELS[dosage]}${isRescue ? " (Rescue)" : ""}` : ""}`}
              className={`relative h-20 w-full rounded-full overflow-hidden bg-muted/60 select-none ${
                isRescue ? "border-2 border-[oklch(0.58_0.20_25)]" : "border border-border"
              }`}
            >
              {taken && (
                <div
                  className={!isRescue ? "absolute inset-x-0 bottom-0 bg-primary" : "absolute inset-x-0 bottom-0"}
                  style={{
                    height: `${pct}%`,
                    ...(isRescue ? { background: RESCUE_STRIPE } : {}),
                  }}
                />
              )}
              {taken && (
                <span
                  className="absolute inset-x-0 bottom-1 text-center text-[9px] font-bold leading-none text-primary-foreground"
                  style={{ textShadow: "0 1px 2px oklch(0 0 0 / 0.35)" }}
                >
                  {SHORT_DOSAGE[dosage!]}
                </span>
              )}
            </div>
            <span className={`mt-1 text-[9px] tabular-nums ${isRescue ? "text-[oklch(0.58_0.20_25)] font-semibold" : "text-muted-foreground"}`}>
              {stamp}{isRescue ? " ⚠" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DoseTrendChart({
  days,
  doses,
  health,
  flares,
}: {
  days: string[];
  doses: Record<string, DoseEntry>;
  health: Record<string, number>;
  flares: Record<string, FlareEvent>;
}) {
  const data = days.map((d) => {
    const entry = doses[d];
    const dose = entry?.dosage;
    const value = entry ? DOSAGE_DECIMAL[entry.dosage] : 0;
    const isRescue = !!entry?.is_rescue;
    return {
      date: d,
      label: d.slice(5), // MM-DD
      dose: value,
      routineDose: isRescue ? null : value,
      rescueDose: isRescue ? value : null,
      rescueLabel: isRescue && dose ? DOSAGE_LABELS[dose] : null,
      healthScore: health[d] ?? null,
      flare: flares[d] ?? null,
    };
  });
  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 5, bottom: 0, left: 5 }}>
          <defs>
            <linearGradient id="healthGradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="128">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 80)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "oklch(0.55 0.02 80)" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 1]}
            tickFormatter={(v) =>
              v === 0 ? "0" : v === 1 ? "1" : v === 0.5 ? "½" : v === 0.25 ? "¼" : String(v)
            }
            tick={{ fontSize: 9, fill: "oklch(0.55 0.02 80)" }}
            width={28}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0.5, 3.5]}
            ticks={[1, 2, 3]}
            tickFormatter={(val) =>
              val === 1 ? "Poor" : val === 2 ? "Neutral" : val === 3 ? "Good" : ""
            }
            tick={{ fontSize: 9, fill: "oklch(0.55 0.02 80)" }}
            width={45}
            tickMargin={4}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid oklch(0.9 0.01 80)",
              fontSize: 12,
            }}
            content={<DoseTooltip />}
          />
          <Line
            type="monotone"
            dataKey="routineDose"
            name="Routine"
            stroke="oklch(0.72 0.16 0)"
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="rescueDose"
            name="Rescue"
            stroke="oklch(0.58 0.20 25)"
            strokeWidth={0}
            dot={(props: any) => {
              const { cx, cy, payload, index } = props;
              if (payload?.rescueDose == null || cx == null || cy == null) {
                // Recharts requires a returned SVG element; render an empty group.
                return <g key={`rescue-empty-${index}`} />;
              }
              return (
                <polygon
                  key={`rescue-${index}`}
                  points={`${cx},${cy - 6} ${cx - 6},${cy + 5} ${cx + 6},${cy + 5}`}
                  fill="oklch(0.58 0.20 25)"
                  stroke="white"
                  strokeWidth={1.5}
                />
              );
            }}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="healthScore"
            name="Health"
            stroke="url(#healthGradient)"
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DoseTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload ?? {};
  const fmtDose = (v: number | null) =>
    v == null || v === 0 ? "None" : v === 1 ? "1 dose" : `${v} dose`;
  const flare: FlareEvent | null = p.flare;
  const hs = p.healthScore;
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid oklch(0.9 0.01 80)",
        background: "white",
        padding: "8px 10px",
        fontSize: 12,
        minWidth: 140,
      }}
    >
      <div className="text-[11px] font-semibold text-foreground mb-1">{label}</div>
      {p.routineDose != null && (
        <div className="text-[11px]">
          <span style={{ color: "oklch(0.72 0.16 0)" }}>● Routine:</span> {fmtDose(p.routineDose)}
        </div>
      )}
      {p.rescueDose != null && (
        <div className="text-[11px]" style={{ color: "oklch(0.58 0.20 25)" }}>
          ▲ Rescue: {p.rescueLabel ?? fmtDose(p.rescueDose)}
        </div>
      )}
      {hs != null && (
        <div className="text-[11px] text-muted-foreground">
          Health: {hs === 1 ? "Poor" : hs === 2 ? "Neutral" : "Good"}
        </div>
      )}
      {flare && (
        <div className="text-[11px] mt-1" style={{ color: "oklch(0.58 0.20 25)" }}>
          Flare: {flare.start_time ?? "?"} – {flare.end_time ?? "?"}
          {flare.symptoms.length > 0 ? ` [${flare.symptoms.join(", ")}]` : ""}
        </div>
      )}
    </div>
  );
}