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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="title">Catalogue</h1>
        <p className="small muted">
          A kind is the abstract thing (a queue); a component is the concrete product (Kafka, SQS)
          with the defaults it really has; a rule is a deterministic check the linter runs over a
          design. Every kind, component and rule below has a reference page: its properties, the
          rules that apply to it in plain English, and the verbatim YAML from the repository.
        </p>
        <p className="small muted">
          <b>{totals.kinds}</b> kinds · <b>{totals.components.toLocaleString()}</b> components
          across <b>{totals.providers}</b> providers · <b>{totals.rules}</b> rules ·{" "}
          <Link href="/llms.txt" className="link">
            Machine-readable index
          </Link>
        </p>
      </div>
      <form className="flex flex-wrap items-center gap-3" method="get">
        <input
          className="input"
          style={{ maxWidth: 340 }}
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="sqs, kafka, cache"
        />
        <select
          className="input"
          style={{ width: 170 }}
          name="provider"
          defaultValue={sp.provider ?? ""}
        >
          <option value="">Any provider</option>
          {[
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
          ].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {sp.kind ? <input type="hidden" name="kind" value={sp.kind} /> : null}
        <button className="btn" type="submit">
          Search
        </button>
        <Link href="/catalogue/rules" className="btn ml-auto no-underline">
          Rules <span className="mono muted">{cat.rules.length}</span>
        </Link>
      </form>

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
            <div className="list">
              {components.map((c) => (
                <Link
                  key={c.id}
                  href={`/catalogue/components/${c.id}`}
                  className="row no-underline"
                >
                  <Icon markup={icons[c.id] ?? icons[`kind:${c.kind}`]} />
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="name">{cat.locale.components[c.id]?.name ?? c.id}</span>
                    <span className="slug truncate">{c.id}</span>
                  </span>
                  {c.provider !== "default" ? (
                    <span className="tag tag-mono">{c.provider}</span>
                  ) : (
                    <span />
                  )}
                  <span className="kind">{c.kind}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">Nothing matches. Try a product name, or pick a kind below.</div>
          )}
        </section>
      ) : null}

      {[...byCategory.entries()].map(([category, ks]) => (
        <section key={category} className="flex flex-col gap-2">
          <span className="label">
            {cat.locale.categories[category]?.name ?? category} · {ks.length} kinds
          </span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ks.map((k) => (
              <Link
                key={k.id}
                href={`/catalogue/kinds/${k.id}`}
                className="panel flex items-center gap-3 p-3 no-underline"
              >
                <Icon markup={icons[`kind:${k.id}`]} />
                <span className="flex flex-col min-w-0">
                  <span className="medium">{cat.locale.kinds[k.id]?.name ?? k.id}</span>
                  <span className="meta">
                    {counts[k.id] ?? 0} components · {Object.keys(k.properties).length} properties
                  </span>
                </span>
                <span className="ml-auto mono meta">{k.id}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
