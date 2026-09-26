import { Nav } from "@/components/Nav";

// Site pages carry the navigation bar. The canvas route lives outside this group and draws its
// own floating chrome over a full-screen scene instead. `.site` scopes the site's skin in
// globals.css (dotted surface, float cards, 40px controls) so the canvas keeps its own.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
