import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/BottomNav";
import { DailyLog, fetchLogs, SCORE_META, formatDate, totalWalkMinutes } from "@/lib/daily-logs";
import { ChevronRight, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "Rosie Health Hub — History" },
      { name: "description", content: "Chronological list of past health logs." },
    ],
  }),
});

function HistoryPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    fetchLogs(user.id, 180).then(setLogs).catch(console.error).finally(() => setMounted(true));
  }, [user, isLoading, navigate]);

  if (!mounted) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-lg mx-auto px-5 pt-10">
        <div className="animate-fade-up-blur">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Past entries</p>
          <h1 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">History</h1>
        </div>

        {logs.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-2xl py-16 px-6 text-center mt-6">
            <CalendarDays className="w-7 h-7 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-foreground font-semibold">No entries yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">Saved logs will appear here.</p>
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {logs.map((l) => {
              const meta = SCORE_META[l.health_score];
              const walks = totalWalkMinutes(l.walks);
              return (
                <li key={l.log_date}>
                  <Link
                    to="/app"
                    className="flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-3.5 hover:border-primary/30 transition-colors active:scale-[0.99]"
                  >
                    <span
                      className="flex-shrink-0 w-3 h-12 rounded-full"
                      style={{ backgroundColor: meta.ring }}
                      aria-label={meta.label}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{formatDate(l.log_date)}</p>
                      <p className="text-[12px] text-muted-foreground truncate">
                        {meta.label}
                        {l.symptoms.length > 0 && ` · ${l.symptoms.length} symptom${l.symptoms.length === 1 ? "" : "s"}`}
                        {walks > 0 && ` · ${walks}m walking`}
                      </p>
                    </div>
                    <span className="text-2xl" aria-hidden>{meta.emoji}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <BottomNav />
    </div>
  );
}