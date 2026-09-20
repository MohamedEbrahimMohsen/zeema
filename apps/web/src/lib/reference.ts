// The catalogue reference as one intermediate model.
//
// Every entity page exists twice: as HTML for a person and as markdown for an agent at the same
// address with `.md` appended. Both renderings are thin — they take a ReferenceDoc built here and
// lay it out. Nothing about a component, a kind or a rule is written by hand anywhere: this module
// derives all of it from the catalogue bundle, the locale and the verbatim YAML on disk.
//
// The plain-English condition comes from @zeema/core/describe and the rule selection from
// @zeema/core/rules, so the pages, the markdown and the engine agree by construction.
import { describeLines, describeRule } from "@zeema/core/describe";
import { rulesFor } from "@zeema/core/rules";
import {
  type Catalogue,
  getCatalogue,
  getSources,
  type PropertyDef,
  repoDesigns,
} from "@/lib/catalogue";

export type Fact = {
  label: string;
  value: string;
  href?: string;
  /** Rendered with rel="noopener noreferrer" and target=_blank. */
  external?: boolean;
  muted?: boolean;
};

export type PropRow = {
  name: string;
  type: string;
  values?: string[];
  required: boolean;
  /** The default the kind (or the component's own property definition) declares. */
  kindDefault: unknown;
  /** The value this component's `defaults` pins, when it pins one. */
  override?: unknown;
  overridden: boolean;
  /** True when the property is defined by the component rather than inherited from the kind. */
  componentProperty: boolean;
};

export type RuleRef = {
  id: string;
  severity: string;
  name: string;
  rationale?: string;
  message: string;
  selectText: string;
  /** The `when` predicate as indented markdown-ready lines. Empty when it could not be phrased. */
  conditionLines: string[];
  /** Set when describeRule threw: the page falls back to the raw YAML and says why. */
  undescribable?: string;
};

export type EntityLink = { id: string; name: string; href: string; note?: string };

export type ReferenceDoc = {
  type: "component" | "kind" | "rule";
  id: string;
  title: string;
  description?: string;
  /** `/catalogue/components/kafka` — the HTML address; the markdown is this plus ".md". */
  path: string;
  frontMatter: Record<string, string | number | undefined>;
  facts: Fact[];
  properties?: { rows: PropRow[]; caption: string };
  rules?: { caption: string; items: RuleRef[] };
  /** Components listed on a kind page, grouped by provider, generic first. */
  componentGroups?: Array<{ provider: string; items: EntityLink[] }>;
  /** Sibling products on a component page. */
  siblings?: { total: number; items: EntityLink[]; kindHref: string };
  /** Reference designs whose broken twin lists this rule id. */
  trippedBy?: EntityLink[];
  /** Kinds and categories a rule selects. */
  appliesTo?: { kinds: EntityLink[]; categories: string[]; componentCount: number; note: string };
  /** The verbatim bytes of the entity's YAML file. */
  source: string;
  /** A one-line description for llms.txt and index rows. */
  summary: string;
};

const nameOf = (cat: Catalogue, type: "kinds" | "components" | "rules", id: string) =>
  cat.locale[type][id]?.name ?? id;

const firstSentence = (s?: string) => {
  if (!s) return "";
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
};

/** One rule, described. Never throws: an undescribable predicate degrades to the raw YAML. */
export function ruleRef(cat: Catalogue, rule: Catalogue["rules"][number]): RuleRef {
  const t = cat.locale.rules[rule.id] ?? {};
  try {
    const d = describeRule(rule, cat.locale);
    return {
      id: rule.id,
      severity: rule.severity,
      name: d.name,
      rationale: d.rationale,
      message: rule.message,
      selectText: d.select.text,
      conditionLines: describeLines(d.when),
    };
  } catch (e) {
    return {
      id: rule.id,
      severity: rule.severity,
      name: t.name ?? rule.id,
      rationale: t.rationale,
      message: rule.message,
      selectText: "",
      conditionLines: [],
      undescribable: e instanceof Error ? e.message : String(e),
    };
  }
}

function propRows(
  kindProps: Record<string, PropertyDef>,
  componentProps: Record<string, PropertyDef>,
  overrides: Record<string, unknown>,
): PropRow[] {
  const all = { ...kindProps, ...componentProps };
  return Object.keys(all)
    .sort()
    .map((name) => {
      const d = all[name];
      return {
        name,
        type: d.type,
        values: d.values,
        required: Boolean(d.required),
        kindDefault: d.default,
        override: name in overrides ? overrides[name] : undefined,
        overridden: name in overrides,
        componentProperty: name in componentProps,
      };
    });
}

