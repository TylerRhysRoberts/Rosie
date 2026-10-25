import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  DailyLog, fetchLogs, SCORE_META, formatDate, totalWalkMinutes, logsToCsv,
  deleteLogByDate, DOSAGE_LABELS, DEFAULT_TREATS,
} from "@/lib/daily-logs";
import { CalendarDays, Search, AlertTriangle, Download, X, ChevronDown, ChevronUp, ArrowRight, Sun, StickyNote, SlidersHorizontal } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [health, setHealth] = useState<Set<string>>(new Set()); // "poor" | "neutral" | "good" | "flare"
  const [context, setContext] = useState<Set<string>>(new Set()); // "holiday" | "notes"
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [medFilter, setMedFilter] = useState<string>("");
  const [stool, setStool] = useState<Set<string>>(new Set());
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set());
  const [scavenged, setScavenged] = useState<Set<string>>(new Set());
  const [treats, setTreats] = useState<Set<string>>(new Set());
  const [lagWindow, setLagWindow] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DailyLog | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    fetchLogs(user.id, 180).then(setLogs).catch(console.error).finally(() => setMounted(true));
  }, [user, isLoading, navigate]);

  const uniqueLocations = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs) if (l.location) s.add(l.location);
    return Array.from(s).sort();
  }, [logs]);

  const uniqueMedications = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs)
      for (const [name, m] of Object.entries(l.medications))
        if (m.taken) s.add(name);
    return Array.from(s).sort();
  }, [logs]);

  const uniqueTreats = useMemo(() => {
    const s = new Set<string>(DEFAULT_TREATS);
    for (const l of logs) for (const t of l.treats) if (t) s.add(t);
    return Array.from(s).sort();
  }, [logs]);

  const matchesCriteria = (l: DailyLog): boolean => {
    if (health.size > 0) {
      const tags: string[] = [];
      if (l.health_score === 1) tags.push("poor");
      if (l.health_score === 2) tags.push("neutral");
      if (l.health_score === 3) tags.push("good");
      if (l.flare_up) tags.push("flare");
      if (!tags.some((t) => health.has(t))) return false;
    }
    if (context.has("holiday") && !l.holiday_mode) return false;
    if (context.has("notes") && !(l.notes && l.notes.trim().length > 0)) return false;
    if (locationFilter) {
      if (locationFilter === "Not Home") {
        if (!l.location || l.location.trim().toLowerCase() === "home") return false;
      } else if (l.location !== locationFilter) {
        return false;
      }
    }
    if (medFilter) {
      const m = l.medications[medFilter];
      if (!m || !m.taken) return false;
    }
    if (stool.size > 0 && !(l.stool_consistency ?? []).some((s) => stool.has(s))) return false;
    if (symptoms.size > 0 && !(l.symptoms ?? []).some((s) => symptoms.has(s))) return false;
    if (scavenged.size > 0 && !(l.scavenged ?? []).some((s) => scavenged.has(s))) return false;
    if (treats.size > 0 && !(l.treats ?? []).some((t) => treats.has(t))) return false;
    return true;
  };

  const anyFilterActive =
    health.size > 0 || context.size > 0 || locationFilter || medFilter ||
    stool.size > 0 || symptoms.size > 0 || scavenged.size > 0 || treats.size > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const logsByDate = new Map(logs.map((l) => [l.log_date, l] as const));

    let dateMatcher: (l: DailyLog) => boolean;
    if (lagWindow && anyFilterActive) {
      const baselineDates = new Set(logs.filter(matchesCriteria).map((l) => l.log_date));
      const targetDates = new Set<string>();
      for (const d of baselineDates) {
        const [y, m, day] = d.split("-").map(Number);
        for (const offset of [1, 2]) {
          const dt = new Date(y, m - 1, day + offset);
          const yy = dt.getFullYear();
          const mm = String(dt.getMonth() + 1).padStart(2, "0");
          const dd = String(dt.getDate()).padStart(2, "0");
          targetDates.add(`${yy}-${mm}-${dd}`);
        }
      }
      dateMatcher = (l) => targetDates.has(l.log_date);
    } else {
      dateMatcher = matchesCriteria;
    }

    return logs.filter((l) => {
      if (!dateMatcher(l)) return false;
      if (q && !(l.notes || "").toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, query, health, context, locationFilter, medFilter, stool, symptoms, scavenged, treats, lagWindow]);

  const clearAll = () => {
    setHealth(new Set());
    setContext(new Set());
    setLocationFilter("");
    setMedFilter("");
    setStool(new Set());
    setSymptoms(new Set());
    setScavenged(new Set());
    setTreats(new Set());
    setLagWindow(false);
  };

  const activeFilterCount =
    health.size + context.size + (locationFilter ? 1 : 0) + (medFilter ? 1 : 0) +
    stool.size + symptoms.size + scavenged.size + treats.size + (lagWindow ? 1 : 0);

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
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes…"
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="relative h-11 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-card border border-border rounded-xl px-3.5 hover:border-primary/40 active:scale-95"
            >
              <SlidersHorizontal className="w-4 h-4" /> Filter
              {activeFilterCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full bg-primary text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </button>
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

      <FilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        health={health} setHealth={setHealth}
        context={context} setContext={setContext}
        locationFilter={locationFilter} setLocationFilter={setLocationFilter}
        medFilter={medFilter} setMedFilter={setMedFilter}
        stool={stool} setStool={setStool}
        symptoms={symptoms} setSymptoms={setSymptoms}
        scavenged={scavenged} setScavenged={setScavenged}
        treats={treats} setTreats={setTreats}
        lagWindow={lagWindow} setLagWindow={setLagWindow}
        uniqueLocations={uniqueLocations}
        uniqueMedications={uniqueMedications}
        uniqueTreats={uniqueTreats}
        onClear={clearAll}
      />

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
                <span>Dins: {log.dins_percent == null ? "—" : `${log.dins_percent}%`}</span>
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

function PillToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3 rounded-full text-xs font-medium border transition-all active:scale-95 whitespace-nowrap leading-none ${
        on
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

type FilterDrawerProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  health: Set<string>; setHealth: (s: Set<string>) => void;
  context: Set<string>; setContext: (s: Set<string>) => void;
  locationFilter: string; setLocationFilter: (s: string) => void;
  medFilter: string; setMedFilter: (s: string) => void;
  stool: Set<string>; setStool: (s: Set<string>) => void;
  symptoms: Set<string>; setSymptoms: (s: Set<string>) => void;
  scavenged: Set<string>; setScavenged: (s: Set<string>) => void;
  treats: Set<string>; setTreats: (s: Set<string>) => void;
  lagWindow: boolean; setLagWindow: (b: boolean) => void;
  uniqueLocations: string[];
  uniqueMedications: string[];
  uniqueTreats: string[];
  onClear: () => void;
};

function FilterDrawer(p: FilterDrawerProps) {
  const toggle = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const HEALTH_OPTS: { v: string; l: string }[] = [
    { v: "poor", l: "Poor" },
    { v: "neutral", l: "Neutral" },
    { v: "good", l: "Good" },
    { v: "flare", l: "Flare-Up" },
  ];
  const STOOL_LABELS: { v: string; l: string }[] = [
    { v: "formed", l: "No Issues" },
    { v: "soft", l: "Soft / Loose" },
    { v: "loose", l: "Mucus" },
    { v: "liquid", l: "Liquid / Diarrhoea" },
    { v: "blood", l: "Blood" },
    { v: "constipation", l: "Constipation" },
  ];
  const SYMPTOM_OPTS = ["No Issues", "Squelching", "Lethargy", "Reduced Appetite", "Vomiting", "Eating Grass"];
  const SCAVENGED_OPTS = ["Twigs", "Floor Food", "Plants"];

  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[85vh] flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="text-left">Filters</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <FilterGroup label="Health">
            {HEALTH_OPTS.map((o) => (
              <PillToggle key={o.v} on={p.health.has(o.v)} onClick={() => toggle(p.health, o.v, p.setHealth)}>
                {o.l}
              </PillToggle>
            ))}
          </FilterGroup>

          <FilterGroup label="Context">
            <PillToggle on={p.context.has("holiday")} onClick={() => toggle(p.context, "holiday", p.setContext)}>Holiday</PillToggle>
            <PillToggle on={p.context.has("notes")} onClick={() => toggle(p.context, "notes", p.setContext)}>Notes</PillToggle>
          </FilterGroup>

          <FilterGroup label="Location">
            <select
              value={p.locationFilter}
              onChange={(e) => p.setLocationFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">All locations</option>
              <option value="Not Home">Not Home</option>
              {p.uniqueLocations.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Medications">
            <select
              value={p.medFilter}
              onChange={(e) => p.setMedFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">All medications</option>
              {p.uniqueMedications.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Stool">
            {STOOL_LABELS.map((o) => (
              <PillToggle key={o.v} on={p.stool.has(o.v)} onClick={() => toggle(p.stool, o.v, p.setStool)}>
                {o.l}
              </PillToggle>
            ))}
          </FilterGroup>

          <FilterGroup label="Symptoms">
            {SYMPTOM_OPTS.map((s) => (
              <PillToggle key={s} on={p.symptoms.has(s)} onClick={() => toggle(p.symptoms, s, p.setSymptoms)}>
                {s}
              </PillToggle>
            ))}
          </FilterGroup>

          <FilterGroup label="Scavenged / Additional Food">
            {SCAVENGED_OPTS.map((s) => (
              <PillToggle key={s} on={p.scavenged.has(s)} onClick={() => toggle(p.scavenged, s, p.setScavenged)}>
                {s}
              </PillToggle>
            ))}
          </FilterGroup>

          <FilterGroup label="Treats">
            {p.uniqueTreats.map((t) => (
              <PillToggle key={t} on={p.treats.has(t)} onClick={() => toggle(p.treats, t, p.setTreats)}>
                {t}
              </PillToggle>
            ))}
          </FilterGroup>

          <div className="flex items-start justify-between gap-3 pt-2 border-t border-border">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">+1–2 Days Lag Window</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Show logs from 1–2 days after the criteria above match — to spot delayed reactions.
              </p>
            </div>
            <Switch checked={p.lagWindow} onCheckedChange={p.setLagWindow} />
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-border bg-card">
          <button
            type="button"
            onClick={p.onClear}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-foreground hover:border-primary/40 active:scale-95"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={() => p.onOpenChange(false)}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-95"
          >
            Apply Filters
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}