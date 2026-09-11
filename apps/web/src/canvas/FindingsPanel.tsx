"use client";

import type { Subject } from "./scene";

export type CanvasFinding = {
  id?: string;
  severity?: string;
  message: string;
  subject?: Subject;
  blocking?: boolean;
};

export function FindingsPanel({
  structural,
  rules,
  catalogue,
  onSelect,
}: {
  structural: CanvasFinding[];
  rules: CanvasFinding[];
  catalogue: any;
  onSelect: (s: Subject) => void;
}) {
  if (!structural.length && !rules.length)
    return (
      <div className="muted text-xs">Nothing to report. The design is valid and trips no rule.</div>
    );
  const row = (
    f: CanvasFinding,
    severity: string,
    rule: string,
    blocking: boolean,
    key: string,
  ) => (
    <button
      key={key}
      type="button"
      className={`finding ${severity}`}
      onClick={() => f.subject && onSelect(f.subject)}
    >
      <div className="dot" />
      <div>
        <div className={blocking ? "sev-error" : ""}>{f.message}</div>
        <div className="rule">
          {rule}
          {f.subject && f.subject.ref !== null && f.subject.ref !== undefined
            ? ` · ${f.subject.type} ${f.subject.ref}`
            : ""}
        </div>
      </div>
    </button>
  );
  return (
    <>
      {structural.map((f, i) => row(f, "error", "structural", true, `s${i}`))}
      {rules.map((f, i) =>
        row(
          f,
          f.severity ?? "info",
          catalogue.locale.rules[f.id ?? ""]?.name ?? f.id ?? "rule",
          false,
          `r${i}`,
        ),
      )}
    </>
  );
}
