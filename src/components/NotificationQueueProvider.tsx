import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import confetti from "canvas-confetti";
import * as Lucide from "lucide-react";
import type { AchievementDef } from "@/lib/achievements";

export type QueueItem =
  | { kind: "achievement"; id: string; achievement: AchievementDef };

interface QueueCtx {
  enqueue: (item: QueueItem) => void;
}
const Ctx = createContext<QueueCtx | null>(null);

export function useNotificationQueue(): QueueCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("NotificationQueueProvider missing");
  return v;
}

export function NotificationQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const navigate = useNavigate();

  const enqueue = useCallback((item: QueueItem) => {
    setQueue((q) => (q.find((x) => x.id === item.id) ? q : [...q, item]));
  }, []);

  const head = queue[0];

  useEffect(() => {
    if (!head) return;
    // Confetti burst when a new head mounts
    const fire = () => confetti({
      particleCount: 160, spread: 90, startVelocity: 45, origin: { x: 0.5, y: 0.45 },
    });
    fire();
    const t1 = setTimeout(fire, 250);
    const t2 = setTimeout(fire, 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [head?.id]);

  const dismiss = () => setQueue((q) => q.slice(1));
  const view = () => {
    setQueue((q) => q.slice(1));
    navigate({ to: "/profile/achievements" });
  };

  const value = useMemo(() => ({ enqueue }), [enqueue]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {head && head.kind === "achievement" && (
        <AchievementModal a={head.achievement} onDismiss={dismiss} onView={view} />
      )}
    </Ctx.Provider>
  );
}

function AchievementModal({
  a, onDismiss, onView,
}: { a: AchievementDef; onDismiss: () => void; onView: () => void }) {
  const Icon = (Lucide as any)[a.icon] ?? Lucide.Trophy;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-5 animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-card border border-border shadow-xl p-6 text-center animate-scale-in">
        <div
          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl"
          style={{ backgroundColor: `color-mix(in oklab, ${a.color} 18%, transparent)` }}
        >
          <Icon className="w-10 h-10" style={{ color: a.color }} strokeWidth={2} />
        </div>
        <p className="text-xs uppercase tracking-widest font-semibold text-primary">
          Achievement Unlocked!
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{a.name}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.description}</p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={onView}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            View Achievements Screen
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-3 rounded-xl bg-muted text-foreground text-sm font-medium border border-border active:scale-[0.98] transition-transform"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}