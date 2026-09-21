// The tables in the documentation that are not written by hand.
//
// A rule list, a kind index or a provider count that someone types into a Markdown file is wrong
// the first time the catalogue changes. Each block here is derived at render time from the same
// catalogue the linter uses, so the page can only ever be as stale as the repository it is served
// from. A content file asks for one by putting `{{name}}` on a line of its own.
import Link from "next/link";
import { SeverityDot } from "@/components/Reference";
import { API_ROUTES, type ApiRoute, otherRoutes, v1Routes } from "@/lib/api-routes";
import { getCatalogue } from "@/lib/catalogue";
import type { GeneratedBlockName } from "@/lib/docs";
import { catalogueCounts, ruleRef } from "@/lib/reference";

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

const firstSentence = (s?: string) => {
  if (!s) return "";
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
};

/** Every rule the catalogue ships: id, severity, what it selects, why it exists. */
function RulesTable() {
  const cat = getCatalogue();
  const rows = [...cat.rules]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => {
      const ref = ruleRef(cat, r);
      return {
        id: r.id,
        severity: r.severity,
        selects: ref.selectText || "the design",
        why: firstSentence(cat.locale.rules[r.id]?.rationale) || ref.name,
      };
    });
  return (
    <div className="doc-table-wrap">
      <table className="doc-gen">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Severity</th>
            <th>Selects</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link className="mono link" href={`/catalogue/rules/${r.id}`}>
                  {r.id}
                </Link>
              </td>
              <td className="nowrap">
                <span className="sev-cell">
                  <SeverityDot severity={r.severity} />
                  {r.severity}
                </span>
              </td>
              <td>{r.selects}</td>
              <td className="muted">{r.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every kind, grouped by category, with how many components implement it. */
function KindIndex() {
  const cat = getCatalogue();
  const counts: Record<string, number> = {};
  for (const c of Object.values(cat.components)) counts[c.kind] = (counts[c.kind] ?? 0) + 1;
  const categories = [...new Set(Object.values(cat.kinds).map((k) => k.category))].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
  );
  return (
    <div className="kind-index">
      {categories.map((category) => (
        <section key={category}>
          <h3 className="label" id={`category-${category}`}>
            {cat.locale.categories[category]?.name ?? category}
          </h3>
          <ul className="kind-grid">
            {Object.values(cat.kinds)
              .filter((k) => k.category === category)
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((k) => (
                <li key={k.id}>
                  <Link className="kind-chip" href={`/catalogue/kinds/${k.id}`}>
                    <span className="kind-chip-name">{cat.locale.kinds[k.id]?.name ?? k.id}</span>
                    <span className="mono meta">{k.id}</span>
                    <span className="meta">{counts[k.id] ?? 0} components</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Every provider and how much of the catalogue it owns. */
function ProviderIndex() {
  const cat = getCatalogue();
  const counts: Record<string, number> = {};
  for (const c of Object.values(cat.components)) counts[c.provider] = (counts[c.provider] ?? 0) + 1;
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = Object.keys(cat.components).length;
  return (
    <div className="doc-table-wrap">
      <table className="doc-gen">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Components</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([provider, n]) => (
            <tr key={provider}>
              <td>
                <Link className="mono link" href={`/catalogue?provider=${provider}`}>
                  {provider}
                </Link>
              </td>
              <td className="mono">{n.toLocaleString()}</td>
              <td className="muted">{((n / total) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RouteTable({ rows }: { rows: ApiRoute[] }) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-gen">
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
            <th>Needs</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.method} ${r.path}`}>
              <td>
                <span className={`method method-${r.method.toLowerCase()}`}>{r.method}</span>
              </td>
              <td className="mono">{r.path}</td>
              <td className="muted nowrap">{r.auth === "none" ? "nothing" : r.auth}</td>
              <td className="muted">{r.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The catalogue in four numbers, so no page has to state them. */
function CatalogueCounts() {
  const c = catalogueCounts();
  const items: Array<[string, string]> = [
    ["Kinds", String(c.kinds)],
    ["Components", c.components.toLocaleString()],
    ["Providers", String(c.providers)],
    ["Rules", String(c.rules)],
  ];
  return (
    <div className="count-strip">
      {items.map(([label, value]) => (
        <div key={label} className="count-cell">
          <span className="count-value">{value}</span>
          <span className="label">{label}</span>
        </div>
      ))}
    </div>
  );
}

const BLOCKS: Record<GeneratedBlockName, () => React.ReactElement> = {
  "rules-table": RulesTable,
  "kind-index": KindIndex,
  "provider-index": ProviderIndex,
  "api-routes": () => <RouteTable rows={v1Routes()} />,
  "api-other-routes": () => <RouteTable rows={otherRoutes()} />,
  "api-all-routes": () => <RouteTable rows={API_ROUTES} />,
  "catalogue-counts": CatalogueCounts,
};

export function DocsGenerated({ name }: { name: string }) {
  const Block = BLOCKS[name as GeneratedBlockName];
  if (!Block) return null;
  return <Block />;
}
