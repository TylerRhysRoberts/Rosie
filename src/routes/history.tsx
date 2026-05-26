import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/BottomNav";
import { DailyLog, fetchLogs, SCORE_META, formatDate, totalWalkMinutes, logsToCsv } from "@/lib/daily-logs";
import { ChevronRight, CalendarDays, Search, AlertTriangle, Download } from "lucide-react";
import rosieLogo from "@/assets/rosie-icon.png";

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
  const [query, setQuery] = useState("");
  const [onlyPoor, setOnlyPoor] = useState(false);
  const [onlyFlare, setOnlyFlare] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    fetchLogs(user.id, 180).then(setLogs).catch(console.error).finally(() => setMounted(true));
  }, [user, isLoading, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (onlyPoor && l.health_score !== 1) return false;
      if (onlyFlare && !l.flare_up) return false;
      if (q && !(l.notes || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, query, onlyPoor, onlyFlare]);

  const handleExport = () => {
    const csv = logsToCsv(logs);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rosie-health-hub-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!mounted) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-lg mx-auto px-5 pt-10">
        <div className="flex items-start justify-between animate-fade-up-blur">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Past entries</p>
            <h1 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">History</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
            onClick={handleExport}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-card border border-border rounded-lg px-3 py-2 hover:border-primary/40 disabled:opacity-50 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <img src={rosieLogo} alt="Rosie" className="h-12 w-12 rounded-full object-cover" />
          </div>
        </div>

        {/* Search + filters */}
        <div className="mt-5 space-y-2 animate-fade-up-blur">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex gap-2">
            <FilterToggle on={onlyPoor} onClick={() => setOnlyPoor((v) => !v)}>
              Only Poor Days
            </FilterToggle>
            <FilterToggle on={onlyFlare} onClick={() => setOnlyFlare((v) => !v)}>
              <AlertTriangle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
              Flare-ups
            </FilterToggle>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-2xl py-16 px-6 text-center mt-6">
            <CalendarDays className="w-7 h-7 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-foreground font-semibold">
              {logs.length === 0 ? "No entries yet" : "No matches"}
            </p>
            <p className="text-sm text-muted-foreground mt-1.5">
              {logs.length === 0 ? "Saved logs will appear here." : "Adjust filters or search terms."}
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {filtered.map((l) => {
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
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        {formatDate(l.log_date)}
                        {l.flare_up && (
                          <AlertTriangle className="w-3.5 h-3.5 text-[oklch(0.58_0.20_25)]" />
                        )}
                      </p>
                      <p className="text-[12px] text-muted-foreground truncate">
                        {meta.label}
                        {l.symptoms.length > 0 && ` · ${l.symptoms.length} symptom${l.symptoms.length === 1 ? "" : "s"}`}
                        {walks > 0 && ` · ${walks}m walking`}
                        {l.notes && ` · ${l.notes.slice(0, 40)}${l.notes.length > 40 ? "…" : ""}`}
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

function FilterToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${
        on
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}