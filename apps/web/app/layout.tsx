import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arkore",
  description: "Software architecture as typed, queryable data.",
};

// Runs before first paint: resolves the stored preference (system | light | dark) to a concrete
// data-theme so the tokens never flash, and follows the OS while the preference is "system".
const themeBoot = `(function(){try{var k="arkore-theme",p=localStorage.getItem(k)||"system",m=window.matchMedia("(prefers-color-scheme: dark)"),a=function(){var t=p==="system"?(m.matches?"dark":"light"):p;document.documentElement.setAttribute("data-theme",t)};a();m.addEventListener("change",function(){p=localStorage.getItem(k)||"system";a()})}catch(e){}})();`;

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
      </body>
    </html>
  );
}
