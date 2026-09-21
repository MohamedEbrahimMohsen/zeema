// The markdown rendering of a ReferenceDoc: the agent's copy of the page an person reads.
// Section for section it mirrors the React rendering, because both take the same model and
// neither of them knows anything the other does not.
import { getCatalogue } from "@/lib/catalogue";
import { catalogueCounts, type ReferenceDoc, type RuleRef } from "@/lib/reference";

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const fmt = (v: unknown) =>
  v === undefined ? "—" : typeof v === "string" ? `"${v}"` : JSON.stringify(v);

const abs = (origin: string, href: string) => (href.startsWith("http") ? href : `${origin}${href}`);

/** `/catalogue/kinds/queue` -> `https://host/catalogue/kinds/queue.md` */
const absMd = (origin: string, href: string) =>
  href.startsWith("http") ? href : `${origin}${href}.md`;

function frontMatter(doc: ReferenceDoc, origin: string): string[] {
  const out = ["---"];
  for (const [k, v] of Object.entries(doc.frontMatter))
    if (v !== undefined && v !== "") out.push(`${k}: ${JSON.stringify(String(v))}`);
  out.push(`url: ${JSON.stringify(abs(origin, doc.path))}`);
  out.push("---");
  return out;
}

function ruleBlock(r: RuleRef, origin: string, heading = "###"): string[] {
  const out = [
    `${heading} ${r.name} \`${r.id}\` (${r.severity})`,
    "",
    `- Page: ${absMd(origin, `/catalogue/rules/${r.id}`)}`,
  ];
  if (r.rationale) out.push(`- Why: ${r.rationale}`);
  if (r.selectText) out.push(`- Applies to: ${r.selectText}`);
  out.push(`- Message: ${r.message}`);
  out.push("", "It fires when:", "");
  if (r.conditionLines.length) out.push(...r.conditionLines);
  else
    out.push(
      `- (this condition uses a predicate the describer does not know: ${r.undescribable}. Read the YAML.)`,
    );
  out.push("");
  return out;
}

export function renderMarkdown(doc: ReferenceDoc, origin: string): string {
  const L: string[] = [...frontMatter(doc, origin), ""];
  L.push(`# ${doc.title}`, "");
  if (doc.description) L.push(doc.description, "");

  if (doc.facts.length) {
    L.push("| | |", "|---|---|");
    for (const f of doc.facts)
      L.push(
        `| ${esc(f.label)} | ${f.href ? `[${esc(f.value)}](${abs(origin, f.href)})` : esc(f.value)} |`,
      );
    L.push("");
  }

  if (doc.properties) {
    L.push("## Properties", "");
    if (!doc.properties.rows.length) {
      L.push("This entity defines no properties.", "");
    } else {
      const overrides = doc.properties.rows.some((r) => r.overridden);
      L.push(
        overrides
          ? "| property | type | values | required | kind default | this component |"
          : "| property | type | values | required | default |",
        overrides ? "|---|---|---|---|---|---|" : "|---|---|---|---|---|",
      );
      for (const r of doc.properties.rows) {
        const cells = [
          `\`${r.name}\``,
          r.type,
          r.values?.length ? r.values.map((v) => `\`${v}\``).join(", ") : "—",
          r.required ? "yes" : "no",
          fmt(r.kindDefault),
        ];
        if (overrides) cells.push(r.overridden ? `**${fmt(r.override)}**` : "inherited");
        L.push(`| ${cells.map((c) => esc(String(c))).join(" | ")} |`);
      }
      L.push("");
      if (overrides) L.push("Bold values are the ones this component pins.", "");
    }
  }

  if (doc.rules && doc.type !== "rule") {
    L.push(`## ${doc.rules.caption}`, "");
    if (!doc.rules.items.length) L.push("No rule selects this kind or its category.", "");
    else for (const r of doc.rules.items) L.push(...ruleBlock(r, origin));
  }

  if (doc.type === "rule" && doc.rules?.items[0]) {
    const r = doc.rules.items[0];
    if (r.rationale) L.push("## Why", "", r.rationale, "");
    L.push("## What it checks", "");
    if (r.selectText) L.push(`It looks at ${r.selectText}, and fires when:`, "");
    else L.push("It fires when:", "");
    if (r.conditionLines.length) L.push(...r.conditionLines);
    else L.push(`- (undescribable predicate: ${r.undescribable}. Read the YAML below.)`);
    L.push("", "Message template:", "", "```", r.message, "```", "");
  }

  if (doc.appliesTo) {
    L.push("## Applies to", "");
    if (doc.appliesTo.note) L.push(doc.appliesTo.note, "");
    if (doc.appliesTo.categories.length)
      L.push(`Categories: ${doc.appliesTo.categories.join(", ")}`, "");
    if (doc.appliesTo.kinds.length) {
      for (const k of doc.appliesTo.kinds)
        L.push(`- [${k.name}](${absMd(origin, k.href)}) \`${k.id}\``);
      L.push("");
    }
    L.push(
      `${doc.appliesTo.componentCount.toLocaleString()} catalogue components fall under it.`,
      "",
    );
  }

  if (doc.trippedBy) {
    L.push("## Tripped by", "");
    if (!doc.trippedBy.length) L.push("No reference design's broken twin lists this rule.", "");
    else {
      L.push(
        "Reference designs whose broken twin names this rule in its header:",
        "",
        ...doc.trippedBy.map((d) => `- [${d.name}](${abs(origin, d.href)})`),
        "",
      );
    }
  }

  if (doc.componentGroups) {
    const total = doc.componentGroups.reduce((n, g) => n + g.items.length, 0);
    L.push(`## Components · ${total}`, "");
    for (const g of doc.componentGroups) {
      L.push(`### ${g.provider}`, "");
      for (const c of g.items)
        L.push(
          `- [${c.name}](${absMd(origin, c.href)}) \`${c.id}\`${c.note ? ` — ${c.note}` : ""}`,
        );
      L.push("");
    }
  }

  if (doc.siblings) {
    L.push(`## Other products of the same kind · ${doc.siblings.total}`, "");
    for (const s of doc.siblings.items)
      L.push(`- [${s.name}](${absMd(origin, s.href)}) \`${s.id}\`${s.note ? ` — ${s.note}` : ""}`);
    if (doc.siblings.total > doc.siblings.items.length)
      L.push(
        `- and ${doc.siblings.total - doc.siblings.items.length} more: ${absMd(origin, doc.siblings.kindHref)}`,
      );
    L.push("");
  }

  if (doc.type === "component") {
    L.push(
      "## Use it in a design",
      "",
      "```yaml",
      "nodes:",
      `  - { id: "${doc.id}", component: "${doc.id}" }`,
      "```",
      "",
    );
  }

  // Blank runs are collapsed in the prose only: the source block is byte-exact on purpose, so an
  // agent can copy it straight into a file.
  const body = L.join("\n").replace(/\n{3,}/g, "\n\n");
  const tail = [
    `## Source (\`${doc.type}\` YAML, verbatim)`,
    "",
    "```yaml",
    doc.source.replace(/\n+$/, ""),
    "```",
    "",
    `Human page: ${abs(origin, doc.path)}`,
  ].join("\n");
  return `${body}\n${tail}\n`;
}

