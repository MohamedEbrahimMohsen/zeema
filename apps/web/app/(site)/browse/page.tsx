import Link from "next/link";
import { DesignCard } from "@/components/DesignCard";
import { currentUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";
import { listDesigns } from "@/lib/designs";

export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  provider?: string;
  kind?: string;
  owner?: string;
  sort?: string;
  page?: string;
};

export default async function Browse({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const viewer = await currentUser();
  const cat = getCatalogue();
  const mine = sp.owner === "me";
  const result = await listDesigns(viewer, {
    q: sp.q,
    provider: sp.provider,
    kind: sp.kind,
    owner: mine ? undefined : sp.owner,
    scope: mine ? "mine" : "public",
    sort: (sp.sort as "updated" | "created" | "clones" | "exports") ?? "updated",
    page: Number(sp.page ?? 1),
  });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const link = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, String(v));
    return `/browse?${p.toString()}`;
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-4">
        <h1 className="text-2xl font-semibold">{mine ? "My designs" : "Browse"}</h1>
        <span className="muted text-sm">
          {result.total} design{result.total === 1 ? "" : "s"}
        </span>
        {viewer ? (
          <Link href={mine ? "/browse" : "/browse?owner=me"} className="text-sm">
            {mine ? "Show public designs" : "Show only mine"}
          </Link>
        ) : null}
      </div>
      <form className="panel grid gap-2 p-3 sm:grid-cols-[1fr_160px_200px_140px_auto]" method="get">
        {mine ? <input type="hidden" name="owner" value="me" /> : null}
        <input
          className="input"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search title, summary, components"
        />
        <select className="input" name="provider" defaultValue={sp.provider ?? ""}>
          <option value="">Any provider</option>
          {["aws", "azure", "gcp", "oci", "cloudflare", "default"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select className="input" name="kind" defaultValue={sp.kind ?? ""}>
          <option value="">Any kind</option>
          {Object.keys(cat.kinds).map((k) => (
            <option key={k} value={k}>
              {cat.locale.kinds[k]?.name ?? k}
            </option>
          ))}
        </select>
        <select className="input" name="sort" defaultValue={sp.sort ?? "updated"}>
          <option value="updated">Recently updated</option>
          <option value="created">Newest</option>
          <option value="clones">Most cloned</option>
          <option value="exports">Most exported</option>
        </select>
        <button className="btn btn-primary" type="submit">
          Filter
        </button>
      </form>
      {result.items.length === 0 ? (
        <p className="muted">
          Nothing matches. {mine ? <Link href="/new">Create a design.</Link> : null}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((d) => (
            <DesignCard key={d.id} d={d} />
          ))}
        </div>
      )}
      {pages > 1 ? (
        <div className="flex items-center gap-3 text-sm">
          {result.page > 1 ? (
            <Link href={link({ page: String(result.page - 1) })}>← Previous</Link>
          ) : null}
          <span className="muted">
            Page {result.page} of {pages}
          </span>
          {result.page < pages ? (
            <Link href={link({ page: String(result.page + 1) })}>Next →</Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
