import Link from "next/link";
import { getCatalogue } from "@/lib/catalogue";

const selectText = (sel: unknown) => {
  if (!sel || typeof sel !== "object") return "design";
  const s = sel as Record<string, any>;
  if (s.node?.kind) return `node.kind = ${s.node.kind}`;
  if (s.node?.component) return `node.component = ${s.node.component}`;
  if (s.edge) return "edge";
  if (s.node) return "node";
  return Object.keys(s).join(", ") || "design";
};

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string }>;
}) {
  const sp = await searchParams;
  const cat = getCatalogue();
  const rules = cat.rules
    .filter((r) => !sp.severity || r.severity === sp.severity)
    .sort((a, b) => a.severity.localeCompare(b.severity) || a.id.localeCompare(b.id));
  const counts = { error: 0, warning: 0, info: 0 } as Record<string, number>;
  for (const r of cat.rules) counts[r.severity] = (counts[r.severity] ?? 0) + 1;
  return (
    <div className="flex flex-col gap-5">
      <div className="meta">
        <Link href="/catalogue" className="link">
          Catalogue
        </Link>
        {" / rules"}
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="title">Rules</h1>
        <p className="small muted">
          Declarative predicates over a design. A rule reads a node&apos;s effective properties, its
          edges, its boundaries and the design&apos;s requirements. A finding never blocks a save; a
          structural problem always does. Open a rule for its rationale, the condition in plain
          English, and the reference designs that trip it.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {[
          ["", "All", cat.rules.length],
          ["error", "Errors", counts.error],
          ["warning", "Warnings", counts.warning],
        ].map(([v, l, n]) => (
          <Link
            key={String(v)}
            href={v ? `/catalogue/rules?severity=${v}` : "/catalogue/rules"}
            className={`btn btn-sm no-underline${(sp.severity ?? "") === v ? " active" : ""}`}
          >
            {l} <span className="mono muted">{n}</span>
          </Link>
        ))}
      </div>
      <div className="list">
        {rules.map((r) => (
          <Link
            key={r.id}
            id={r.id}
            href={`/catalogue/rules/${r.id}`}
            className="flex flex-col gap-1 p-4 no-underline"
          >
            <div className="finding" style={{ gridTemplateColumns: "10px 1fr" }}>
              <span
                className="dot"
                style={{ background: r.severity === "error" ? "var(--err)" : "var(--warn)" }}
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="medium">{cat.locale.rules[r.id]?.name ?? r.id}</span>
                  <span
                    className={`mono meta ${r.severity === "error" ? "sev-error" : "sev-warning"}`}
                  >
                    {r.id}
                  </span>
                  <span className="tag tag-mono">{selectText(r.select)}</span>
                </div>
                <div className="small">{r.message}</div>
                {cat.locale.rules[r.id]?.rationale ? (
                  <div className="small muted">{cat.locale.rules[r.id]?.rationale}</div>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
