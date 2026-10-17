import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { applyBrowserAccountWipe } from "@/lib/account-wipe";
import { applyLoadAccountWipe } from "@/lib/account-wipe-load";
import appCss from "../styles.css?url";

import { SCHOOL_NAME } from "@/lib/brand";

// Before React reads the preview bearer. Each tab and this browser run it once.
applyBrowserAccountWipe();

export const Route = createRootRoute({
  loader: () => applyLoadAccountWipe(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SCHOOL_NAME },
      {
        name: "description",
        content:
          "An online academy for homeschool families. Each child has a private office, and the work sits in Vygotsky's zone of proximal development.",
      },
      { name: "theme-color", content: "#2c5e4a" },
      { name: "apple-mobile-web-app-title", content: "Do the Impossible" },
      { property: "og:site_name", content: SCHOOL_NAME },
      { property: "og:title", content: SCHOOL_NAME },
      {
        property: "og:description",
        content:
          "An online academy for homeschool families. Each child has a private office, and the work sits in Vygotsky's zone of proximal development.",
      },
      { property: "og:image", content: "/logo-splash.png" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,560;9..144,600;9..144,640;9..144,650&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
