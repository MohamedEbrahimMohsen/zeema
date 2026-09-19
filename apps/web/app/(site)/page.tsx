import Link from "next/link";
import { DesignRow } from "@/components/DesignRow";
import { SearchBox, type Suggestion } from "@/components/SearchBox";
import { actingAdmin, currentUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";
import { listDesigns, listOwners } from "@/lib/designs";
import { isTier, parseQuery, providersOf, TIERS, withoutToken } from "@/lib/search-query";

export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  /** Kept so links shared before the search box existed still resolve. */
  provider?: string;
  kind?: string;
  owner?: string;
  origin?: string;
  sort?: string;
  page?: string;
  /** Acting admins: `all` or `private` to include what the public cannot see. */
  scope?: string;
};

export default async function Browse({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const viewer = await currentUser();
  const cat = getCatalogue();
  const parsed = parseQuery(sp.q, cat);
  // A legacy query parameter still filters, but the typed token wins where both are present.
  const owner = parsed.owner ?? sp.owner;
  const mine = owner === "me" || (viewer ? owner === viewer.username : false);
  const admin = actingAdmin(viewer);
  const adminScope = admin && (sp.scope === "all" || sp.scope === "private") ? sp.scope : null;
  const [result, owners] = await Promise.all([
    listDesigns(viewer, {
      q: parsed.text,
      provider: parsed.provider ?? sp.provider,
      kind: parsed.kind ?? sp.kind,
      origin: parsed.origin ?? (isTier(sp.origin) ? sp.origin : undefined),
      owner: mine ? undefined : owner,
      scope: mine ? "mine" : adminScope ? "all" : "public",
      visibility: adminScope === "private" ? "private" : undefined,
      sort: (sp.sort as "updated" | "created" | "clones" | "exports") ?? "updated",
      page: Number(sp.page ?? 1),
    }),
    listOwners(viewer),
  ]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const link = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, String(v));
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };
  // Tiers first: they are the three words most people want, and the provider list is long.
  const tags: Suggestion[] = [
    ...TIERS.map((t) => ({ value: `#${t}`, hint: "tier" })),
    ...[...providersOf(cat)].sort().map((p) => ({ value: `#${p}`, hint: "provider" })),
    ...Object.keys(cat.kinds)
      .sort()
      .map((k) => ({ value: `#${k}`, hint: "kind" })),
  ];
  const heading = mine
    ? "My designs"
    : adminScope === "private"
      ? "Private designs"
      : adminScope
        ? "All designs"
        : "Browse designs";
  return (
    <div className="browse">
      <div className="browse-head flex flex-wrap items-baseline gap-4">
        <h1>{heading}</h1>
        {admin ? (
          <span className="small flex gap-3">
            <Link
              href={
                adminScope === "private" ? link({ scope: undefined }) : link({ scope: "private" })
              }
              className="link"
            >
              {adminScope === "private" ? "Public only" : "Private designs"}
            </Link>
            <Link
              href={adminScope === "all" ? link({ scope: undefined }) : link({ scope: "all" })}
              className="link"
            >
              {adminScope === "all" ? "Public only" : "Everything"}
            </Link>
          </span>
        ) : null}
        <div className="browse-facts">
          <span>
            <b>{result.total}</b> design{result.total === 1 ? "" : "s"}
          </span>
          <span>
            <b>{Object.keys(cat.kinds).length}</b> kinds
          </span>
          <span>
            <b>{Object.keys(cat.components).length}</b> components
          </span>
          <span>
            <b>{cat.rules.length}</b> rules
          </span>
        </div>
      </div>
      <form className="browse-tools" method="get">
        {adminScope ? <input type="hidden" name="scope" value={adminScope} /> : null}
        <SearchBox
          defaultValue={sp.q ?? ""}
          owners={owners}
          tags={tags}
          placeholder="Search designs — @owner, #aws, #reference"
        />
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
          Search
        </button>
        {viewer ? (
          <Link
            href={
              mine
                ? link({ q: withoutToken(sp.q, `@${viewer.username}`), owner: undefined })
                : `/?q=@${viewer.username}`
            }
            className="btn btn-sm no-underline"
          >
            {mine ? "Show all" : "Only mine"}
          </Link>
        ) : null}
      </form>
      {parsed.tokens.length ? (
        <div className="browse-pills">
          {parsed.tokens.map((t) => (
            <Link
              key={t.raw}
              href={link({ q: withoutToken(sp.q, t.raw) || undefined, page: undefined })}
              className="pill-filter no-underline"
              title={`Remove ${t.raw}`}
            >
              <span className="mono">{t.raw}</span>
              <span aria-hidden>×</span>
              <span className="sr-only">remove filter</span>
            </Link>
          ))}
          <Link href={link({ q: undefined, page: undefined })} className="small link no-underline">
            Clear
          </Link>
        </div>
      ) : null}
      {result.items.length === 0 ? (
        <div className="empty">
          Nothing matches. Try a product name, or a tag like <code>#aws</code>.
        </div>
      ) : (
        <ul className="rows">
          <li className="row-cols" aria-hidden>
            <span />
            <span>Design</span>
            <span>Components</span>
            <span>Edges</span>
            <span>Findings</span>
            <span>Clones</span>
          </li>
          {result.items.map((d) => (
            <DesignRow key={d.id} d={d} />
          ))}
        </ul>
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
