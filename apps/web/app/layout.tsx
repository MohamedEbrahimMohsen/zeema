import type { Metadata } from "next";
import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { RouteSpinner } from "@/components/RouteSpinner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arkore",
  description: "Software architecture as typed, queryable data.",
};

// Runs before first paint: applies the stored theme so the tokens never flash. A first visit has
// nothing stored, so the OS preference is resolved once and saved as the user's setting.
const themeBoot = `(function(){try{var k="arkore-theme",t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";localStorage.setItem(k,t)}document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme boot, no user data */}
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-screen" suppressHydrationWarning>
        <Nav />
        {children}
        <Suspense fallback={null}>
          <RouteSpinner />
        </Suspense>
      </body>
    </html>
  );
}
