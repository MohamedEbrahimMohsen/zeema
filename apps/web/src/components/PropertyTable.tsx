import type { PropertyDef } from "@/lib/catalogue";

const fmt = (v: unknown) => (v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v));

/** A kind's schema — every cell is mono, because every cell is machine-owned. */
export function PropertyTable({
  properties,
  overrides = {},
}: {
  properties: Record<string, PropertyDef>;
  /** Component defaults, shown against the kind's own default. */
  overrides?: Record<string, unknown>;
}) {
  const names = Object.keys(properties).sort();
  if (!names.length) return <div className="empty">No properties.</div>;
  const hasOverrides = Object.keys(overrides).length > 0;
  return (
    <div className="list">
      <table className="table mono">
        <thead>
          <tr>
            <th>property</th>
            <th>type</th>
            <th>{hasOverrides ? "kind default" : "default"}</th>
            {hasOverrides ? <th>this component</th> : null}
          </tr>
        </thead>
        <tbody>
          {names.map((n) => {
            const d = properties[n];
            const type = d.type === "enum" ? (d.values ?? []).join(" | ") : d.type;
            return (
              <tr key={n}>
                <td>{n}</td>
                <td className="muted">{type}</td>
                <td className={d.required ? "sev-error" : "muted"}>
                  {d.required && d.default === undefined ? "required" : fmt(d.default)}
                </td>
                {hasOverrides ? (
                  <td className={n in overrides ? "" : "muted"}>
                    {n in overrides ? fmt(overrides[n]) : "inherited"}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
