// The React half of the catalogue reference. Every piece here takes part of a ReferenceDoc and
// nothing else; the markdown half (src/lib/reference-markdown.ts) takes the same model and emits
// the same sections. Neither renderer decides anything about a component, a kind or a rule.
import Link from "next/link";
import { YamlView } from "@/components/YamlView";
import type { Fact, RuleRef } from "@/lib/reference";

export function SeverityDot({ severity }: { severity: string }) {
  return (
    <span
      className="dot"
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background:
          severity === "error"
            ? "var(--err)"
            : severity === "warning"
              ? "var(--warn)"
              : "var(--muted)",
      }}
    />
  );
}

/** The facts strip: one label/value pair per column, links where a fact points somewhere. */
export function Facts({ facts }: { facts: Fact[] }) {
  return (
    <div className="panel grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
      {facts.map((f) => (
        <div key={f.label} className="flex flex-col gap-1 min-w-0">
          <span className="label">{f.label}</span>
          {f.href ? (
            f.external ? (
              <a
                className="link small truncate"
                href={f.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {f.value}
              </a>
            ) : (
              <Link className="link small truncate" href={f.href}>
                {f.value}
              </Link>
            )
          ) : (
            <span className={`small${f.muted ? " muted" : ""}`}>{f.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** The `when` tree, indented. Lines arrive already phrased by @zeema/core/describe. */
export function Condition({ rule }: { rule: RuleRef }) {
  if (!rule.conditionLines.length)
    return (
      <div className="empty">
        This condition uses a predicate the describer does not know ({rule.undescribable}). Read the
        YAML below.
      </div>
    );
  return (
    <ul className="small flex flex-col gap-1" style={{ listStyle: "none", paddingLeft: 0 }}>
      {rule.conditionLines.map((line) => {
        const depth = (line.length - line.trimStart().length) / 2;
        const text = line.trimStart().replace(/^- /, "");
        return (
          <li
            key={line}
            style={{ paddingLeft: depth * 18 }}
            className={depth === 0 ? "medium" : undefined}
          >
            <span className="muted">— </span>
            {text}
          </li>
        );
      })}
    </ul>
  );
}

/** One row per rule: severity, name, rationale, and the condition in plain English. */
export function RuleList({ items, empty }: { items: RuleRef[]; empty: string }) {
  if (!items.length) return <div className="empty">{empty}</div>;
  return (
    <div className="list">
      {items.map((r) => (
        <div key={r.id} className="flex flex-col gap-2 p-4">
          <div className="flex items-baseline gap-3 flex-wrap">
            <SeverityDot severity={r.severity} />
            <Link href={`/catalogue/rules/${r.id}`} className="medium no-underline">
              {r.name}
            </Link>
            <span className={`mono meta ${r.severity === "error" ? "sev-error" : "sev-warning"}`}>
              {r.id}
            </span>
            <span className="tag tag-mono">{r.severity}</span>
          </div>
          {r.rationale ? <p className="small muted">{r.rationale}</p> : null}
          <Condition rule={r} />
        </div>
      ))}
    </div>
  );
}

/** The verbatim YAML, and the line that tells an agent where its own copy lives. */
export function Source({ path, source }: { path: string; source: string }) {
  return (
    <section className="flex flex-col gap-2">
      <span className="label">Source</span>
      <YamlView source={source.replace(/\n+$/, "")} />
      <p className="meta">
        The same page as markdown, for an agent:{" "}
        <Link href={`${path}.md`} className="link mono">
          {path}.md
        </Link>
      </p>
    </section>
  );
}
