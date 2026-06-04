import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import confetti from "canvas-confetti";

interface Props {
  open: boolean;
  milestoneName: string;
  totalMiles: number;
  year: number;
  onClose: () => void;
}

export function MilestoneCelebration({ open, milestoneName, totalMiles, year, onClose }: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const fire = () => {
      confetti({
        particleCount: 160,
        spread: 90,
        startVelocity: 45,
        origin: { x: 0.5, y: 0.5 },
      });
    };
    fire();
    const t1 = setTimeout(fire, 250);
    const t2 = setTimeout(fire, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-5 animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-card border border-border shadow-xl p-6 text-center animate-scale-in">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          🎉 Milestone Unlocked!
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          You and Rosie have reached <span className="font-semibold">{milestoneName}</span>! That's a total of{" "}
          <span className="font-semibold">{totalMiles.toFixed(2)}</span> miles covered together so far in {year}.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={() => {
              onClose();
              navigate({ to: "/distance-covered" });
            }}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            See Rosie's Progress
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-muted text-foreground text-sm font-medium border border-border active:scale-[0.98] transition-transform"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}