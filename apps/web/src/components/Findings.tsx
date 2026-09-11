import type { Finding } from "@/lib/lint";

export function Findings({
  findings,
  title = "Findings",
}: {
  findings: Finding[];
  title?: string;
}) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return (
    <section className="panel p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">{title}</h2>
        <span className="muted text-xs">
          {counts.error} errors · {counts.warning} warnings · {counts.info} info
        </span>
      </div>
      {findings.length === 0 ? (
        <p className="muted mt-2 text-sm">No findings. Every rule is satisfied.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {findings.map((f, i) => (
            <li key={`${f.id}-${i}`} className="flex gap-2">
              <span className={`sev-${f.severity} mono w-14 shrink-0 text-xs uppercase`}>
                {f.severity}
              </span>
              <div>
                <span className="mono text-xs">{f.id}</span>
                <div>{f.message}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
