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
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [mounted, setMounted] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showNotScheduled, setShowNotScheduled] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const isCloud = !!user;

  const reorderScheduledHabits = useCallback((currentHabits: Habit[], activeId: string, overId: string) => {
    const scheduled = currentHabits.filter((h) => isScheduledToday(h));
    const activeIndex = scheduled.findIndex((h) => h.id === activeId);
    const overIndex = scheduled.findIndex((h) => h.id === overId);

    if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
      return currentHabits;
    }

    const reorderedScheduled = arrayMove(scheduled, activeIndex, overIndex);
    let scheduledPointer = 0;

    return currentHabits.map((habit) => {
      if (!isScheduledToday(habit)) return habit;
      const nextHabit = reorderedScheduled[scheduledPointer];
      scheduledPointer += 1;
      return nextHabit;
    });
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const loadData = async () => {
      if (user) {
        try {
          await migrateLocalToCloud(user.id);
          const [h, l] = await Promise.all([
            fetchHabitsFromCloud(user.id),
            fetchLogsFromCloud(user.id),
          ]);
          setHabits(h);
          setLogs(l);
          rescheduleAllReminders(h);
        } catch (err) {
          console.error("Failed to load from cloud:", err);
          // Fallback to local
          const h = getHabits();
          setHabits(h);
          setLogs(getLogs());
          rescheduleAllReminders(h);
        }
      } else {
        const h = getHabits();
        setHabits(h);
        setLogs(getLogs());
        setShowOnboarding(!isOnboarded() && h.length === 0);
        rescheduleAllReminders(h);
      }
      setMounted(true);
    };

    loadData();
  }, [user, authLoading]);

  const handleToggle = async (habitId: string) => {
    const streakBefore = getStreak(habitId, logs, habits);
    const today = todayKey();
    const exists = isCompletedToday(habitId, logs);

    // Optimistic update
    const updated = toggleHabit(habitId, logs);
    setLogs(updated);

    if (isCloud && user) {
      try {
        await toggleLogInCloud(habitId, today, user.id, exists);
      } catch (err) {
        console.error("Cloud toggle failed:", err);
      }
    } else {
      saveLogs(updated);
    }

    const streakAfter = getStreak(habitId, updated, habits);
    if (streakAfter > streakBefore) {
      const msg = getMilestoneMessage(streakAfter);
      if (msg) {
        const habit = habits.find((h) => h.id === habitId);
        toast.success(msg, { description: habit?.name });
      }
    }
  };

  const handleAdd = async (habit: Habit) => {
    const updated = [...habits, habit];
    setHabits(updated);
    scheduleReminder(habit);

    if (isCloud && user) {
      try {
        await saveHabitToCloud(habit, user.id, updated.length - 1);
      } catch (err) {
        console.error("Cloud save failed:", err);
      }
    } else {
      saveHabits(updated);
    }
  };

  const handleEdit = async (updatedHabit: Habit) => {
    const newHabits = updateHabit(habits, updatedHabit);
    setHabits(newHabits);
    scheduleReminder(updatedHabit);

    if (isCloud) {
      try {
        await updateHabitInCloud(updatedHabit);
      } catch (err) {
        console.error("Cloud update failed:", err);
      }
    } else {
      saveHabits(newHabits);
    }
  };

  const handleDelete = async (habitId: string) => {
    const updated = habits.filter((h) => h.id !== habitId);
    setHabits(updated);

    if (isCloud) {
      try {
        await deleteHabitFromCloud(habitId);
      } catch (err) {
        console.error("Cloud delete failed:", err);
      }
    } else {
      saveHabits(updated);
    }
    toast("Habit removed");
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setHabits((currentHabits) => reorderScheduledHabits(currentHabits, String(active.id), String(over.id)));
  }, [reorderScheduledHabits]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const reordered = reorderScheduledHabits(habits, String(active.id), String(over.id));
    if (reordered === habits) return;

    if (isCloud) {
      try {
        await reorderHabitsInCloud(reordered);
      } catch (err) {
        console.error("Cloud reorder failed:", err);
      }
    } else {
      saveHabits(reordered);
    }
  }, [habits, isCloud, reorderScheduledHabits]);

  const handleOnboardingComplete = (habit?: Habit) => {
    setShowOnboarding(false);
    if (habit) {
      handleAdd(habit);
    }
  };

  // Split habits into scheduled today and not scheduled
  const scheduledToday = habits.filter((h) => isScheduledToday(h));
  const notScheduledToday = habits.filter((h) => !isScheduledToday(h));

  const completedCount = scheduledToday.filter((h) => isCompletedToday(h.id, logs)).length;
  const allDone = scheduledToday.length > 0 && completedCount === scheduledToday.length;

  if (!mounted || authLoading) return null;

  if (showOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const subtitle = scheduledToday.length === 0 && habits.length > 0
    ? "Nothing scheduled today"
    : scheduledToday.length === 0
      ? ""
      : allDone
        ? "All done for today ✨"
        : `${completedCount} of ${scheduledToday.length} done`;

  return (
    <div className="min-h-screen pb-28 relative">
      <div className="relative max-w-lg mx-auto px-5 pt-12">
        {/* Header */}
        <div className="flex items-start justify-between animate-fade-up-blur">
          <div>
            <p className="text-[13px] text-muted-foreground font-medium">{greeting}</p>
            <h1 className="text-2xl font-semibold text-foreground mt-0.5 tracking-tight" style={{ lineHeight: "1.2" }}>
              {allDone ? (
                <span className="flex items-center gap-2">
                  Perfect day
                  <Sparkles className="w-5 h-5 text-primary" />
                </span>
              ) : (
                "Your daily ritual"
              )}
            </h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{dateStr} · {subtitle}</p>}
            {!subtitle && <p className="text-sm text-muted-foreground mt-1">{dateStr}</p>}
          </div>
          {scheduledToday.length > 0 && (
            <div className="flex-shrink-0 -mt-1">
              <ProgressRing completed={completedCount} total={scheduledToday.length} />
            </div>
          )}
        </div>

        {/* Habit list */}
        {habits.length === 0 ? (
          <div className="border-2 border-dashed border-muted-foreground/20 rounded-2xl py-16 px-6 text-center animate-fade-up-blur mt-6" style={{ animationDelay: "160ms" }}>
            <Leaf className="w-7 h-7 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-foreground font-semibold text-lg">A fresh start</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-[240px] mx-auto" style={{ textWrap: "pretty" }}>
              Tap the + button below to add your first habit
            </p>
          </div>
        ) : (
          <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
            <SortableContext items={scheduledToday.map((h) => h.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3 mt-6">
                {scheduledToday.map((habit, i) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    logs={logs}
                    habits={habits}
                    index={i}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onEdit={(h) => setEditHabit(h)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeId ? (() => {
                const habit = scheduledToday.find((h) => h.id === activeId);
                if (!habit) return null;
                const i = scheduledToday.indexOf(habit);
                return (
                  <div className="relative" style={{ width: "100%" }}>
                    <div className="relative overflow-hidden rounded-lg bg-card shadow-[0_8px_24px_rgba(0,0,0,0.15)] cursor-grabbing">
                      <div className="absolute left-2.5 top-3 bottom-3 w-1 rounded-full" style={{ backgroundColor: habit.color }} />
                      <div className="flex items-center gap-3 p-4 pl-6">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center ${isCompletedToday(habit.id, logs) ? "border-transparent" : "border-border bg-background"}`}
                          style={isCompletedToday(habit.id, logs) ? { backgroundColor: habit.color } : undefined}>
                          {isCompletedToday(habit.id, logs) && <Check className="w-5 h-5 text-white" strokeWidth={2.5} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-[15px] leading-snug ${isCompletedToday(habit.id, logs) ? "line-through text-muted-foreground" : "text-foreground"}`}>{habit.name}</p>
                          {habit.description && <p className="text-sm text-muted-foreground mt-0.5 truncate">{habit.description}</p>}
                        </div>
                        {getStreak(habit.id, logs, habits) > 0 && (
                          <div className="flex items-baseline gap-0.5">
                            <span className="font-mono text-base font-semibold text-foreground tabular-nums">{getStreak(habit.id, logs, habits)}</span>
                            <span className="text-xs text-muted-foreground font-medium">d</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })() : null}
            </DragOverlay>
          </DndContext>

            {notScheduledToday.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowNotScheduled(!showNotScheduled)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-2 hover:text-foreground transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showNotScheduled ? "rotate-0" : "-rotate-90"}`} />
                  Not scheduled today ({notScheduledToday.length})
                </button>
                {showNotScheduled && (
                  <div className="space-y-2 opacity-60">
                    {notScheduledToday.map((habit) => (
                      <button
                        key={habit.id}
                        onClick={() => setEditHabit(habit)}
                        className="flex items-center gap-3 rounded-xl bg-card/50 px-4 py-3 w-full text-left hover:bg-card/80 transition-colors"
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: habit.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground">{habit.name}</p>
                          <p className="text-[11px] text-muted-foreground/60">{frequencyLabel(habit.frequency)}</p>
                        </div>
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground/40" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav onAddClick={() => setSheetOpen(true)} />
      <AddHabitSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={handleAdd} />
      <EditHabitSheet habit={editHabit} onClose={() => setEditHabit(null)} onSave={handleEdit} onDelete={handleDelete} />
    </div>
  );
}