/* ------------------------------------------------------------------------------ component */

export function componentDoc(id: string): ReferenceDoc | null {
  const cat = getCatalogue();
  const c = cat.components[id];
  if (!c) return null;
  const kind = cat.kinds[c.kind];
  const loc = cat.locale.components[id] ?? {};
  const category = kind?.category;
  const generic = id === c.kind && c.kind !== "custom";

  const facts: Fact[] = [
    { label: "Provider", value: c.provider, href: `/catalogue?provider=${c.provider}` },
    {
      label: "Kind",
      value: nameOf(cat, "kinds", c.kind),
      href: `/catalogue/kinds/${c.kind}`,
    },
    {
      label: "Category",
      value: category ? (cat.locale.categories[category]?.name ?? category) : "unknown",
    },
    c.docs
      ? { label: "Official docs", value: c.docs, href: c.docs, external: true }
      : { label: "Official docs", value: "not recorded", muted: true },
  ];
  if (generic)
    facts.push({
      label: "Generic?",
      value: "Vendor-neutral: the kind itself",
    });
  else if (c.kind === "custom")
    facts.push({ label: "Generic?", value: "The escape hatch: untyped on purpose" });

  const siblingsAll = Object.values(cat.components)
    .filter((x) => x.kind === c.kind && x.id !== id)
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id));

  const applicable = (rulesFor(cat, { kind: c.kind, category }) as Catalogue["rules"]).map((r) =>
    ruleRef(cat, r),
  );

  return {
    type: "component",
    id,
    title: loc.name ?? id,
    description: loc.description,
    path: `/catalogue/components/${id}`,
    frontMatter: {
      id,
      type: "component",
      kind: c.kind,
      provider: c.provider,
      category,
      docs: c.docs,
    },
    facts,
    properties: {
      rows: propRows(kind?.properties ?? {}, c.properties, c.defaults),
      caption: `${Object.keys(c.defaults).length} set by this component`,
    },
    rules: {
      caption: `Rules that apply · ${applicable.length}`,
      items: applicable,
    },
    siblings: {
      total: siblingsAll.length,
      items: siblingsAll.slice(0, 40).map((s) => ({
        id: s.id,
        name: nameOf(cat, "components", s.id),
        href: `/catalogue/components/${s.id}`,
        note: s.provider,
      })),
      kindHref: `/catalogue/kinds/${c.kind}`,
    },
    source: getSources().components[id] ?? "",
    summary: firstSentence(loc.description) || `${loc.name ?? id} (${c.kind}, ${c.provider})`,
  };
}

/* ----------------------------------------------------------------------------------- kind */

export function kindDoc(id: string): ReferenceDoc | null {
  const cat = getCatalogue();
  const kind = cat.kinds[id];
  if (!kind) return null;
  const loc = cat.locale.kinds[id] ?? {};
  const components = Object.values(cat.components).filter((c) => c.kind === id);
  const generic = components.find((c) => c.id === id);
  const byProvider = new Map<string, typeof components>();
  for (const c of components) {
    if (c === generic) continue;
    byProvider.set(c.provider, [...(byProvider.get(c.provider) ?? []), c]);
  }
  const groups: Array<{ provider: string; items: EntityLink[] }> = [];
  if (generic)
    groups.push({
      provider: "vendor-neutral",
      items: [
        {
          id: generic.id,
          name: nameOf(cat, "components", generic.id),
          href: `/catalogue/components/${generic.id}`,
          note: "the kind itself",
        },
      ],
    });
  for (const provider of [...byProvider.keys()].sort())
    groups.push({
      provider,
      items: (byProvider.get(provider) ?? [])
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((c) => ({
          id: c.id,
          name: nameOf(cat, "components", c.id),
          href: `/catalogue/components/${c.id}`,
          note: `${Object.keys(c.defaults).length} defaults`,
        })),
    });

  const applicable = (
    rulesFor(cat, { kind: id, category: kind.category }) as Catalogue["rules"]
  ).map((r) => ruleRef(cat, r));

  return {
    type: "kind",
    id,
    title: loc.name ?? id,
    description: loc.description,
    path: `/catalogue/kinds/${id}`,
    frontMatter: { id, type: "kind", category: kind.category },
    facts: [
      {
        label: "Category",
        value: cat.locale.categories[kind.category]?.name ?? kind.category,
      },
      { label: "Properties", value: String(Object.keys(kind.properties).length) },
      { label: "Components", value: String(components.length) },
      { label: "Rules", value: String(applicable.length) },
    ],
    properties: {
      rows: propRows(kind.properties, {}, {}),
      caption: `${Object.keys(kind.properties).length} defined by this kind`,
    },
    rules: { caption: `Rules for this kind · ${applicable.length}`, items: applicable },
    componentGroups: groups,
    source: getSources().kinds[id] ?? "",
    summary: firstSentence(loc.description) || `${loc.name ?? id} (${kind.category})`,
  };
}

