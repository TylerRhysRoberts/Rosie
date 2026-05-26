import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/BottomNav";
import { DailyLog, fetchLogs, averageScore, SCORE_META, totalWalkMinutes } from "@/lib/daily-logs";
import { Activity, Footprints, CalendarCheck } from "lucide-react";

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

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    fetchLogs(user.id, 120)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setMounted(true));
  }, [user, isLoading, navigate]);

  if (!mounted) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;

  const timeframes: { label: string; days: number }[] = [
    { label: "Last 7 Days", days: 7 },
    { label: "Last 30 Days", days: 30 },
    { label: "Last 90 Days", days: 90 },
  ];

  const last7Walks = logs
    .filter((l) => {
      const c = new Date(); c.setDate(c.getDate() - 7);
      return l.log_date >= c.toISOString().split("T")[0];
    })
    .reduce((s, l) => s + totalWalkMinutes(l.walks), 0);

  const last30Entries = logs.filter((l) => {
    const c = new Date(); c.setDate(c.getDate() - 30);
    return l.log_date >= c.toISOString().split("T")[0];
  }).length;

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-lg mx-auto px-5 pt-10">
        <div className="animate-fade-up-blur">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Trends</p>
          <h1 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">Insights</h1>
        </div>

        {logs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat icon={CalendarCheck} label="Entries (30d)" value={`${last30Entries}`} />
              <MiniStat icon={Footprints} label="Walks (7d)" value={`${Math.round(last7Walks)} min`} />
            </div>

            <h2 className="text-[12px] uppercase tracking-wider font-semibold text-muted-foreground pt-2 px-1">Average Health Score</h2>

            {timeframes.map((tf) => {
              const avg = averageScore(logs, tf.days);
              return <ScoreCard key={tf.days} label={tf.label} avg={avg} />;
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function ScoreCard({ label, avg }: { label: string; avg: number | null }) {
  const rounded = avg === null ? null : Math.round(avg) as 1 | 2 | 3;
  const meta = rounded ? SCORE_META[rounded] : null;
  return (
    <div className="rounded-2xl bg-card border border-border p-5 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{meta?.label ?? "No data"}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
          {avg === null ? "—" : avg.toFixed(1)}
        </span>
        {meta && (
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: meta.bg }}
          >
            {meta.emoji}
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
