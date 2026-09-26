import Link from "next/link";
import { DesignRow } from "@/components/DesignRow";
import { Pager } from "@/components/Pager";
import { SearchBox, type Suggestion } from "@/components/SearchBox";
import { actingAdmin, currentUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";
import { listDesigns, listOwners, listTags } from "@/lib/designs";
import { intParam } from "@/lib/http-guards";
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
  const [result, owners, usedTags] = await Promise.all([
    listDesigns(viewer, {
      q: parsed.text,
      provider: parsed.provider ?? sp.provider,
      kind: parsed.kind ?? sp.kind,
      tag: parsed.tag,
      origin: parsed.origin ?? (isTier(sp.origin) ? sp.origin : undefined),
      owner: mine ? undefined : owner,
      scope: mine ? "mine" : adminScope ? "all" : "public",
      visibility: adminScope === "private" ? "private" : undefined,
      sort: (sp.sort as "updated" | "created" | "clones" | "exports") ?? "updated",
      page: intParam(sp.page, { fallback: 1, min: 1, max: 10_000 }),
    }),
    listOwners(viewer),
    listTags(viewer),
  ]);
  const link = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, String(v));
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };
  // Tiers first: they are the three words most people want, and the provider list is long.
  const catalogueTags: Suggestion[] = [
    ...TIERS.map((t) => ({ value: `#${t}`, hint: "tier" })),
    ...[...providersOf(cat)].sort().map((p) => ({ value: `#${p}`, hint: "provider" })),
    ...Object.keys(cat.kinds)
      .sort()
      .map((k) => ({ value: `#${k}`, hint: "kind" })),
  ];
  // Authors' own words come last, and only where the catalogue has not already claimed the
  // name — the parser resolves a shared name to the catalogue, so offering it twice would lie.
  const claimed = new Set(catalogueTags.map((t) => t.value));
  const tags: Suggestion[] = [
    ...catalogueTags,
    ...usedTags.map((t) => ({ value: `#${t}`, hint: "tag" })).filter((t) => !claimed.has(t.value)),
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
          <span className="flex flex-wrap gap-2">
            <Link
              href={
                adminScope === "private" ? link({ scope: undefined }) : link({ scope: "private" })
              }
              className="chip no-underline"
            >
              {adminScope === "private" ? "Public only" : "Private designs"}
            </Link>
            <Link
              href={adminScope === "all" ? link({ scope: undefined }) : link({ scope: "all" })}
              className="chip no-underline"
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
          placeholder="Search designs — @owner, #aws, #reference, #your-tag"
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
        <button className="btn btn-primary" type="submit">
          Search
        </button>
        {viewer ? (
          <Link
            href={
              mine
                ? link({ q: withoutToken(sp.q, `@${viewer.username}`), owner: undefined })
                : `/?q=@${viewer.username}`
            }
            className="chip no-underline"
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
              className="chip is-on pill-filter no-underline"
              title={`Remove ${t.raw}`}
            >
              <span className="mono">{t.raw}</span>
              <span aria-hidden>×</span>
              <span className="sr-only">remove filter</span>
            </Link>
          ))}
          <Link href={link({ q: undefined, page: undefined })} className="chip no-underline">
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
      <Pager
        page={result.page}
        total={result.total}
        pageSize={result.pageSize}
        href={(p) => link({ page: String(p) })}
      />
    </div>
  );
}