/* ----------------------------------------------------------------------------------- rule */

/**
 * Reference designs whose broken twin names this rule in its header. The validator reads the same
 * header the same way (`MUST trip` up to `MUST NOT`); this mirrors that parse rather than keeping
 * a second list by hand.
 */
function trippedBy(ruleId: string): EntityLink[] {
  const out: EntityLink[] = [];
  for (const d of repoBrokenDesigns()) {
    if (!d.rules.includes(ruleId)) continue;
    out.push({ id: d.id, name: d.id, href: `/d/zeema/${d.id}` });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

type BrokenDesign = { id: string; rules: string[] };
let brokenCache: BrokenDesign[] | undefined;

function repoBrokenDesigns(): BrokenDesign[] {
  if (brokenCache) return brokenCache;
  // Built once per process: the design index touches the file system, and these pages must not
  // read it per request.
  brokenCache = repoDesigns()
    .filter((d) => d.broken && d.tier === "reference")
    .map((d) => {
      const header = d.yaml
        .split("\n")
        .filter((l) => l.startsWith("#"))
        .join("\n");
      const [tripPart] = header.split(/MUST NOT/i);
      const idx = tripPart.search(/MUST trip/i);
      const seg = idx >= 0 ? tripPart.slice(idx) : "";
      return {
        id: d.id,
        rules: [...new Set([...seg.matchAll(/([a-z][a-z0-9-]+)/g)].map((m) => m[1]))],
      };
    });
  return brokenCache;
}

export function ruleDoc(id: string): ReferenceDoc | null {
  const cat = getCatalogue();
  const rule = cat.rules.find((r) => r.id === id);
  if (!rule) return null;
  const ref = ruleRef(cat, rule);
  const sel = (rule.select ?? {}) as {
    node?: { kind?: string | string[]; category?: string | string[] };
    edge?: unknown;
    design?: boolean;
  };
  const kindIds = sel.node?.kind ? [([] as string[]).concat(sel.node.kind)].flat() : [];
  const categories = sel.node?.category ? [([] as string[]).concat(sel.node.category)].flat() : [];
  const kindLinks: EntityLink[] = (
    kindIds.length
      ? kindIds
      : categories.length
        ? Object.values(cat.kinds)
            .filter((k) => categories.includes(k.category))
            .map((k) => k.id)
        : []
  )
    .sort()
    .map((k) => ({ id: k, name: nameOf(cat, "kinds", k), href: `/catalogue/kinds/${k}` }));
  const kindSet = new Set(kindLinks.map((k) => k.id));
  const componentCount = sel.node
    ? Object.values(cat.components).filter((c) => kindSet.has(c.kind)).length
    : Object.keys(cat.components).length;

  return {
    type: "rule",
    id,
    title: ref.name,
    description: cat.locale.rules[id]?.description,
    path: `/catalogue/rules/${id}`,
    frontMatter: { id, type: "rule", severity: rule.severity },
    facts: [
      { label: "Severity", value: rule.severity },
      { label: "Selects", value: ref.selectText || "—" },
      { label: "Components in scope", value: componentCount.toLocaleString() },
    ],
    rules: { caption: "This rule", items: [ref] },
    appliesTo: {
      kinds: kindLinks,
      categories,
      componentCount,
      note: sel.design
        ? "This rule is about the whole design, not one node."
        : sel.edge
          ? "This rule is about an edge, so it belongs to a pair of nodes rather than one component."
          : "",
    },
    trippedBy: trippedBy(id),
    source: getSources().rules[id] ?? "",
    summary: cat.locale.rules[id]?.rationale
      ? firstSentence(cat.locale.rules[id]?.rationale)
      : ref.name,
  };
}

/* ----------------------------------------------------------------------------- site index */

export function catalogueCounts() {
  const cat = getCatalogue();
  return {
    kinds: Object.keys(cat.kinds).length,
    components: Object.keys(cat.components).length,
    rules: cat.rules.length,
    providers: new Set(Object.values(cat.components).map((c) => c.provider)).size,
  };
}

/**
 * The origin the markdown uses for absolute links. An explicit SITE_URL wins (it is the only way
 * to be right behind a proxy); otherwise the request's own Host, which is right in development and
 * for a direct hit in production.
 */
export function siteOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}
