"use client";

import type { Subject } from "./scene";

export type CanvasFinding = {
  id?: string;
  severity?: string;
  message: string;
  subject?: Subject;
  blocking?: boolean;
};

/** One row as the panel lists it: the key is the row's identity for `active` and `onPick`. */
export type FindingRowData = {
  f: CanvasFinding;
  severity: string;
  name: string;
  ruleId: string | null;
  key: string;
};

/** Every row, structural first, keyed the way the panel and the finding-dot popover share. */
export function findingRows(
  structural: CanvasFinding[],
  rules: CanvasFinding[],
  catalogue: any,
): FindingRowData[] {
  return [
    ...structural.map((f, i) => ({
      f,
      severity: "error",
      name: "structural",
      ruleId: null,
      key: `s${i}`,
    })),
    ...rules.map((f, i) => ({
      f,
      severity: f.severity ?? "info",
      name: catalogue.locale.rules[f.id ?? ""]?.name ?? f.id ?? "rule",
      ruleId: f.id ?? null,
      key: `r${i}`,
    })),
  ];
}

/**
 * A finding reads: severity dot, the rule's name with a link to its reference page, the message,
 * and — when the finding is about something on the canvas — what it is about. The row is the
 * button; the link inside it is a link, and its click never reaches the row.
 */
export function FindingRow({
  row: { f, severity, name, ruleId, key },
  onPick,
  active,
}: {
  row: FindingRowData;
  onPick: (f: CanvasFinding, key: string) => void;
  active: boolean;
}) {
  const pick = () => onPick(f, key);
  const subject =
    f.subject?.type && f.subject.ref !== null && f.subject.ref !== undefined
      ? `${f.subject.type} ${f.subject.ref}`
      : null;
  return (
    // biome-ignore lint/a11y/useSemanticElements: the row holds a link, which a <button> cannot
    <div
      role="button"
      tabIndex={0}
      className={`finding ${severity}${active ? " active" : ""}`}
      onClick={pick}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          pick();
        }
      }}
    >
      <div className="dot" />
      <div className="finding-body">
        <div className="finding-head">
          <span className="rule">{name}</span>
          {ruleId ? (
            <a
              className="rule-link"
              href={`/catalogue/rules/${ruleId}`}
              target="_blank"
              rel="noopener"
              aria-label={`Open rule ${name}`}
              title={`Open rule ${name}`}
              onClick={(ev) => ev.stopPropagation()}
            >
              Rule ↗
            </a>
          ) : null}
        </div>
        <div className="msg">{f.message}</div>
        {subject ? <div className="subject">{subject}</div> : null}
      </div>
    </div>
  );
}

export function FindingsPanel({
  structural,
  rules,
  catalogue,
  onPick,
  active,
}: {
  structural: CanvasFinding[];
  rules: CanvasFinding[];
  catalogue: any;
  /** The row was chosen: select its subject and point at the fields the rule reads. */
  onPick: (f: CanvasFinding, key: string) => void;
  /** The key of the row whose highlight is showing, or null. */
  active: string | null;
}) {
  if (!structural.length && !rules.length)
    return <div className="meta">Nothing to report. The design is valid and trips no rule.</div>;
  return (
    <>
      {findingRows(structural, rules, catalogue).map((row) => (
        <FindingRow key={row.key} row={row} onPick={onPick} active={active === row.key} />
      ))}
    </>
  );
}
