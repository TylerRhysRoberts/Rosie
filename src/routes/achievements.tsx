import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Lock } from "lucide-react";
import * as Lucide from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, type AchievementDef,
} from "@/lib/achievements";
import { fetchLogs, type DailyLog } from "@/lib/daily-logs";
import { loadMeta } from "@/lib/achievements-meta";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/profile/achievements")({
  component: AchievementsPage,
  head: () => ({
    meta: [
      { title: "Rosie Health Hub — Achievements" },
      { name: "description", content: "Lifetime achievements earned tracking Rosie's health." },
    ],
  }),
});

interface UnlockRow { achievement_id: string; unlocked_at: string }

function AchievementsPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [unlocks, setUnlocks] = useState<UnlockRow[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [meta, setMeta] = useState({ time_night: 0, update_diligent: 0 });
  const [active, setActive] = useState<AchievementDef | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    Promise.all([
      supabase.from("lifetime_achievements").select("achievement_id, unlocked_at").eq("user_id", user.id),
      fetchLogs(user.id, 4000),
    ])
      .then(([u, l]) => {
        if (u.data) setUnlocks(u.data as UnlockRow[]);
        setLogs((l ?? []).slice().sort((a, b) => a.log_date.localeCompare(b.log_date)));
        setMeta(loadMeta(user.id));
      })
      .finally(() => setReady(true));
  }, [user, isLoading, navigate]);

  const unlockedMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of unlocks) m.set(r.achievement_id, r.unlocked_at);
    return m;
  }, [unlocks]);

  const evalCtx = useMemo(() => ({
    logs, now: new Date(), savedAtNight: false, savedAsLateEdit: false, meta,
  }), [logs, meta]);

  if (!ready) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  const totalUnlocked = unlockedMap.size;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto pt-10 pb-16">
        <div className="flex items-center justify-between px-5 animate-fade-up-blur">
          <button
            onClick={() => navigate({ to: "/profile" })}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-muted text-foreground active:scale-95"
            aria-label="Back to profile"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Lifetime</p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Achievements</h1>
          </div>
        </div>

        <p className="px-5 mt-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{totalUnlocked}</span> of {ACHIEVEMENTS.length} unlocked.
        </p>

        <div className="mt-6 space-y-8">
          {ACHIEVEMENT_CATEGORIES.map((cat) => {
            const items = ACHIEVEMENTS.filter((a) => a.category === cat);
            return (
              <section key={cat} className="animate-fade-up-blur">
                <h2 className="px-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  {cat}
                </h2>
                <div
                  className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-5 pb-3 -mx-1 scrollbar-hide"
                  style={{ scrollbarWidth: "none" }}
                >
                  {items.map((a) => {
                    const unlockedAt = unlockedMap.get(a.id);
                    return (
                      <AchievementCard
                        key={a.id}
                        a={a}
                        unlockedAt={unlockedAt}
                        progress={a.progress(evalCtx)}
                        onTap={() => setActive(a)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          {active && <DetailSheet a={active} unlockedAt={unlockedMap.get(active.id)} progress={active.progress(evalCtx)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AchievementCard({
  a, unlockedAt, progress, onTap,
}: { a: AchievementDef; unlockedAt?: string; progress: { current: number; target: number }; onTap: () => void }) {
  const Icon = (Lucide as any)[a.icon] ?? Lucide.Trophy;
  const locked = !unlockedAt;
  const pct = Math.min(100, Math.round((progress.current / Math.max(progress.target, 1)) * 100));

  return (
    <button
      onClick={onTap}
      className="snap-start shrink-0 basis-[31%] min-w-[112px] max-w-[140px] rounded-2xl bg-card border border-border p-3 text-left active:scale-[0.98] transition-transform"
    >
      <div
        className="relative mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: locked
            ? "color-mix(in oklab, var(--muted-foreground) 12%, transparent)"
            : `color-mix(in oklab, ${a.color} 18%, transparent)`,
        }}
      >
        <Icon
          className="w-7 h-7"
          style={{
            color: locked ? "var(--muted-foreground)" : a.color,
            filter: locked ? "grayscale(1)" : "none",
            opacity: locked ? 0.6 : 1,
          }}
          strokeWidth={2}
        />
        {locked && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-card border border-border">
            <Lock className="w-2.5 h-2.5 text-muted-foreground" />
          </span>
        )}
      </div>
      <p className="text-[11px] font-semibold text-foreground text-center leading-tight line-clamp-2 min-h-[28px]">
        {a.name}
      </p>
      {locked ? (
        <div className="mt-2">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary/70 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-center text-muted-foreground tabular-nums">
            {progress.current} / {progress.target}
          </p>
        </div>
      ) : (
        <p className="mt-1.5 text-[10px] text-center text-muted-foreground">
          Unlocked {formatDate(unlockedAt!)}
        </p>
      )}
    </button>
  );
}

function DetailSheet({
  a, unlockedAt, progress,
}: { a: AchievementDef; unlockedAt?: string; progress: { current: number; target: number } }) {
  const Icon = (Lucide as any)[a.icon] ?? Lucide.Trophy;
  const locked = !unlockedAt;
  return (
    <div className="px-2 pb-6 pt-2">
      <SheetHeader className="text-center">
        <div
          className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{
            backgroundColor: locked
              ? "color-mix(in oklab, var(--muted-foreground) 12%, transparent)"
              : `color-mix(in oklab, ${a.color} 18%, transparent)`,
          }}
        >
          <Icon
            className="w-9 h-9"
            style={{
              color: locked ? "var(--muted-foreground)" : a.color,
              filter: locked ? "grayscale(1)" : "none",
            }}
          />
        </div>
        <SheetTitle className="text-lg text-center">{a.name}</SheetTitle>
        <SheetDescription className="text-center">{a.description}</SheetDescription>
      </SheetHeader>
      <div className="mt-5 mx-2 rounded-2xl bg-muted p-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Criteria</p>
        <p className="text-sm text-foreground leading-relaxed">{a.criteria}</p>
      </div>
      <div className="mt-3 mx-2 rounded-2xl bg-muted p-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Status</p>
        {locked ? (
          <>
            <p className="text-sm text-foreground tabular-nums">{progress.current} / {progress.target}</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-card overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.round((progress.current / Math.max(progress.target, 1)) * 100))}%` }} />
            </div>
          </>
        ) : (
          <p className="text-sm text-foreground">Unlocked on {formatDate(unlockedAt!)}.</p>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}