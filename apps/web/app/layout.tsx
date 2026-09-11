import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arkore",
  description: "Software architecture as typed, queryable data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" suppressHydrationWarning>
        <Nav />
        {children}
      </body>
    </html>
  );
}
