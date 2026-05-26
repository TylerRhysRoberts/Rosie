import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Trash2, LogOut, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/BottomNav";
import {
  DailyLog, HealthScore, SCORE_META, SYMPTOM_OPTIONS, MEDICATION_NAMES,
  LOCATION_OPTIONS, DOSAGE_OPTIONS, DOSAGE_LABELS, Walk,
  emptyLog, todayKey, fetchLogByDate, upsertLog,
} from "@/lib/daily-logs";

export const Route = createFileRoute("/app")({
  component: LogPage,
  head: () => ({
    meta: [
      { title: "Rosie Health Hub — Log Today" },
      { name: "description", content: "Daily health log entry." },
    ],
  }),
});

function LogPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayKey());
  const [log, setLog] = useState<DailyLog>(emptyLog());
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

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
      // "None" is exclusive
      if (!has && s === "None (Normal)") symptoms = ["None (Normal)"];
      else if (!has) symptoms = symptoms.filter((x) => x !== "None (Normal)");
      return { ...prev, symptoms };
    });
  };

  const setMed = (name: string, partial: Partial<{ taken: boolean; dosage: string }>) => {
    setLog((prev) => ({
      ...prev,
      medications: {
        ...prev.medications,
        [name]: { ...prev.medications[name], ...partial } as any,
      },
    }));
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

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const saved = await upsertLog(user.id, log);
      setLog(saved);
      toast.success("Log saved", { description: "Your daily entry has been recorded." });
    } catch (err: any) {
      toast.error("Save failed", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !mounted) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-lg mx-auto px-5 pt-10">
        <div className="flex items-start justify-between animate-fade-up-blur">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Rosie Health Hub</p>
            <h1 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">Daily Log</h1>
          </div>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
            className="text-muted-foreground hover:text-foreground p-2 rounded-lg active:scale-95"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 space-y-5">
          {/* Date selector */}
          <Section label="Date">
            <input
              type="date"
              value={date}
              max={todayKey()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Section>

          {/* Overall score */}
          <Section label="Overall Health Score">
            <div className="grid grid-cols-3 gap-3">
              {([3, 2, 1] as HealthScore[]).map((s) => {
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

          {/* Symptoms */}
          <Section label="Symptoms">
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_OPTIONS.map((s) => {
                const active = log.symptoms.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleSymptom(s)}
                    className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {active && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
                    {s}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Medications */}
          <Section label="Medications">
            <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
              {MEDICATION_NAMES.map((name) => {
                const med = log.medications[name];
                return (
                  <div key={name} className="flex items-center gap-3 px-4 py-3">
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
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Location */}
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

          {/* Routine type */}
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

          {/* Walks */}
          <Section label="Walks" hint={`${log.walks.length}/3`}>
            <div className="space-y-2">
              {log.walks.map((w, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-card border border-border p-3">
                  <span className="text-xs font-semibold text-muted-foreground w-12">Walk {i + 1}</span>
                  <NumInput value={w.hours} onChange={(v) => setWalk(i, { hours: v })} max={12} suffix="h" />
                  <NumInput value={w.minutes} onChange={(v) => setWalk(i, { minutes: v })} max={59} suffix="m" />
                  <button onClick={() => removeWalk(i)} className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg active:scale-90" aria-label="Remove walk">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
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

          {/* Notes */}
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
            {saving ? "Saving…" : log.id ? "Update entry" : "Save entry"}
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted-foreground/25"}`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function NumInput({ value, onChange, max, suffix }: { value: number; onChange: (v: number) => void; max: number; suffix: string }) {
  return (
    <div className="flex-1 flex items-center gap-1 bg-muted rounded-lg px-2.5 py-1.5">
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Math.max(0, Math.min(max, Number(e.target.value) || 0));
          onChange(n);
        }}
        className="w-full bg-transparent text-center text-base font-mono font-medium text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-xs text-muted-foreground">{suffix}</span>
    </div>
  );
}
