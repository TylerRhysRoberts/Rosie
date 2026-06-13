import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Check, AlertTriangle, CheckCircle2, Copy, X, ChevronDown, Star, Sun, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import rosieLogo from "@/assets/rosie-icon.png";
import { BottomNav } from "@/components/BottomNav";
import {
  DailyLog, HealthScore, SCORE_META, SYMPTOM_OPTIONS, MEDICATION_NAMES,
  LOCATION_OPTIONS, DOSAGE_OPTIONS, DOSAGE_LABELS, Walk,
  STOOL_OPTIONS, DEFAULT_TREATS, DEFAULT_SCAVENGED,
  emptyLog, todayKey, fetchLogByDate, fetchPreviousLog, fetchLogs, upsertLog, totalWalkMinutes,
  EMPTY_FLARE_EVENT, FlareEvent,
} from "@/lib/daily-logs";
import { MILES_PER_MINUTE, annualMilestones, milestoneRegistryId, pickLocation } from "@/lib/milestones";
import { MilestoneCelebration } from "@/components/MilestoneCelebration";
import { ACHIEVEMENTS, evaluateAchievements, type EvalCtx } from "@/lib/achievements";
import { bumpNight, bumpLateEdit, loadMeta } from "@/lib/achievements-meta";
import { useNotificationQueue } from "@/components/NotificationQueueProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app")({
  component: LogPage,
  validateSearch: (s: Record<string, unknown>): { date?: string } =>
    typeof s.date === "string" ? { date: s.date } : {},
  head: () => ({
    meta: [
      { title: "Rosie Health Hub — Log Today" },
      { name: "description", content: "Daily health log entry." },
    ],
  }),
});

const TIME_OPTIONS: string[] = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, "0");
  const m = String((i % 4) * 15).padStart(2, "0");
  return `${h}:${m}`;
});
const PRIMARY_MEDS = ["Medrone", "Probiotic"] as const;
const SECONDARY_MEDS = MEDICATION_NAMES.filter(
  (n) => !(PRIMARY_MEDS as readonly string[]).includes(n),
);
const WALK_TARGET_MIN = 45;

function LogPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const notify = useNotificationQueue();
  const search = Route.useSearch();
  const [date, setDate] = useState(search.date ?? todayKey());
  const [log, setLog] = useState<DailyLog>(emptyLog());
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customSymptom, setCustomSymptom] = useState("");
  const [customTreat, setCustomTreat] = useState("");
  const [customScavenged, setCustomScavenged] = useState("");
  const [customMed, setCustomMed] = useState("");
  const [showMoreMeds, setShowMoreMeds] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [milestoneModal, setMilestoneModal] = useState<{ name: string; totalMiles: number; year: number } | null>(null);

  const touchRef = useRef<{ x: number; y: number; active: boolean } | null>(null);

  const shiftDate = (delta: number) => {
    const [y, m, d] = date.split("-").map(Number);
    const next = new Date(y, m - 1, d);
    next.setDate(next.getDate() + delta);
    const ny = next.getFullYear();
    const nm = String(next.getMonth() + 1).padStart(2, "0");
    const nd = String(next.getDate()).padStart(2, "0");
    const nextStr = `${ny}-${nm}-${nd}`;
    if (delta > 0 && nextStr > todayKey()) return;
    setDate(nextStr);
    navigate({ to: "/app", search: { date: nextStr } });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, active: true };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touchRef.current;
    if (!s || !s.active) return;
    const t = e.touches[0];
    if (Math.abs(t.clientY - s.y) > 30) s.active = false;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s || !s.active) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dy) > 30) return;
    if (Math.abs(dx) < 75) return;
    if (dx > 0) shiftDate(-1);
    else if (date < todayKey()) shiftDate(1);
  };

  useEffect(() => {
    if (search.date && search.date !== date) setDate(search.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.date]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setMounted(false);
    fetchLogByDate(user.id, date)
      .then((found) => setLog(found ?? emptyLog(date)))
      .catch((err) => {
        console.error(err);
        setLog(emptyLog(date));
      })
      .finally(() => setMounted(true));
  }, [user, authLoading, date, navigate]);

  const update = <K extends keyof DailyLog>(key: K, value: DailyLog[K]) =>
    setLog((prev) => ({ ...prev, [key]: value }));

  const toggleSymptom = (s: string) => {
    setLog((prev) => {
      const has = prev.symptoms.includes(s);
      let symptoms = has ? prev.symptoms.filter((x) => x !== s) : [...prev.symptoms, s];
      if (!has && s === "No Issues") symptoms = ["No Issues"];
      else if (!has) symptoms = symptoms.filter((x) => x !== "No Issues");
      return { ...prev, symptoms };
    });
  };

  const toggleStool = (s: string) => {
    setLog((prev) => {
      const has = prev.stool_consistency.includes(s);
      let next = has
        ? prev.stool_consistency.filter((x) => x !== s)
        : [...prev.stool_consistency, s];
      if (!has && s === "formed") next = ["formed"];
      else if (!has) next = next.filter((x) => x !== "formed");
      return { ...prev, stool_consistency: next };
    });
  };

  const addCustomSymptom = () => {
    const v = customSymptom.trim();
    if (!v) return;
    setLog((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(v)
        ? prev.symptoms
        : [...prev.symptoms.filter((x) => x !== "No Issues"), v],
    }));
    setCustomSymptom("");
  };

  const toggleListItem = (key: "treats" | "scavenged", item: string) => {
    setLog((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item],
      };
    });
  };

  const addCustomTo = (key: "treats" | "scavenged", value: string, reset: () => void) => {
    const v = value.trim();
    if (!v) return;
    setLog((prev) =>
      prev[key].includes(v) ? prev : { ...prev, [key]: [...prev[key], v] },
    );
    reset();
  };

  const setMed = (name: string, partial: Partial<{ taken: boolean; dosage: string; is_rescue: boolean }>) => {
    setLog((prev) => {
      const nextMeds = {
        ...prev.medications,
        [name]: { ...prev.medications[name], ...partial } as any,
      };
      // If taken is being unset, also clear rescue flag.
      if (partial.taken === false) {
        nextMeds[name] = { ...nextMeds[name], is_rescue: false };
      }
      const prevRescueCount = Object.values(prev.medications).filter(
        (m) => m.taken && m.is_rescue,
      ).length;
      const rescueNames = Object.entries(nextMeds)
        .filter(([, m]: [string, any]) => m.taken && m.is_rescue)
        .map(([n]) => n);
      const anyRescue = rescueNames.length > 0;
      const prevFlare = prev.flare_event ?? EMPTY_FLARE_EVENT;

      let flare_up = prev.flare_up;
      let flare_event = prevFlare;

      if (anyRescue) {
        // Activating any rescue dose → ensure flare is ON and intervention reflects all rescues.
        flare_up = true;
        flare_event = {
          ...prevFlare,
          had_flareup: true,
          intervention_med: rescueNames.join(", "),
        };
      } else if (prevRescueCount > 0) {
        // Last rescue dose just removed → clear flare entirely.
        flare_up = false;
        flare_event = { ...EMPTY_FLARE_EVENT };
      }

      return { ...prev, medications: nextMeds, flare_up, flare_event };
    });
  };

  const addCustomMed = () => {
    const v = customMed.trim();
    if (!v) return;
    setLog((prev) =>
      prev.medications[v]
        ? prev
        : { ...prev, medications: { ...prev.medications, [v]: { taken: true, dosage: "whole", is_rescue: false } } },
    );
    setCustomMed("");
  };

  const removeMed = (name: string) => {
    if ((MEDICATION_NAMES as readonly string[]).includes(name)) return;
    setLog((prev) => {
      const next = { ...prev.medications };
      delete next[name];
      return { ...prev, medications: next };
    });
  };

  const updateFlare = (partial: Partial<FlareEvent>) => {
    setLog((prev) => ({
      ...prev,
      flare_event: { ...(prev.flare_event ?? EMPTY_FLARE_EVENT), ...partial },
    }));
  };

  const toggleHolidayMode = () => {
    setLog((prev) => ({ ...prev, holiday_mode: !prev.holiday_mode }));
  };
  // Toggle the flare flag, keeping medications in sync.
  // Turning flare OFF clears all rescue-dose flags (a rescue only exists in response to a flare).
  const setFlareOn = (next: boolean) => {
    setLog((prev) => {
      if (next) {
        return {
          ...prev,
          flare_up: true,
          flare_event: { ...(prev.flare_event ?? EMPTY_FLARE_EVENT), had_flareup: true },
        };
      }
      const clearedMeds = Object.fromEntries(
        Object.entries(prev.medications).map(([n, m]) => [n, { ...m, is_rescue: false }]),
      );
      return {
        ...prev,
        flare_up: false,
        flare_event: { ...EMPTY_FLARE_EVENT },
        medications: clearedMeds as typeof prev.medications,
      };
    });
  };

  const addWalk = () => {
    if (log.walks.length >= 3) return;
    update("walks", [...log.walks, { hours: 0, minutes: 30 }]);
  };
  const setWalk = (i: number, partial: Partial<Walk>) => {
    const next = log.walks.slice();
    next[i] = { ...next[i], ...partial };
    update("walks", next);
  };
  const removeWalk = (i: number) => update("walks", log.walks.filter((_, j) => j !== i));

  const handleCopyYesterday = async () => {
    if (!user) return;
    try {
      const prev = await fetchPreviousLog(user.id, date);
      if (!prev) {
        toast.info("No previous log found");
        return;
      }
      setLog({
        ...prev,
        id: log.id,
        log_date: date,
      });
      toast.success("Pre-filled from previous entry", {
        description: `Copied from ${prev.log_date}`,
      });
    } catch (err: any) {
      toast.error("Couldn't copy", { description: err.message });
    }
  };

  const persist = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let working: DailyLog = log;
      if (log.holiday_mode) {
        working = {
          ...working,
          stool_consistency: ["formed"],
          symptoms: ["No Issues"],
          dins_percent: 100,
          treats: ["Cheese"],
          scavenged: [],
          walks: [{ hours: 0, minutes: 30, completed: true }],
          routine_type: "non_routine",
          health_score: log.flare_up ? 1 : 2,
          flare_event: log.flare_up
            ? { ...(log.flare_event ?? EMPTY_FLARE_EVENT), had_flareup: true, start_time: "00:00", end_time: "23:59" }
            : { ...EMPTY_FLARE_EVENT },
        };
      }
      // Auto-derive walk completion from inputs
      const walks = working.walks.map((w) => ({
        ...w,
        completed: (Number(w.hours) || 0) * 60 + (Number(w.minutes) || 0) > 0,
      }));
      // Flare symptoms always mirror the day-level symptoms list.
      const flare_event = {
        ...(working.flare_event ?? EMPTY_FLARE_EVENT),
        symptoms: working.flare_up ? [...working.symptoms] : [],
      };
      const saved = await upsertLog(user.id, { ...working, walks, flare_event });
      setLog(saved);
      toast.success("Log saved", { description: "Your daily entry has been recorded." });
      // ── Lifetime achievements evaluation ────────────────────────
      try {
        // Update ambient meta counters (night log / late edit).
        const hour = new Date().getHours();
        let meta = loadMeta(user.id);
        if (hour >= 23 || hour < 4) meta = bumpNight(user.id);
        // Late edit: compare saved.updated_at vs created_at on row if available.
        // Best-effort via the saved row we just upserted: re-fetch row metadata.
        try {
          const { data: row } = await supabase
            .from("daily_logs")
            .select("created_at, updated_at")
            .eq("user_id", user.id)
            .eq("log_date", saved.log_date)
            .maybeSingle();
          if (row?.created_at && row?.updated_at) {
            const diff = new Date(row.updated_at).getTime() - new Date(row.created_at).getTime();
            if (diff > 3 * 60 * 60 * 1000) meta = bumpLateEdit(user.id);
          }
        } catch { /* ignore */ }

        const allLogs = (await fetchLogs(user.id, 4000))
          .slice()
          .sort((a, b) => a.log_date.localeCompare(b.log_date));
        const { data: existing } = await supabase
          .from("lifetime_achievements")
          .select("achievement_id")
          .eq("user_id", user.id);
        const existingSet = new Set((existing ?? []).map((r: any) => r.achievement_id as string));
        const ctx: EvalCtx = {
          logs: allLogs, now: new Date(),
          savedAtNight: hour >= 23 || hour < 4,
          savedAsLateEdit: false,
          meta,
        };
        const newly = evaluateAchievements(ctx, existingSet);
        if (newly.length > 0) {
          await supabase.from("lifetime_achievements").insert(
            newly.map((a) => ({ user_id: user.id, achievement_id: a.id })),
          );
          for (const a of newly) {
            notify.enqueue({ kind: "achievement", id: `achv-${a.id}`, achievement: a });
          }
        }
        // Silence unused-import warning when ACHIEVEMENTS list isn't otherwise referenced.
        void ACHIEVEMENTS;
      } catch (e) {
        console.error("achievement eval failed", e);
      }
      // Milestone check (annual walking challenge)
      try {
        const year = Number(saved.log_date.slice(0, 4));
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;
        const yearLogs = await fetchLogs(user.id, 4000);
        const totalMinutes = yearLogs.reduce((sum, entry) => {
          if (entry.log_date < yearStart || entry.log_date > yearEnd) return sum;
          return sum + totalWalkMinutes(entry.walks);
        }, 0);
        const totalMiles = totalMinutes * MILES_PER_MINUTE;
        const reached = annualMilestones.filter((milestone) => totalMiles >= milestone.miles);
        const newlyClaimed: typeof reached = [];

        for (const milestone of reached) {
          const milestoneId = milestoneRegistryId(year, milestone.miles);
          const { data: claimed, error } = await supabase.rpc("claim_annual_milestone", {
            _milestone_id: milestoneId,
          });
          if (error) throw error;
          if (claimed) newlyClaimed.push(milestone);
        }

        if (newlyClaimed.length > 0) {
          const top = newlyClaimed[newlyClaimed.length - 1];
          setMilestoneModal({
            name: pickLocation(top.miles, year),
            totalMiles,
            year,
          });
        }
      } catch (e) {
        console.error("milestone check failed", e);
      }
    } catch (err: any) {
      toast.error("Save failed", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const missingSections = () => {
    const missing: string[] = [];
    if (totalWalkMinutes(log.walks) === 0) missing.push("No walks logged");
    if (!log.notes.trim()) missing.push("No notes added");
    if (!log.routine_type) missing.push("No routine type selected");
    if (!Object.values(log.medications).some((m) => m.taken))
      missing.push("No medications logged");
    if (!log.location) missing.push("No location selected");
    return missing;
  };

  const handleSave = () => {
    if (missingSections().length > 0) {
      setConfirmOpen(true);
    } else {
      persist();
    }
  };

  if (authLoading || !mounted) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  const isSubmitted = !!log.id;
  const flareAccent = log.flare_up;
  const customMedNames = Object.keys(log.medications).filter(
    (n) => !(MEDICATION_NAMES as readonly string[]).includes(n),
  );
  const totalWalkMins = totalWalkMinutes(log.walks);
  const targetHit = totalWalkMins >= WALK_TARGET_MIN;

  return (
    <div
      className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden transition-colors ${
        flareAccent ? "bg-[oklch(0.97_0.04_25)]" : log.holiday_mode ? "bg-[oklch(0.96_0.03_230)]" : ""
      }`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto px-5 pt-10 pb-28">
        <div className="flex items-center justify-between animate-fade-up-blur">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Rosie Health Hub</p>
            <h1 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">
              {log.holiday_mode ? "Holiday Mode" : "Daily Log"}
            </h1>
          </div>
          <Link to="/profile" aria-label="Open Rosie's profile" className="active:scale-95 transition-transform">
            <img src={rosieLogo} alt="Rosie" className="h-12 w-12 rounded-full object-cover" />
          </Link>
        </div>

        {/* Submission signifier */}
        {isSubmitted && (
          <div className="mt-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 bg-[oklch(0.93_0.07_145)] border border-[oklch(0.72_0.16_145)] animate-fade-up-blur">
            <CheckCircle2 className="w-4 h-4 text-[oklch(0.55_0.18_145)]" />
            <span className="text-sm font-medium text-[oklch(0.4_0.12_145)]">
              Log submitted for this date
            </span>
          </div>
        )}

        <div className="mt-6 space-y-5">
          {/* 1. Header & system controls */}
          <Section label="Date">
            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftDate(-1)}
                className="shrink-0 h-[46px] w-[46px] rounded-xl flex items-center justify-center active:scale-95 transition-colors border text-muted-foreground bg-card border-border hover:text-foreground"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="relative flex-1 min-w-0">
                <input
                  type="date"
                  value={date}
                  max={todayKey()}
                  onChange={(e) => setDate(e.target.value)}
                  className="appearance-none [-webkit-appearance:none] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer w-full px-4 pr-10 py-3 rounded-xl bg-card border border-border text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <CalendarIcon className="w-5 h-5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <button
                onClick={() => shiftDate(1)}
                disabled={date >= todayKey()}
                className="shrink-0 h-[46px] w-[46px] rounded-xl flex items-center justify-center active:scale-95 transition-colors border text-muted-foreground bg-card border-border hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Next day"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={toggleHolidayMode}
                className={`shrink-0 h-[46px] w-[46px] rounded-xl flex items-center justify-center active:scale-95 transition-colors border ${
                  log.holiday_mode
                    ? "text-[oklch(0.5_0.18_220)] bg-[oklch(0.95_0.08_220)] border-[oklch(0.78_0.10_220)]"
                    : "text-muted-foreground bg-card border-border hover:text-foreground"
                }`}
                aria-label="Toggle holiday mode"
                aria-pressed={log.holiday_mode}
                title={log.holiday_mode ? "Holiday mode on" : "Toggle holiday mode"}
              >
                <Sun className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={handleCopyYesterday}
              className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:border-primary/40 active:scale-[0.99] transition-all"
            >
              <Copy className="w-4 h-4" /> Copy Yesterday's Inputs
            </button>
          </Section>

          {/* 2. Severity & alert flags */}
          <Section label="Flare-Up Alert">
            <button
              onClick={() => setFlareOn(!log.flare_up)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border-2 transition-all active:scale-[0.99] ${
                log.flare_up
                  ? "bg-[oklch(0.94_0.05_25)] border-[oklch(0.68_0.20_25)]"
                  : "bg-card border-border"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle
                  className={`w-5 h-5 ${log.flare_up ? "text-[oklch(0.58_0.20_25)]" : "text-muted-foreground"}`}
                />
                <span className={`text-sm font-semibold ${log.flare_up ? "text-[oklch(0.45_0.18_25)]" : "text-foreground"}`}>
                  {log.flare_up ? "Flare-up day flagged" : "Mark as flare-up day"}
                </span>
              </div>
              <Toggle on={log.flare_up} onChange={setFlareOn} />
            </button>

            {log.flare_up && (
              <div className="mt-3 rounded-2xl bg-card border border-[oklch(0.68_0.20_25)]/40 p-4 space-y-4 animate-fade-up-blur">
                {log.holiday_mode ? (
                  <div className="rounded-xl bg-muted border border-dashed border-border px-3 py-2.5 text-[12px] text-muted-foreground">
                    Holiday mode: flare-up is logged as all day (00:00 – 23:59).
                  </div>
                ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                      Start time
                    </label>
                    <select
                      value={log.flare_event?.start_time ?? ""}
                      onChange={(e) => updateFlare({ start_time: e.target.value || null })}
                      className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">--:--</option>
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                      Resolution time
                    </label>
                    <select
                      value={log.flare_event?.end_time ?? ""}
                      onChange={(e) => updateFlare({ end_time: e.target.value || null })}
                      className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">--:--</option>
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                )}

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                    Intervention applied
                  </label>
                  {(() => {
                    const rescueMeds = Object.entries(log.medications)
                      .filter(([, m]) => m.taken && m.is_rescue)
                      .map(([n]) => n);
                    if (rescueMeds.length === 0) {
                      return (
                        <div className="px-3 py-2.5 rounded-xl bg-muted border border-dashed border-border text-[12px] text-muted-foreground">
                          Tick <span className="font-semibold">Rescue dose</span> on a medication below — all rescue meds will be auto-listed as interventions.
                        </div>
                      );
                    }
                    return (
                      <div className="flex flex-wrap gap-1.5 px-3 py-2.5 rounded-xl bg-muted border border-border">
                        {rescueMeds.map((n) => (
                          <span
                            key={n}
                            className="px-2.5 py-1 rounded-full bg-[oklch(0.58_0.20_25)] text-white text-xs font-semibold"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </Section>

          {!log.holiday_mode && (
          <Section label="Overall Health Score">
            <div className="grid grid-cols-3 gap-3">
              {([1, 2, 3] as HealthScore[]).map((s) => {
                const meta = SCORE_META[s];
                const active = log.health_score === s;
                return (
                  <button
                    key={s}
                    onClick={() => update("health_score", s)}
                    className={`flex flex-col items-center justify-center py-5 rounded-2xl border-2 transition-all active:scale-95 ${
                      active ? "border-transparent shadow-md" : "border-border bg-card"
                    }`}
                    style={active ? { backgroundColor: meta.bg, borderColor: meta.ring } : undefined}
                  >
                    <span className="text-4xl leading-none">{meta.emoji}</span>
                    <span className="text-xs font-semibold mt-2" style={{ color: active ? meta.color : undefined }}>
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>
          )}

          {/* 3. Clinical observations */}
          {!log.holiday_mode && (
          <Section label="Stool Consistency">
            <div className="grid grid-cols-3 gap-2">
              {STOOL_OPTIONS.map((opt) => {
                const active = log.stool_consistency.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleStool(opt.value)}
                    className={`min-h-[48px] px-2 py-1 rounded-xl text-xs font-medium border transition-all active:scale-95 flex items-center justify-center text-center ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Section>
          )}

          {!log.holiday_mode && (
          <Section label="Symptoms">
            <div className="grid grid-cols-3 gap-2">
              {SYMPTOM_OPTIONS.map((s) => {
                const active = log.symptoms.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleSymptom(s)}
                    className={`min-h-[48px] px-2 py-1 rounded-xl text-xs font-medium border transition-all active:scale-95 flex items-center justify-center text-center ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
              {log.symptoms
                .filter((s) => !(SYMPTOM_OPTIONS as readonly string[]).includes(s))
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSymptom(s)}
                    className="min-h-[48px] px-2 py-1 rounded-xl text-xs font-medium border border-primary bg-primary text-primary-foreground active:scale-95 inline-flex items-center justify-center text-center gap-1"
                  >
                    {s} <X className="w-3 h-3 opacity-70" />
                  </button>
                ))}
            </div>
            <CustomAdd
              value={customSymptom}
              onChange={setCustomSymptom}
              onAdd={addCustomSymptom}
              placeholder="Add custom symptom…"
            />
          </Section>
          )}

          {/* 4. Dietary inputs */}
          {!log.holiday_mode && (
          <Section label="% of Dins" hint={`${log.dins_percent}%`}>
            <DinsSlider
              value={log.dins_percent}
              onChange={(v) => update("dins_percent", v)}
              prompting={!!log.dins_prompting}
              onPromptingChange={(v) => update("dins_prompting", v)}
            />
          </Section>
          )}

          {!log.holiday_mode && (
          <Section label="Treats">
            <div className="flex flex-wrap gap-2">
              {DEFAULT_TREATS.map((t) => {
                const active = log.treats.includes(t);
                return (
                  <Chip key={t} active={active} onClick={() => toggleListItem("treats", t)}>
                    {t}
                  </Chip>
                );
              })}
              {log.treats
                .filter((t) => !(DEFAULT_TREATS as readonly string[]).includes(t))
                .map((t) => (
                  <Chip key={t} active onClick={() => toggleListItem("treats", t)}>
                    {t}
                  </Chip>
                ))}
            </div>
            <CustomAdd
              value={customTreat}
              onChange={setCustomTreat}
              onAdd={() => addCustomTo("treats", customTreat, () => setCustomTreat(""))}
              placeholder="Add custom treat…"
            />
          </Section>
          )}

          {!log.holiday_mode && (
          <Section label="Scavenged / Additional Food">
            <div className="flex flex-wrap gap-2">
              {DEFAULT_SCAVENGED.map((t) => {
                const active = log.scavenged.includes(t);
                return (
                  <Chip key={t} active={active} onClick={() => toggleListItem("scavenged", t)}>
                    {t}
                  </Chip>
                );
              })}
              {log.scavenged
                .filter((t) => !(DEFAULT_SCAVENGED as readonly string[]).includes(t))
                .map((t) => (
                  <Chip key={t} active onClick={() => toggleListItem("scavenged", t)}>
                    {t}
                  </Chip>
                ))}
            </div>
            <CustomAdd
              value={customScavenged}
              onChange={setCustomScavenged}
              onAdd={() => addCustomTo("scavenged", customScavenged, () => setCustomScavenged(""))}
              placeholder="Add custom item…"
            />
          </Section>
          )}

          {/* 5. Care & activities */}
          <Section label="Medications">
            <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
              {PRIMARY_MEDS.map((name) => {
                const med = log.medications[name];
                return (
                  <MedRow key={name} name={name} med={med} setMed={setMed} />
                );
              })}
              {showMoreMeds && SECONDARY_MEDS.map((name) => {
                const med = log.medications[name];
                return (
                  <MedRow key={name} name={name} med={med} setMed={setMed} />
                );
              })}
              <button
                type="button"
                onClick={() => setShowMoreMeds((v) => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMoreMeds ? "rotate-180" : ""}`} />
                {showMoreMeds ? "Hide extra medications" : "Show more medications"}
              </button>
              {customMedNames.map((name) => {
                const med = log.medications[name];
                return (
                  <MedRow
                    key={name}
                    name={name}
                    med={med}
                    setMed={setMed}
                    onRemove={() => removeMed(name)}
                  />
                );
              })}
            </div>
            <CustomAdd
              value={customMed}
              onChange={setCustomMed}
              onAdd={addCustomMed}
              placeholder="Add custom medication…"
            />
          </Section>

          <Section label="Location">
            <select
              value={log.location ?? ""}
              onChange={(e) => update("location", e.target.value || null)}
              className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Select location…</option>
              {LOCATION_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </Section>

          {!log.holiday_mode && (
          <Section label="Routine Type">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted border border-border">
              {(["routine", "non_routine"] as const).map((r) => {
                const active = log.routine_type === r;
                return (
                  <button
                    key={r}
                    onClick={() => update("routine_type", r)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {r === "routine" ? "Routine Day (Work)" : "Non-Routine Day (Off)"}
                  </button>
                );
              })}
            </div>
          </Section>
          )}

          {!log.holiday_mode && (
          <Section
            label="Walks"
            hint={
              <span className="flex items-center gap-2">
                {targetHit && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[oklch(0.93_0.07_145)] border border-[oklch(0.72_0.16_145)] text-[oklch(0.4_0.12_145)] text-[10px] font-semibold uppercase tracking-wide">
                    <Star className="w-3 h-3" /> Target Hit
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {totalWalkMins}/{WALK_TARGET_MIN}m · {log.walks.length}/3
                </span>
              </span>
            }
          >
            <div className="space-y-2">
              {log.walks.map((w, i) => {
                const mins = (Number(w.hours) || 0) * 60 + (Number(w.minutes) || 0);
                const done = mins > 0;
                return (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-xl border p-3 transition-colors ${
                    done
                      ? "bg-[oklch(0.95_0.06_145)] border-[oklch(0.72_0.16_145)]"
                      : "bg-card border-border"
                  }`}
                >
                  <span
                    aria-label={done ? "Walk completed" : "Walk pending"}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      done
                        ? "bg-[oklch(0.65_0.18_145)] border-[oklch(0.65_0.18_145)] text-white"
                        : "border-border bg-card"
                    }`}
                  >
                    {done && <Check className="w-4 h-4" />}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground w-12">Walk {i + 1}</span>
                  <NumInput value={w.hours} onChange={(v) => setWalk(i, { hours: v })} max={12} suffix="h" />
                  <NumInput value={w.minutes} onChange={(v) => setWalk(i, { minutes: v })} max={59} suffix="m" />
                  <button onClick={() => removeWalk(i)} className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg active:scale-90" aria-label="Remove walk">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                );
              })}
              {log.walks.length < 3 && (
                <button
                  onClick={addWalk}
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" /> Add walk
                </button>
              )}
            </div>
          </Section>
          )}

          <Section label="Notes">
            <textarea
              value={log.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              placeholder="Optional comments…"
              className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Section>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base shadow-md shadow-primary/20 active:scale-[0.98] disabled:opacity-60 transition-all"
          >
            {saving ? "Saving…" : log.id ? "Update entry" : "Submit Entry"}
          </button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit incomplete entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit this entry? The following sections have not been filled in:
              <ul className="mt-2 list-disc pl-5 text-foreground">
                {missingSections().map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmOpen(false); persist(); }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Confirm Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MilestoneCelebration
        open={!!milestoneModal}
        milestoneName={milestoneModal?.name ?? ""}
        totalMiles={milestoneModal?.totalMiles ?? 0}
        year={milestoneModal?.year ?? new Date().getFullYear()}
        onClose={() => setMilestoneModal(null)}
      />
      <BottomNav />
    </div>
  );
}

function Section({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="animate-fade-up-blur">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h2 className="text-[12px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</h2>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-all active:scale-95 ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:border-primary/40"
      }`}
    >
      {active && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
      {children}
    </button>
  );
}

function CustomAdd({
  value, onChange, onAdd, placeholder,
}: { value: string; onChange: (v: string) => void; onAdd: () => void; placeholder: string }) {
  return (
    <div className="mt-2 flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
        placeholder={placeholder}
        className="flex-1 px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        onClick={onAdd}
        className="px-3 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/70 active:scale-95"
        aria-label="Add"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

function DinsSlider({
  value,
  onChange,
  prompting,
  onPromptingChange,
}: {
  value: number;
  onChange: (v: number) => void;
  prompting: boolean;
  onPromptingChange: (v: boolean) => void;
}) {
  const over = value > 100;
  const pct = Math.min(150, Math.max(0, value));
  const normalPct = (Math.min(100, pct) / 150) * 100;
  const overPct = (pct / 150) * 100;
  const pink = "oklch(0.78 0.12 0)";
  const orange = "oklch(0.7 0.18 55)";
  const muted = "oklch(0.92 0.01 80)";
  const trackBg = over
    ? `linear-gradient(to right, ${pink} 0%, ${pink} ${normalPct}%, ${orange} ${normalPct}%, ${orange} ${overPct}%, ${muted} ${overPct}%, ${muted} 100%)`
    : `linear-gradient(to right, ${pink} 0%, ${pink} ${normalPct}%, ${muted} ${normalPct}%, ${muted} 100%)`;
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-semibold tabular-nums ${over ? "text-[oklch(0.62_0.17_55)]" : "text-foreground"}`}>
            {pct}%
          </span>
          {over && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[oklch(0.62_0.17_55)]">
              Overfeed
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <span className="text-muted-foreground">Prompting?</span>
          <Toggle on={prompting} onChange={onPromptingChange} />
        </label>
      </div>
      <input
        type="range"
        min={0}
        max={150}
        step={5}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value))}
        className="dins-range w-full appearance-none h-2 rounded-full cursor-pointer focus:outline-none"
        style={{ background: trackBg }}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-0.5">
        <span>0%</span><span>50%</span><span>100%</span><span>150%</span>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <span
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted-foreground/25"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </span>
  );
}

function MedRow({
  name,
  med,
  setMed,
  onRemove,
}: {
  name: string;
  med: { taken: boolean; dosage: string; is_rescue?: boolean };
  setMed: (name: string, partial: Partial<{ taken: boolean; dosage: string; is_rescue: boolean }>) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-sm font-medium text-foreground">{name}</span>
        <select
          value={med.dosage}
          onChange={(e) => setMed(name, { dosage: e.target.value })}
          disabled={!med.taken}
          className="bg-muted text-foreground text-sm rounded-lg px-2.5 py-2 border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40"
        >
          {DOSAGE_OPTIONS.map((d) => (
            <option key={d} value={d}>{DOSAGE_LABELS[d]}</option>
          ))}
        </select>
        <Toggle on={med.taken} onChange={(v) => setMed(name, { taken: v })} />
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive p-1 rounded active:scale-90"
            aria-label={`Remove ${name}`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {med.taken && (
        <label className="mt-2 flex items-center justify-end gap-2 cursor-pointer select-none">
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${med.is_rescue ? "text-[oklch(0.58_0.20_25)]" : "text-muted-foreground"}`}>
            Rescue dose
          </span>
          <input
            type="checkbox"
            checked={!!med.is_rescue}
            onChange={(e) => setMed(name, { is_rescue: e.target.checked })}
            className="w-4 h-4 rounded border-border accent-[oklch(0.58_0.20_25)]"
          />
        </label>
      )}
    </div>
  );
}

function NumInput({ value, onChange, max, suffix }: { value: number; onChange: (v: number) => void; max: number; suffix: string }) {
  return (
    <div className="flex-1 flex items-center gap-1 bg-muted rounded-lg px-2.5 py-1.5">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={String(value)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          if (raw === "") { onChange(0); return; }
          const parsed = parseInt(raw, 10);
          if (Number.isNaN(parsed)) { onChange(0); return; }
          onChange(Math.max(0, Math.min(max, parsed)));
        }}
        className="w-full bg-transparent text-center text-base font-mono font-medium text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-xs text-muted-foreground">{suffix}</span>
    </div>
  );
}
