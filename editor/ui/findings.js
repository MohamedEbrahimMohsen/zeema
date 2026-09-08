// The findings panel. Two lists in one: structural errors, which block a save because the file
// would not be valid, and rule findings, which never block, because twelve of the repository's
// designs legitimately trip rules. Clicking a finding selects and centres its subject.

export class Findings {
  constructor(root, { onSelect, summary }) {
    this.root = root;
    this.onSelect = onSelect;
    this.summary = summary;
  }

  render(structural, rules, catalogue) {
    this.root.textContent = "";
    const errors = structural.length;
    const bySeverity = { error: 0, warning: 0, info: 0 };
    for (const f of rules) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;

    if (this.summary) {
      const bits = [];
      if (errors) bits.push(`${errors} blocking`);
      if (bySeverity.error) bits.push(`${bySeverity.error} error${bySeverity.error === 1 ? "" : "s"}`);
      if (bySeverity.warning) bits.push(`${bySeverity.warning} warning${bySeverity.warning === 1 ? "" : "s"}`);
      this.summary.textContent = bits.length ? bits.join(" · ") : "no findings";
      this.summary.className = errors ? "blocking" : "muted";
    }

    const head = document.createElement("h2");
    head.textContent = "Findings";
    this.root.append(head);

    if (!errors && !rules.length) {
      const ok = document.createElement("div");
      ok.className = "muted";
      ok.textContent = "Nothing to report. The design is valid and trips no rule.";
      this.root.append(ok);
      return;
    }

    for (const f of structural) this.root.append(this.row("error", f.message, "structural", f.subject, true));
    for (const f of rules) {
      const loc = catalogue.locale.rules[f.id];
      this.root.append(this.row(f.severity, f.message, loc ? loc.name : f.id, f.subject, false));
    }
  }

  row(severity, message, rule, subject, blocking) {
    const el = document.createElement("div");
    el.className = `finding ${severity}`;
    const dot = document.createElement("div");
    dot.className = "dot";
    const body = document.createElement("div");
    const text = document.createElement("div");
    text.textContent = message;
    if (blocking) text.className = "blocking";
    const meta = document.createElement("div");
    meta.className = "rule";
    meta.textContent = rule + (subject && subject.ref !== null && subject.ref !== undefined ? ` · ${subject.type} ${subject.ref}` : "");
    body.append(text, meta);
    el.append(dot, body);
    if (subject) el.addEventListener("click", () => this.onSelect(subject));
    return el;
  }
}
