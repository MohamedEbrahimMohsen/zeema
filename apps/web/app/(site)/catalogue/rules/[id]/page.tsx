import Link from "next/link";
import { notFound } from "next/navigation";
import { Condition, Facts, SeverityDot, Source } from "@/components/Reference";
import { ruleDoc } from "@/lib/reference";

export default async function RulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = ruleDoc(id);
  if (!doc) notFound();
  const rule = doc.rules?.items[0];
  if (!rule) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="meta">
        <Link href="/catalogue" className="link">
          Catalogue
        </Link>
        {" / "}
        <Link href="/catalogue/rules" className="link">
          rules
        </Link>
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <h1 className="display flex items-baseline gap-3 flex-wrap">
          <SeverityDot severity={rule.severity} />
          {doc.title}
          <span className="tag tag-mono">{rule.severity}</span>
        </h1>
        <div className="mono meta">{id}</div>
        {rule.rationale ? <p className="muted">{rule.rationale}</p> : null}
      </div>

      <Facts facts={doc.facts} />

      <section className="flex flex-col gap-2">
        <span className="label">What it checks</span>
        {rule.selectText ? (
          <p className="small">
            It looks at <b>{rule.selectText}</b>, and fires when:
          </p>
        ) : (
          <p className="small">It fires when:</p>
        )}
        <Condition rule={rule} />
      </section>

      <section className="flex flex-col gap-2">
        <span className="label">Message</span>
        <pre className="code">{rule.message}</pre>
        <p className="meta">
          <code>{"{{node.id}}"}</code> style paths are filled in from the node, the edge or the
          design the finding is about.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <span className="label">
          Applies to · {doc.appliesTo?.componentCount.toLocaleString()} components
        </span>
        {doc.appliesTo?.note ? <p className="small muted">{doc.appliesTo.note}</p> : null}
        {doc.appliesTo?.categories.length ? (
          <p className="small">
            Categories: <span className="mono">{doc.appliesTo.categories.join(", ")}</span>
          </p>
        ) : null}
        {doc.appliesTo?.kinds.length ? (
          <div className="flex flex-wrap gap-2">
            {doc.appliesTo.kinds.map((k) => (
              <Link key={k.id} href={k.href} className="tag no-underline">
                {k.name} <span className="mono muted">{k.id}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">This rule names no kind: it reads the design as a whole.</div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <span className="label">Tripped by · {doc.trippedBy?.length ?? 0}</span>
        <p className="small muted">
          Reference designs whose broken twin names this rule in its header. The gate reads the same
          header, and fails when a rule no design trips.
        </p>
        {doc.trippedBy?.length ? (
          <div className="list">
            {doc.trippedBy.map((d) => (
              <Link
                key={d.id}
                href={d.href}
                className="row no-underline"
                style={{ gridTemplateColumns: "1fr auto" }}
              >
                <span className="name">{d.name}</span>
                <span className="kind">reference</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">No reference design lists this rule.</div>
        )}
      </section>

      <Source path={doc.path} source={doc.source} />
    </div>
  );
}
