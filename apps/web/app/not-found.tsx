import { Nav } from "@/components/Nav";
import SiteNotFound from "./(site)/not-found";

// An address that matches no route renders here, under the root layout, which no longer draws
// the navigation bar itself: the site's bar and the site's own not-found page.
export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <SiteNotFound />
      </main>
    </>
  );
}
