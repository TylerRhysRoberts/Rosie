import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  DailyLog,
  fetchLogs,
  SCORE_META,
  totalWalkMinutes,
  STOOL_OPTIONS,
  HealthScore,
} from "@/lib/daily-logs";
import { Activity, Footprints, CalendarCheck, Flame, ShieldCheck } from "lucide-react";
import rosieLogo from "@/assets/rosie-icon.png";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/insights")({
  component: InsightsPage,
  head: () => ({
    meta: [
      { title: "Rosie Health Hub — Insights" },
      { name: "description", content: "Health score trends and averages." },
    ],
  }),
});

function InsightsPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [mounted, setMounted] = useState(false);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(7);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    fetchLogs(user.id, 120)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setMounted(true));
  }, [user, isLoading, navigate]);

  if (!mounted) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;


  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDays);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const ranged = logs.filter((l) => l.log_date >= cutoffStr);

  const totalEntries = ranged.length;
  const totalWalkMins = ranged.reduce((s, l) => s + totalWalkMinutes(l.walks), 0);
  const avgDailyWalk = totalEntries > 0 ? Math.round(totalWalkMins / totalEntries) : 0;

  const flareUps = ranged.filter((l) => l.flare_up).length;
  // Current flare-free streak (within range): consecutive most-recent days without flare-up
  const sortedDesc = [...ranged].sort((a, b) => (a.log_date < b.log_date ? 1 : -1));
  let streak = 0;
  for (const l of sortedDesc) {
    if (l.flare_up) break;
    streak++;
  }

  const avgScore =
    totalEntries > 0 ? ranged.reduce((s, l) => s + l.health_score, 0) / totalEntries : null;
  const roundedScore = avgScore === null ? null : (Math.round(avgScore) as HealthScore);
  const scoreMeta = roundedScore ? SCORE_META[roundedScore] : null;

  const avgDins =
    totalEntries > 0
      ? Math.round(ranged.reduce((s, l) => s + (l.dins_percent ?? 0), 0) / totalEntries)
      : 0;
  const daysOver100 = ranged.filter((l) => (l.dins_percent ?? 0) > 100).length;

  const stoolCounts = STOOL_OPTIONS.map((opt) => ({
    ...opt,
    count: ranged.filter((l) => l.stool_consistency === opt.value).length,
  }));
  const stoolTotal = stoolCounts.reduce((s, x) => s + x.count, 0);

  // Build chronological trend data (one point per day in range, gaps interpolated as null)
  const trend: { date: string; label: string; score: number | null }[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const match = ranged.find((l) => l.log_date === key);
    trend.push({
      date: key,
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      score: match ? match.health_score : null,
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto px-5 pt-10 pb-24">
        <div className="flex items-center justify-between animate-fade-up-blur">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              Trends
            </p>
            <h1 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">Insights</h1>
          </div>
          <img src={rosieLogo} alt="Rosie" className="h-12 w-12 rounded-full object-cover" />
        </div>

        {/* Global time-range toggle */}
        <div className="mt-5 inline-flex w-full rounded-full bg-muted p-1">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setRangeDays(d)}
              className={`flex-1 text-sm font-medium py-2 rounded-full transition-colors ${
                rangeDays === d
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {d} Days
            </button>
          ))}
        </div>

        {logs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 space-y-4">
            {/* Top stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <MiniStat icon={CalendarCheck} label="Total Entries" value={`${totalEntries}`} />
              <MiniStat
                icon={Footprints}
                label="Avg Daily Walk"
                value={`${avgDailyWalk} min`}
              />
            </div>

            <div className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-destructive" />
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Flare-Up Tracker
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-2xl font-semibold text-foreground tabular-nums">
                    {flareUps}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Total Flare-ups</p>
                </div>
                <div>
                  <p className="font-mono text-2xl font-semibold text-foreground tabular-nums flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    {streak}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Flare-Free Streak (days)
                  </p>
                </div>
              </div>
            </div>

            {/* System averages */}
            <div className="rounded-2xl bg-card border border-border p-5">
              <h2 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-4">
                System Averages
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Average Health Score</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {scoreMeta?.label ?? "No data"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-4xl font-semibold tabular-nums text-foreground">
                    {avgScore === null ? "—" : avgScore.toFixed(1)}
                  </span>
                  {scoreMeta && (
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                      style={{ backgroundColor: scoreMeta.bg }}
                    >
                      {scoreMeta.emoji}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border my-4" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Average Dins Appetite</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {daysOver100} day{daysOver100 === 1 ? "" : "s"} logged above 100%
                  </p>
                </div>
                <span className="font-mono text-4xl font-semibold tabular-nums text-foreground">
                  {totalEntries > 0 ? `${avgDins}%` : "—"}
                </span>
              </div>
            </div>

            {/* Stool consistency breakdown */}
            <div className="rounded-2xl bg-card border border-border p-5">
              <h2 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-4">
                Stool Consistency Trends
              </h2>
              <div className="space-y-3">
                {stoolCounts.map((s) => {
                  const pct = stoolTotal > 0 ? (s.count / stoolTotal) * 100 : 0;
                  return (
                    <div key={s.value}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-foreground">{s.label}</span>
                        <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                          {Math.round(pct)}% · {s.count}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {stoolTotal === 0 && (
                  <p className="text-xs text-muted-foreground">No stool data logged in this range.</p>
                )}
              </div>
            </div>

            {/* Health trend line */}
            <div className="rounded-2xl bg-card border border-border p-5">
              <h2 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-4">
                Overall Health Score Trend
              </h2>
              <div className="h-48 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 80)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "oklch(0.55 0.02 80)" }}
                      interval="preserveStartEnd"
                      minTickGap={20}
                    />
                    <YAxis
                      domain={[1, 3]}
                      ticks={[1, 2, 3]}
                      tick={{ fontSize: 10, fill: "oklch(0.55 0.02 80)" }}
                      width={24}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid oklch(0.9 0.01 80)",
                        fontSize: 12,
                      }}
                      formatter={(v: any) =>
                        v === null ? ["No log", "Score"] : [v, SCORE_META[v as HealthScore].label]
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="oklch(0.72 0.16 0)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "oklch(0.72 0.16 0)" }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <Icon className="w-4 h-4 text-primary mb-2" />
      <p className="font-mono text-xl font-semibold text-foreground tabular-nums leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-2 border-dashed border-border rounded-2xl py-16 px-6 text-center mt-6">
      <Activity className="w-7 h-7 text-muted-foreground/50 mx-auto mb-4" />
      <p className="text-foreground font-semibold">No data yet</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-[240px] mx-auto">
        Save a daily log to start seeing trends here.
      </p>
    </div>
  );
}
