import { Outlet, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Rosie Health Hub" },
      { name: "description", content: "A private daily health log — score, symptoms, medications, walks." },
      { name: "author", content: "Rosie Health Hub" },
      { name: "theme-color", content: "#FDFBF7" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/rosie-icon.png" },
      { rel: "apple-touch-icon", href: "/rosie-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
    scripts: [],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { pathname } = useLocation();
  const isAppShellRoute = pathname === "/app" || pathname === "/history" || pathname === "/insights";

  return (
    <>
      {isAppShellRoute ? (
        <div className="h-[100dvh] overflow-hidden bg-background">
          <div className="mx-auto flex h-full w-full max-w-lg flex-col">
            <main className="min-h-0 flex-1 animate-page-enter">
              <Outlet />
            </main>
            <BottomNav />
          </div>
        </div>
      ) : (
        <div className="animate-page-enter">
          <Outlet />
        </div>
      )}
      <Toaster position="top-center" />
    </>
  );
}
