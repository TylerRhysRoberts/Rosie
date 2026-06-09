import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  DailyLog, fetchLogs, SCORE_META, formatDate, totalWalkMinutes, logsToCsv,
  deleteLogByDate, DOSAGE_LABELS,
} from "@/lib/daily-logs";
import { CalendarDays, Search, AlertTriangle, Download, X, ChevronDown, ChevronUp, ArrowRight, Sun, StickyNote } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import rosieLogo from "@/assets/rosie-icon.png";
import { BottomNav } from "@/components/BottomNav";

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
  const [onlyNeutral, setOnlyNeutral] = useState(false);
  const [onlyFlare, setOnlyFlare] = useState(false);
  const [onlyHoliday, setOnlyHoliday] = useState(false);
  const [onlyNotHome, setOnlyNotHome] = useState(false);
  const [onlyNotes, setOnlyNotes] = useState(false);
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
      if (onlyNeutral && l.health_score !== 2) return false;
      if (onlyFlare && !l.flare_up) return false;
      if (onlyHoliday && !l.holiday_mode) return false;
      if (onlyNotHome && !(l.location && l.location !== "Home")) return false;
      if (onlyNotes && !(l.notes && l.notes.trim().length > 0)) return false;
      if (q && !(l.notes || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, query, onlyPoor, onlyNeutral, onlyFlare, onlyHoliday, onlyNotHome, onlyNotes]);

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
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto px-5 pt-10 pb-28">
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
            <Link to="/profile" aria-label="Open Rosie's profile" className="active:scale-95 transition-transform">
              <img src={rosieLogo} alt="Rosie" className="h-12 w-12 rounded-full object-cover" />
            </Link>
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
          <div className="grid grid-cols-3 gap-2">
            <FilterToggle on={onlyPoor} onClick={() => setOnlyPoor((v) => !v)}>Poor</FilterToggle>
            <FilterToggle on={onlyNeutral} onClick={() => setOnlyNeutral((v) => !v)}>Neutral</FilterToggle>
            <FilterToggle on={onlyFlare} onClick={() => setOnlyFlare((v) => !v)}>Flare-Up</FilterToggle>
            <FilterToggle
              on={onlyHoliday}
              onClick={() => setOnlyHoliday((v) => !v)}
              activeClass="bg-[oklch(0.92_0.05_230)] text-[oklch(0.35_0.10_230)] border-[oklch(0.78_0.08_230)]"
            >
              Holiday
            </FilterToggle>
            <FilterToggle on={onlyNotHome} onClick={() => setOnlyNotHome((v) => !v)}>Not Home</FilterToggle>
            <FilterToggle on={onlyNotes} onClick={() => setOnlyNotes((v) => !v)}>Notes</FilterToggle>
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
      <BottomNav />
    </div>
  );
}

