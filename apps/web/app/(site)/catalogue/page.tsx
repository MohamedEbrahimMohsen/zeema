import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getCatalogue, getIcons } from "@/lib/catalogue";
import { catalogueCounts } from "@/lib/reference";

// `custom` is last on purpose: it is the escape hatch, not a place to start.
const CATEGORY_ORDER = [
  "compute",
  "edge",
  "data",
  "messaging",
  "ops",
  "security",
  "client",
  "external",
  "custom",
];

// The providers offered as filter chips, in the order the picker lists them.
const PROVIDERS = [
  "default",
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

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; provider?: string }>;
}) {
  const sp = await searchParams;
  const cat = getCatalogue();
  const icons = getIcons();
  const q = (sp.q ?? "").toLowerCase().trim();
  const totals = catalogueCounts();
  const counts: Record<string, number> = {};
  for (const c of Object.values(cat.components)) counts[c.kind] = (counts[c.kind] ?? 0) + 1;
  const kinds = Object.values(cat.kinds).sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
      a.id.localeCompare(b.id),
  );
  const byCategory = new Map<string, typeof kinds>();
  for (const k of kinds) byCategory.set(k.category, [...(byCategory.get(k.category) ?? []), k]);

  const active = Boolean(sp.kind || q || sp.provider);
  const components = active
    ? Object.values(cat.components)
        .filter(
          (c) =>
            (!sp.kind || c.kind === sp.kind) &&
            (!sp.provider || c.provider === sp.provider) &&
            // Aliases are searched with the id, the name and the description, so "dcr" finds
            // the data collection rule here exactly as it does in the canvas palette.
            (!q ||
              `${c.id} ${cat.locale.components[c.id]?.name ?? ""} ${cat.locale.components[c.id]?.description ?? ""} ${(c.aliases ?? []).join(" ")}`
                .toLowerCase()
                .includes(q)),
        )
        .sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id))
        .slice(0, 300)
    : [];

  // The provider filter as the canvas picker draws it: a row of chips, one pressed. Each is a
  // link carrying the rest of the query, so the page still works without JavaScript.
  const href = (patch: { provider?: string; kind?: string; q?: string }) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({
      q: sp.q,
      kind: sp.kind,
      provider: sp.provider,
      ...patch,
    }))
      if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/catalogue?${s}` : "/catalogue";
  };
  const categories = [...byCategory.keys()];

  return (
    <div className="flex flex-col gap-5">
      <div className="browse-head flex flex-col gap-1">
        <h1 className="display">Catalogue</h1>
        <p className="small muted" style={{ maxWidth: 760 }}>
          A kind is the abstract thing (a queue); a component is the concrete product (Kafka, SQS)
          with the defaults it really has; a rule is a deterministic check the linter runs over a
          design. Every kind, component and rule below has a reference page: its properties, the
          rules that apply to it in plain English, and the verbatim YAML from the repository.
        </p>
        <div className="stat-row">
          <span className="stat-chip">{totals.kinds} kinds</span>
          <span className="stat-chip">
            {totals.components.toLocaleString()} components across {totals.providers} providers
          </span>
          <span className="stat-chip">{totals.rules} rules</span>
          <Link href="/llms.txt" className="stat-chip stat-link no-underline">
            Machine-readable index
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <form className="browse-tools" method="get">
          <div className="searchbox">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              className="searchbox-input"
              type="search"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="sqs, kafka, cache"
              aria-label="Search components"
            />
          </div>
          {sp.provider ? <input type="hidden" name="provider" value={sp.provider} /> : null}
          {sp.kind ? <input type="hidden" name="kind" value={sp.kind} /> : null}
          <button className="btn btn-primary" type="submit">
            Search
          </button>
          <Link href="/catalogue/rules" className="chip no-underline">
            Rules <span className="mono">{cat.rules.length}</span>
          </Link>
        </form>
        <fieldset className="chip-row">
          <legend className="sr-only">Provider</legend>
          <span className="chip-row-label" aria-hidden>
            Provider
          </span>
          {["", ...PROVIDERS].map((p) => (
            <Link
              key={p || "any"}
              href={href({ provider: p || undefined })}
              className={`chip no-underline${(sp.provider ?? "") === p ? " is-on" : ""}`}
              aria-current={(sp.provider ?? "") === p ? "true" : undefined}
            >
              {p || "Any"}
            </Link>
          ))}
        </fieldset>
        <nav className="chip-row" aria-label="Categories">
          <span className="chip-row-label" aria-hidden>
            Category
          </span>
          {categories.map((c) => (
            <a key={c} href={`#category-${c}`} className="chip no-underline">
              {cat.locale.categories[c]?.name ?? c}
            </a>
          ))}
        </nav>
      </div>

      {active ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3">
            <span className="label">
              {components.length} component{components.length === 1 ? "" : "s"}
              {sp.kind ? ` · kind ${sp.kind}` : ""}
              {sp.provider ? ` · ${sp.provider}` : ""}
            </span>
            <Link href="/catalogue" className="small link">
              Clear
            </Link>
          </div>
          {components.length ? (
            <div className="cat-rows">
              {components.map((c) => (
                <Link
                  key={c.id}
                  href={`/catalogue/components/${c.id}`}
                  className="cat-row no-underline"
                >
                  <Icon markup={icons[c.id] ?? icons[`kind:${c.kind}`]} />
                  <span className="cat-row-name">
                    <span className="name">{cat.locale.components[c.id]?.name ?? c.id}</span>
                    <span className="slug truncate">{c.id}</span>
                  </span>
                  <span className="cat-row-meta">
                    {c.provider !== "default" ? (
                      <span className="tag tag-mono">{c.provider}</span>
                    ) : (
                      <span />
                    )}
                    <span className="kind">{c.kind}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">Nothing matches. Try a product name, or pick a kind below.</div>
          )}
        </section>
      ) : null}

      {[...byCategory.entries()].map(([category, ks]) => (
        <section
          key={category}
          id={`category-${category}`}
          className="cat-section flex flex-col gap-2"
        >
          <span className="label">
            {cat.locale.categories[category]?.name ?? category} · {ks.length} kinds
          </span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ks.map((k) => (
              <Link
                key={k.id}
                href={`/catalogue/kinds/${k.id}`}
                className="kind-card flex items-center gap-3 no-underline"
              >
                <span className="kind-card-icon">
                  <Icon markup={icons[`kind:${k.id}`]} />
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="medium truncate">{cat.locale.kinds[k.id]?.name ?? k.id}</span>
                    <span className="mono meta truncate">{k.id}</span>
                  </span>
                  <span className="meta">
                    {counts[k.id] ?? 0} components · {Object.keys(k.properties).length} properties
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
