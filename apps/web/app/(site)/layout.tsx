import { Nav } from "@/components/Nav";

// Site pages carry the navigation bar. The canvas route lives outside this group and draws its
// own floating chrome over a full-screen scene instead.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </>
  );
}
