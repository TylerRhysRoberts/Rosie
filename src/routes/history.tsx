import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  DailyLog, fetchLogs, SCORE_META, formatDate, totalWalkMinutes, logsToCsv,
  deleteLogByDate,
} from "@/lib/daily-logs";
import { CalendarDays, Search, AlertTriangle, Download, Trash2, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [pendingDelete, setPendingDelete] = useState<DailyLog | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  if (!mounted) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;

  const confirmDelete = async () => {
    if (!user || !pendingDelete) return;
    setDeleting(true);
    const date = pendingDelete.log_date;
    try {
      await deleteLogByDate(user.id, date);
      setLogs((prev) => prev.filter((l) => l.log_date !== date));
      toast.success("Entry deleted", { description: formatDate(date) });
      setPendingDelete(null);
    } catch (err: any) {
      toast.error("Delete failed", { description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto px-5 pt-10 pb-24">
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
              return (
                <HistoryCard
                  key={l.log_date}
                  log={l}
                  onRequestDelete={() => setPendingDelete(l)}
                />
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the log entry for{" "}
              {pendingDelete ? formatDate(pendingDelete.log_date) : ""}? This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-[oklch(0.58_0.20_25)] hover:bg-[oklch(0.52_0.20_25)] text-white"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HistoryCard({ log, onRequestDelete }: { log: DailyLog; onRequestDelete: () => void }) {
  const meta = SCORE_META[log.health_score];
  const walks = totalWalkMinutes(log.walks);
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);
  const ACTION_WIDTH = 80;
  const FULL_SWIPE = 200;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    moved.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const delta = e.touches[0].clientX - startX.current;
    if (Math.abs(delta) > 6) moved.current = true;
    // Only allow swipe left (negative)
    const next = Math.min(0, Math.max(-FULL_SWIPE - 20, delta + (dx < 0 && Math.abs(dx) >= ACTION_WIDTH ? -ACTION_WIDTH : 0)));
    setDx(next);
  };
  const onTouchEnd = () => {
    if (startX.current == null) return;
    startX.current = null;
    if (dx <= -FULL_SWIPE) {
      setDx(0);
      onRequestDelete();
    } else if (dx <= -ACTION_WIDTH / 2) {
      setDx(-ACTION_WIDTH);
    } else {
      setDx(0);
    }
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (moved.current || dx !== 0) {
      e.preventDefault();
      e.stopPropagation();
      setDx(0);
      moved.current = false;
    }
  };

  return (
    <li className="relative overflow-hidden rounded-2xl">
      {/* Revealed delete action under the card */}
      <button
        type="button"
        onClick={onRequestDelete}
        aria-label="Delete entry"
        className="absolute inset-y-0 right-0 flex items-center justify-center gap-1.5 bg-[oklch(0.58_0.20_25)] text-white px-5 text-xs font-semibold"
        style={{ width: ACTION_WIDTH }}
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>

      <div
        className="relative will-change-transform transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${dx}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <Link
          to="/app"
          search={{ date: log.log_date }}
          onClickCapture={onClickCapture}
          className="flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-3.5 hover:border-primary/30 transition-colors"
        >
          <span
            className="flex-shrink-0 w-3 h-12 rounded-full"
            style={{ backgroundColor: meta.ring }}
            aria-label={meta.label}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              {formatDate(log.log_date)}
              {log.flare_up && (
                <AlertTriangle className="w-3.5 h-3.5 text-[oklch(0.58_0.20_25)]" />
              )}
            </p>
            <p className="text-[12px] text-muted-foreground truncate">
              {meta.label}
              {log.symptoms.length > 0 && ` · ${log.symptoms.length} symptom${log.symptoms.length === 1 ? "" : "s"}`}
              {walks > 0 && ` · ${walks}m walking`}
              {log.notes && ` · ${log.notes.slice(0, 40)}${log.notes.length > 40 ? "…" : ""}`}
            </p>
          </div>
          <span className="text-2xl" aria-hidden>{meta.emoji}</span>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRequestDelete(); }}
            aria-label="Delete entry"
            className="flex-shrink-0 -mr-1 p-1.5 rounded-full text-muted-foreground/60 hover:text-[oklch(0.58_0.20_25)] hover:bg-[oklch(0.94_0.05_25)] active:scale-90 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </li>
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