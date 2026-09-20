import type { PropRow } from "@/lib/reference";

const fmt = (v: unknown) => (v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v));

/**
 * A kind's schema, or a component's view of it. Every cell is mono, because every cell is
 * machine-owned. Rows come from the one reference model, so the HTML table and the markdown
 * table below it always carry the same columns.
 */
export function PropertyTable({ rows }: { rows: PropRow[] }) {
  if (!rows.length) return <div className="empty">No properties.</div>;
  const hasOverrides = rows.some((r) => r.overridden);
  return (
    <div className="list">
      <table className="table mono">
        <thead>
          <tr>
            <th>property</th>
            <th>type</th>
            <th>values</th>
            <th>required</th>
            <th>{hasOverrides ? "kind default" : "default"}</th>
            {hasOverrides ? <th>this component</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>
                {r.name}
                {r.componentProperty ? <span className="meta"> · component property</span> : null}
              </td>
              <td className="muted">{r.type}</td>
              <td className="muted">{r.values?.length ? r.values.join(" | ") : "—"}</td>
              <td className={r.required ? "sev-error" : "muted"}>{r.required ? "yes" : "no"}</td>
              <td className="muted">{fmt(r.kindDefault)}</td>
              {hasOverrides ? (
                <td className={r.overridden ? "sev-info" : "muted"}>
                  {r.overridden ? `▸ ${fmt(r.override)}` : "inherited"}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
