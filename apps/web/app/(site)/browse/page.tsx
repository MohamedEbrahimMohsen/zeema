import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Browse is the front page now. The old path stays as a redirect so existing links, bookmarks
// and the filter query strings people have shared keep working.
export default async function BrowseRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) p.set(k, v);
  const q = p.toString();
  redirect(q ? `/?${q}` : "/");
}
