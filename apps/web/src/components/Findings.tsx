import { CollapsibleSection } from "@/components/CollapsibleSection";
import type { Finding } from "@/lib/lint";

export function Tally({ findings }: { findings: Finding[] }) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return (
    <span className="tally">
      <span className={counts.error ? "n-err" : ""}>
        {counts.error} error{counts.error === 1 ? "" : "s"}
      </span>
      {" · "}
      <span className={counts.warning ? "n-warn" : ""}>
        {counts.warning} warning{counts.warning === 1 ? "" : "s"}
      </span>
      {" · "}
      <span>{counts.info} info</span>
    </span>
  );
}

export function FindingRow({
  f,
  ruleName,
}: {
  f: { severity: string; message: string; id?: string; subject?: { type: string; ref: unknown } };
  ruleName?: string;
}) {
  const target =
    f.subject && f.subject.ref !== null && f.subject.ref !== undefined
      ? ` · ${f.subject.type} ${String(f.subject.ref)}`
      : "";
  return (
    <div className={`finding ${f.severity}`}>
      <span className="dot" />
      <div>
        <div className="msg">{f.message}</div>
        <div className="rule-id">
          {ruleName ?? f.id}
          {target}
        </div>
      </div>
    </div>
  );
}

export function Findings({
  findings,
  title = "Findings",
  collapsible = false,
}: {
  findings: Finding[];
  title?: string;
  /** Fold into a `.doc-section`, open by default when something worse than info was found. */
  collapsible?: boolean;
}) {
  const body =
    findings.length === 0 ? (
      <p className="small muted">No findings. Every rule is satisfied.</p>
    ) : (
      <div className="flex flex-col gap-3">
        {findings.map((f, i) => (
          <FindingRow key={`${f.id}-${i}`} f={f} />
        ))}
      </div>
    );
  if (collapsible)
    return (
      <CollapsibleSection
        name="findings"
        title={title}
        count={findings.length}
        // Something to act on opens the panel; a clean design, or notes only, stays folded.
        defaultOpen={findings.some((f) => f.severity !== "info")}
        aside={<Tally findings={findings} />}
      >
        {body}
      </CollapsibleSection>
    );
  return (
    <section className="panel p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="label">{title}</span>
        <Tally findings={findings} />
      </div>
      {body}
    </section>
  );
}