/* ------------------------------------------------------------------------------ llms.txt */

const oneLine = (s: string | undefined, fallback: string) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t || fallback;
};

/**
 * /llms.txt, per the convention: an H1, a blockquote summary, then link sections. Every link
 * points at the `.md` rendering, because that is the copy written for whoever reads this file.
 * There is deliberately no llms-full.txt: a kind's page already carries its whole component list,
 * which is the drill-down path, and the full text of 1,900 components is nobody's context window.
 */
export function renderLlmsTxt(origin: string): string {
  const cat = getCatalogue();
  const n = catalogueCounts();
  const L: string[] = [
    "# Zeema",
    "",
    "> Software architecture as typed, queryable data. A *kind* is the abstract thing (a queue);",
    `> a *component* is the concrete product (Kafka, SQS) with the defaults it really has; a *rule*`,
    "> is a deterministic predicate over a design. This index lists all of them. Every entry links",
    "> to a markdown page carrying that entity's facts, properties, applicable rules in plain",
    "> English, and the verbatim YAML from the repository.",
    "",
    `The catalogue holds ${n.kinds} kinds, ${n.components.toLocaleString()} components across ${n.providers} providers, and ${n.rules} rules.`,
    "Any page below is also readable as HTML at the same address without the `.md` suffix.",
    "",
    "## Kinds",
    "",
  ];
  for (const id of Object.keys(cat.kinds).sort()) {
    const t = cat.locale.kinds[id] ?? {};
    L.push(
      `- [${t.name ?? id}](${origin}/catalogue/kinds/${id}.md): ${oneLine(t.description, id)}`,
    );
  }

  L.push(
    "",
    "## Components",
    "",
    "Grouped by provider. A kind's page lists every component of that kind, so",
    "`/catalogue/kinds/<id>.md` is the cheaper drill-down when you know the kind.",
    "",
  );
  const byProvider = new Map<string, string[]>();
  for (const c of Object.values(cat.components))
    byProvider.set(c.provider, [...(byProvider.get(c.provider) ?? []), c.id]);
  for (const provider of [...byProvider.keys()].sort()) {
    L.push(`### ${provider}`, "");
    for (const id of (byProvider.get(provider) ?? []).sort()) {
      const t = cat.locale.components[id] ?? {};
      // The abbreviation rides in the link text, so an agent grepping this file for "DCR" lands
      // on the component rather than on nothing.
      const name = t.name ?? id;
      const aliases = (cat.components[id].aliases ?? []).filter(
        (a) => !name.toLowerCase().includes(a.toLowerCase()),
      );
      const known = aliases.length ? ` (${aliases.join(", ")})` : "";
      L.push(
        `- [${name}${known}](${origin}/catalogue/components/${id}.md): ${oneLine(t.description, `${cat.components[id].kind} component`)}`,
      );
    }
    L.push("");
  }

  L.push("## Rules", "");
  for (const r of [...cat.rules].sort((a, b) => a.id.localeCompare(b.id))) {
    const t = cat.locale.rules[r.id] ?? {};
    L.push(
      `- [${t.name ?? r.id}](${origin}/catalogue/rules/${r.id}.md): ${r.severity}. ${oneLine(t.rationale ?? t.description, r.message)}`,
    );
  }
  L.push(
    "",
    "## Optional",
    "",
    `- [How Zeema works](${origin}/docs): the format, the three layers, the rule model.`,
    `- [Catalogue](${origin}/catalogue): the same index for people.`,
    "",
  );
  return `${L.join("\n")}\n`;
}
