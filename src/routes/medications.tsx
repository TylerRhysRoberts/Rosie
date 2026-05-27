import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  DailyLog,
  fetchLogs,
  DOSAGE_LABELS,
  DosageSize,
} from "@/lib/daily-logs";
import { Pill } from "lucide-react";
import rosieLogo from "@/assets/rosie-icon.png";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/medications")({
  component: MedicationsPage,
  head: () => ({
    meta: [
      { title: "Rosie Health Hub — Medications" },
      { name: "description", content: "Medication tracking grid by day." },
    ],
  }),
});

const SHORT_DOSAGE: Record<DosageSize, string> = {
  whole: "Whole",
  half: "Half",
  third: "1/3",
  quarter: "1/4",
  eighth: "1/8",
};

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function MedicationsPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [mounted, setMounted] = useState(false);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(7);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    fetchLogs(user.id, 180)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setMounted(true));
  }, [user, isLoading, navigate]);

  // Build list of days within range (oldest -> newest)
  const days = useMemo(() => {
    const arr: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(dateKey(d));
    }
    return arr;
  }, [rangeDays]);

  const daySet = useMemo(() => new Set(days), [days]);

  // Aggregate medications: per name, total taken count across ALL history
  // and per-day dosage info within active range.
  const meds = useMemo(() => {
    const totals: Record<string, number> = {};
    const perDay: Record<string, Record<string, DosageSize>> = {};
    for (const log of logs) {
      for (const [name, m] of Object.entries(log.medications || {})) {
        if (!m?.taken) continue;
        totals[name] = (totals[name] || 0) + 1;
        if (daySet.has(log.log_date)) {
          if (!perDay[name]) perDay[name] = {};
          perDay[name][log.log_date] = m.dosage;
        }
      }
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, days: perDay[name] || {} }));
  }, [logs, daySet]);

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto px-5 pt-10 pb-28">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <img src={rosieLogo} alt="Rosie" className="w-9 h-9 rounded-full" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">
                Medications
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Dosage history at a glance
              </p>
            </div>
          </div>
        </header>

        {/* Sticky range filter */}
        <div className="sticky top-0 z-10 -mx-5 px-5 pb-3 bg-background">
          <div className="flex gap-2 bg-muted rounded-full p-1">
            {([7, 30, 90] as const).map((n) => (
              <button
                key={n}
                onClick={() => setRangeDays(n)}
                className={`flex-1 text-sm font-medium py-2 rounded-full transition-colors ${
                  rangeDays === n
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {n} Days
              </button>
            ))}
          </div>
        </div>

        {meds.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
            <Pill className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">No medication history yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-1">
            {meds.map((m) => (
              <div
                key={m.name}
                className="rounded-2xl bg-card border border-border p-4"
              >
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {m.name}
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    {m.count} {m.count === 1 ? "dose" : "doses"} total
                  </span>
                </div>
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                  }}
                >
                  {days.map((d) => {
                    const dose = m.days[d];
                    const taken = !!dose;
                    return (
                      <div
                        key={d}
                        title={`${d}${dose ? ` · ${DOSAGE_LABELS[dose]}` : ""}`}
                        className={`aspect-[1/2.4] rounded-full flex items-center justify-center text-[8px] font-semibold leading-none px-0.5 ${
                          taken
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/60 border border-border text-transparent"
                        }`}
                      >
                        <span className="rotate-0 text-center break-words">
                          {taken ? SHORT_DOSAGE[dose!] : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}