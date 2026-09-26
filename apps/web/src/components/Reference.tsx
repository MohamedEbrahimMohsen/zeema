// The React half of the catalogue reference. Every piece here takes part of a ReferenceDoc and
// nothing else; the markdown half (src/lib/reference-markdown.ts) takes the same model and emits
// the same sections. Neither renderer decides anything about a component, a kind or a rule.
import Link from "next/link";
import { YamlView } from "@/components/YamlView";
import type { Fact, RuleRef } from "@/lib/reference";

export function SeverityDot({ severity }: { severity: string }) {
  return (
    <span
      className="dot sev-dot"
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

/** The facts, one chip each: a label and its value, a link where the fact points somewhere. */
export function Facts({ facts }: { facts: Fact[] }) {
  return (
    <dl className="fact-row">
      {facts.map((f) => (
        <div key={f.label} className="fact-chip">
          <dt className="fact-label">{f.label}</dt>
          <dd className="fact-value" title={f.value}>
            {f.href ? (
              f.external ? (
                <a className="link" href={f.href} target="_blank" rel="noopener noreferrer">
                  {f.value}
                </a>
              ) : (
                <Link className="link" href={f.href}>
                  {f.value}
                </Link>
              )
            ) : (
              <span className={f.muted ? "muted" : undefined}>{f.value}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
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

/** Severity as a chip in the finding colours: red for an error, amber for a warning. */
export function SeverityChip({ severity }: { severity: string }) {
  const tone = severity === "error" ? " tag-danger" : severity === "warning" ? " tag-warn" : "";
  return <span className={`tag tag-mono${tone}`}>{severity}</span>;
}

/** One card per rule, in the findings' shape: severity, name, rationale, the condition. */
export function RuleList({ items, empty }: { items: RuleRef[]; empty: string }) {
  if (!items.length) return <div className="empty">{empty}</div>;
  return (
    <div className="rule-cards">
      {items.map((r) => (
        <div key={r.id} className={`rule-card ${r.severity}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityDot severity={r.severity} />
            <Link href={`/catalogue/rules/${r.id}`} className="medium no-underline">
              {r.name}
            </Link>
            <SeverityChip severity={r.severity} />
          </div>
          <span className={`rule-id mono ${r.severity === "error" ? "sev-error" : "sev-warning"}`}>
            {r.id}
          </span>
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
