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

const PROVIDERS = [
  "aws",
  "azure",
  "gcp",
  "oci",
  "cloudflare",
  "ibm",
  "alibabacloud",
  "digitalocean",
  "openstack",
  "outscale",
  "k8s",
];

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
    const s = p.toString();
    return s ? `/browse?${s}` : "/browse";
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-4">
        <h1 className="title">{mine ? "My designs" : "Browse"}</h1>
        {viewer ? (
          <Link href={mine ? "/browse" : "/browse?owner=me"} className="small link">
            {mine ? "Show public designs" : "Show only mine"}
          </Link>
        ) : null}
      </div>
      <form className="flex flex-wrap items-center gap-3" method="get">
        {mine ? <input type="hidden" name="owner" value="me" /> : null}
        {sp.provider ? <input type="hidden" name="provider" value={sp.provider} /> : null}
        <input
          className="input"
          style={{ maxWidth: 340 }}
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search designs, or a component name"
        />
        <div className="flex gap-1">
          {PROVIDERS.map((p) => (
            <Link
              key={p}
              href={link({ provider: sp.provider === p ? undefined : p, page: undefined })}
              className={`tag tag-mono no-underline${sp.provider === p ? " tag-accent" : ""}`}
            >
              {p}
            </Link>
          ))}
        </div>
        <select className="input" style={{ width: 200 }} name="kind" defaultValue={sp.kind ?? ""}>
          <option value="">Any kind</option>
          {Object.keys(cat.kinds).map((k) => (
            <option key={k} value={k}>
              {cat.locale.kinds[k]?.name ?? k}
            </option>
          ))}
        </select>
        <select
          className="input"
          style={{ width: 170 }}
          name="sort"
          defaultValue={sp.sort ?? "updated"}
        >
          <option value="updated">Recently updated</option>
          <option value="created">Newest</option>
          <option value="clones">Most cloned</option>
          <option value="exports">Most exported</option>
        </select>
        <button className="btn" type="submit">
          Filter
        </button>
        {viewer ? (
          <Link href="/new" className="btn btn-primary ml-auto no-underline">
            New design
          </Link>
        ) : null}
      </form>
      <span className="label">
        {result.total} design{result.total === 1 ? "" : "s"}
      </span>
      {result.items.length === 0 ? (
        <div className="empty">
          Nothing matches. Try a product name, or a provider chip.
          {mine ? (
            <>
              {" "}
              <Link href="/new" className="link">
                Create a design.
              </Link>
            </>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((d) => (
            <DesignCard key={d.id} d={d} />
          ))}
        </div>
      )}
      {pages > 1 ? (
        <div className="flex items-center gap-3 small">
          {result.page > 1 ? (
            <Link
              href={link({ page: String(result.page - 1) })}
              className="btn btn-sm no-underline"
            >
              ← Previous
            </Link>
          ) : null}
          <span className="mono muted">
            {result.page} / {pages}
          </span>
          {result.page < pages ? (
            <Link
              href={link({ page: String(result.page + 1) })}
              className="btn btn-sm no-underline"
            >
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