function HistoryCard({ log, onRequestDelete }: { log: DailyLog; onRequestDelete: () => void }) {
  const meta = SCORE_META[log.health_score];
  const walks = totalWalkMinutes(log.walks);
  const [expanded, setExpanded] = useState(false);
  const realSymptoms = log.symptoms.filter((s) => s !== "No Issues");
  const takenMeds = Object.entries(log.medications).filter(([, m]) => m.taken);

  return (
    <li
      className={`relative overflow-hidden rounded-2xl bg-card border transition-colors ${
        log.holiday_mode
          ? "!bg-[oklch(0.97_0.025_230)] border-[oklch(0.78_0.08_230)] hover:border-[oklch(0.68_0.12_230)]"
          : "border-border hover:border-primary/30"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <span
          className="flex-shrink-0 w-3 h-12 rounded-full"
          style={{ backgroundColor: meta.ring }}
          aria-label={meta.label}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            {formatDate(log.log_date)}
            {log.holiday_mode && (
              <Sun className="w-3.5 h-3.5 text-[oklch(0.62_0.14_230)]" />
            )}
            {log.flare_up && (
              <AlertTriangle className="w-3.5 h-3.5 text-[oklch(0.58_0.20_25)]" />
            )}
          </p>
          <p className="text-[12px] text-muted-foreground truncate">
            {meta.label}
            {realSymptoms.length === 0
              ? " · No Symptoms"
              : ` · ${realSymptoms.length} symptom${realSymptoms.length === 1 ? "" : "s"}`}
            {walks > 0 && ` · ${walks}m 🚶‍♂️`}
          </p>
        </div>
        {log.notes && log.notes.trim().length > 0 && (
          <StickyNote className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" aria-label="Has note" />
        )}
        <span className="text-2xl" aria-hidden>{meta.emoji}</span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRequestDelete(); }}
          aria-label="Delete entry"
          className="flex-shrink-0 -mr-1 p-1.5 rounded-full text-muted-foreground/60 hover:text-[oklch(0.58_0.20_25)] hover:bg-[oklch(0.94_0.05_25)] active:scale-90 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </button>

      <div
        className={`grid transition-all duration-200 ease-in-out ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-border/60 space-y-3">
            {log.flare_up && (
              <DetailRow label="Flare-up">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-[oklch(0.58_0.20_25)] font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {log.flare_event?.start_time || log.flare_event?.end_time
                    ? `Flare: ${log.flare_event?.start_time ?? "—"} – ${log.flare_event?.end_time ?? "—"}`
                    : "Flare-up day"}
                </span>
              </DetailRow>
            )}

            <DetailRow label="Symptoms">
              {realSymptoms.length === 0 ? (
                <span className="text-[12px] text-muted-foreground">No symptoms</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {realSymptoms.map((s) => (
                    <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-foreground">{s}</span>
                  ))}
                </div>
              )}
            </DetailRow>

            <DetailRow label="Diet & Treats">
              <div className="flex flex-col gap-0.5 text-[12px] text-foreground">
                <span>Dins: {log.dins_percent}%</span>
                <span>Treats: {log.treats.length > 0 ? log.treats.join(", ") : "None"}</span>
                <span>Scavenges: {log.scavenged.length > 0 ? log.scavenged.join(", ") : "None"}</span>
              </div>
            </DetailRow>

            <DetailRow label="Medications">
              {takenMeds.length === 0 ? (
                <span className="text-[12px] text-muted-foreground">None</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {takenMeds.map(([name, m]) => (
                    <span
                      key={name}
                      className={
                        m.is_rescue
                          ? "text-[11px] px-2 py-0.5 rounded-full font-semibold text-white"
                          : "text-[11px] px-2 py-0.5 rounded-full bg-muted text-foreground"
                      }
                      style={
                        m.is_rescue
                          ? {
                              backgroundImage:
                                "repeating-linear-gradient(45deg, oklch(0.58 0.20 25), oklch(0.58 0.20 25) 6px, oklch(0.52 0.20 25) 6px, oklch(0.52 0.20 25) 12px)",
                            }
                          : undefined
                      }
                    >
                      {name} ({DOSAGE_LABELS[m.dosage]}){m.is_rescue && " · Rescue"}
                    </span>
                  ))}
                </div>
              )}
            </DetailRow>

            <DetailRow label="Activity & Place">
              <span className="text-[12px] text-foreground">
                Walk: {walks > 0 ? `${walks} mins` : "None"} · Location: {log.location ?? "—"}
              </span>
            </DetailRow>

            {log.notes && (
              <blockquote className="text-[12px] italic text-foreground/90 border-l-2 border-primary/40 pl-3 py-1 whitespace-pre-wrap">
                {log.notes}
              </blockquote>
            )}

            <div className="flex justify-end pt-1">
              <Link
                to="/app"
                search={{ date: log.log_date }}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
              >
                Edit Full Entry <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 items-start">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pt-0.5">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function FilterToggle({ on, onClick, children, activeClass }: { on: boolean; onClick: () => void; children: React.ReactNode; activeClass?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-8 px-2 rounded-full text-xs font-medium border transition-all active:scale-95 whitespace-nowrap leading-none flex items-center justify-center ${
        on
          ? (activeClass ?? "bg-primary text-primary-foreground border-primary")
          : "bg-card text-foreground border-border hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}