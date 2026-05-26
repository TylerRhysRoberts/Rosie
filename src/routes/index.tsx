import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/")({
  component: SplashPage,
  head: () => ({
    meta: [
      { title: "Rosie Health Hub" },
      { name: "description", content: "A private daily health log." },
    ],
  }),
});

function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) navigate({ to: "/app", search: {} });
        else navigate({ to: "/login" });
      });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mb-5">
        <Heart className="w-7 h-7 text-primary" fill="currentColor" />
      </div>
      <h1 className="text-xl font-semibold text-foreground tracking-tight">Rosie Health Hub</h1>
      <p className="text-sm text-muted-foreground mt-1">Loading…</p>
    </div>
  );
}
