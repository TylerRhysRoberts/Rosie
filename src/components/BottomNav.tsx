import { Link, useLocation } from "@tanstack/react-router";
import { ClipboardList, History as HistoryIcon, LineChart } from "lucide-react";

export function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const navItems = [
    { to: "/app" as const, icon: ClipboardList, label: "Log Today" },
    { to: "/history" as const, icon: HistoryIcon, label: "History" },
    { to: "/insights" as const, icon: LineChart, label: "Insights" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 w-full pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-lg px-3 pb-3">
        <nav className="flex items-stretch rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-1.5 shadow-[0_-4px_20px_-6px_rgba(0,0,0,0.08)]">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = path === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-medium transition-colors duration-200 active:scale-95 ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-[20px] h-[20px]" strokeWidth={isActive ? 2.4 : 2} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
