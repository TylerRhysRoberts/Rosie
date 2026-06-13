import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { NotificationQueueProvider } from "@/components/NotificationQueueProvider";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Rosie Health Hub" },
      { name: "description", content: "Rosie's private daily health log — score, symptoms, medications, walks." },
      { name: "author", content: "Rosie Health Hub" },
      { name: "theme-color", content: "#FDFBF7" },
      { property: "og:title", content: "Rosie Health Hub" },
      { name: "twitter:title", content: "Rosie Health Hub" },
      { property: "og:description", content: "Rosie's private daily health log — score, symptoms, medications, walks." },
      { name: "twitter:description", content: "Rosie's private daily health log — score, symptoms, medications, walks." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/0482db18-6057-4010-bb4d-ffbf0accba6a" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/0482db18-6057-4010-bb4d-ffbf0accba6a" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
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
      {
        rel: "manifest",
        href: "/manifest.webmanifest",
      },
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
      <body className="h-[100dvh] overflow-hidden pb-[env(safe-area-inset-bottom)]">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const clearLegacyOfflineCache = async () => {
      const hadController = Boolean(navigator.serviceWorker?.controller);
      const registrations = await navigator.serviceWorker?.getRegistrations() ?? [];
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }

      const reloadKey = "rosie-offline-cache-cleared";
      if (hadController && sessionStorage.getItem(reloadKey) !== "true") {
        sessionStorage.setItem(reloadKey, "true");
        window.location.reload();
      }
    };

    clearLegacyOfflineCache().catch(() => {});
  }, []);

  return (
    <>
      <div className="animate-page-enter h-[100dvh] w-full overflow-hidden flex flex-col">
        <NotificationQueueProvider>
          <Outlet />
        </NotificationQueueProvider>
      </div>
      <Toaster position="top-center" />
    </>
  );
}
