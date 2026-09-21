// The documentation as data.
//
// Every page is a Markdown file under `apps/web/content/docs/<section>/<slug>.md` with front
// matter. This module is the only thing that reads that folder: it builds the navigation tree,
// the heading list each page's right-hand rail draws, and the previous/next links at the foot of
// a page. Pages and tests take the model from here and nothing else.
//
// The site layout reads cookies, so every route is dynamic and this would otherwise re-read the
// folder on every request. It is read once per process into a module-level cache instead. In
// development that means a restart after adding a page, which is the same deal the catalogue
// already makes.
import fs from "node:fs";
import path from "node:path";

/** Section directories, in the order they appear in the sidebar. A directory not named here is
 *  ignored, which is how a draft is kept out of the build without deleting it. */
const SECTIONS: Array<{ dir: string; title: string }> = [
  { dir: "overview", title: "Overview" },
  { dir: "concepts", title: "Concepts" },
  { dir: "reference", title: "Reference" },
  { dir: "operating", title: "Operating Zeema" },
];

export type DocHeading = { id: string; text: string; level: 2 | 3 };

export type DocPage = {
  /** `/docs`, `/docs/writing-a-design`. */
  href: string;
  title: string;
  description: string;
  section: string;
  sectionTitle: string;
  order: number;
  /** The Markdown body with the front matter removed. */
  body: string;
  headings: DocHeading[];
};

export type DocNav = Array<{
  dir: string;
  title: string;
  items: Array<{ href: string; title: string }>;
}>;

/* --------------------------------------------------------------------------- front matter */

/**
 * The front matter of a docs page: a `---` fenced block of `key: value` lines at the top of the
 * file. Deliberately not a YAML parser — the keys are a closed set of one-line strings and
 * numbers, and a document that needs more than that is a document doing too much.
 */
export function parseFrontMatter(text: string): { data: Record<string, string>; body: string } {
  const normalised = text.replace(/\r\n/g, "\n");
  if (!normalised.startsWith("---\n")) return { data: {}, body: normalised };
  const end = normalised.indexOf("\n---\n", 3);
  if (end === -1) return { data: {}, body: normalised };
  const data: Record<string, string> = {};
  for (const line of normalised.slice(4, end).split("\n")) {
    const at = line.indexOf(":");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    )
      value = value.slice(1, -1);
    data[key] = value;
  }
  return { data, body: normalised.slice(end + 5) };
}

/* -------------------------------------------------------------------------------- headings */

/** The anchor for a heading. One implementation, shared by the rail and by the renderer. */
export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";

/** The plain text of a heading: inline code, links and emphasis stripped of their markers. */
export const headingText = (raw: string) =>
  raw
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .trim();

/** Every `##` and `###` outside a fenced block, in document order. */
export function collectHeadings(body: string): DocHeading[] {
  const out: DocHeading[] = [];
  let fence: string | null = null;
  for (const line of body.split("\n")) {
    const f = /^\s*(```+|~~~+)/.exec(line);
    if (f) {
      if (fence === null) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const h = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!h) continue;
    const text = headingText(h[2]);
    out.push({ id: headingId(text), text, level: h[1].length === 2 ? 2 : 3 });
  }
  return out;
}

/* ---------------------------------------------------------------------------------- blocks */

/** The generated blocks a content file may ask for with `{{name}}`. `DocsGenerated` implements
 *  exactly these, and the loader test fails on a content file asking for anything else. */
export const GENERATED_BLOCK_NAMES = [
  "rules-table",
  "kind-index",
  "provider-index",
  "api-routes",
  "api-other-routes",
  "api-all-routes",
  "catalogue-counts",
] as const;

export type GeneratedBlockName = (typeof GENERATED_BLOCK_NAMES)[number];

export type DocBlock =
  | { kind: "markdown"; text: string }
  | { kind: "callout"; tone: "note" | "tip" | "warning"; text: string }
  | { kind: "generated"; name: string };

const TONES: Record<string, "note" | "tip" | "warning"> = {
  NOTE: "note",
  TIP: "tip",
  WARNING: "warning",
  IMPORTANT: "note",
  CAUTION: "warning",
};

/**
 * A page body cut into the pieces the renderer draws differently: prose, GitHub-style alert
 * blockquotes (`> [!NOTE]`), and the generated tables the docs pull from the catalogue, written
 * as a line holding nothing but `{{name}}`.
 *
 * Fenced code is opaque: a `>` or a `{{` inside a sample is a sample, not a directive.
 */
export function splitBlocks(body: string): DocBlock[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: DocBlock[] = [];
  let buffer: string[] = [];
  let fence: string | null = null;
  const flush = () => {
    const text = buffer.join("\n");
    if (text.trim()) out.push({ kind: "markdown", text });
    buffer = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const f = /^\s*(```+|~~~+)/.exec(line);
    if (f) {
      if (fence === null) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      buffer.push(line);
      continue;
    }
    if (fence !== null) {
      buffer.push(line);
      continue;
    }
    const gen = /^\{\{([a-z][a-z0-9-]*)\}\}\s*$/.exec(line);
    if (gen) {
      flush();
      out.push({ kind: "generated", name: gen[1] });
      continue;
    }
    const alert = /^>\s*\[!([A-Z]+)\]\s*$/.exec(line);
    if (alert && TONES[alert[1]]) {
      flush();
      const inner: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].startsWith(">")) {
        inner.push(lines[j].replace(/^>\s?/, ""));
        j++;
      }
      out.push({ kind: "callout", tone: TONES[alert[1]], text: inner.join("\n").trim() });
      i = j - 1;
      continue;
    }
    buffer.push(line);
  }
  flush();
  return out;
}

/* ---------------------------------------------------------------------------------- loading */

function contentDir(): string {
  // `next start` and `next dev` both run with apps/web as the working directory; the tests run
  // from the same place. The repository root is the fallback for anything that does not.
  const candidates = [
    path.join(process.cwd(), "content", "docs"),
    path.join(process.cwd(), "apps", "web", "content", "docs"),
  ];
  return candidates.find((c) => fs.existsSync(c)) ?? candidates[0];
}

type Loaded = { pages: DocPage[]; byHref: Map<string, DocPage>; nav: DocNav };

const g = globalThis as unknown as { __zeemaDocs?: Loaded };

function load(): Loaded {
  const dir = contentDir();
  const pages: DocPage[] = [];
  for (const section of SECTIONS) {
    const sectionDir = path.join(dir, section.dir);
    if (!fs.existsSync(sectionDir)) continue;
    for (const file of fs.readdirSync(sectionDir).sort()) {
      if (!file.endsWith(".md")) continue;
      const raw = fs.readFileSync(path.join(sectionDir, file), "utf8");
      const { data, body } = parseFrontMatter(raw);
      const slug = file.slice(0, -3);
      pages.push({
        href: data.path || `/docs/${slug}`,
        title: data.title || slug,
        description: data.description || "",
        section: section.dir,
        sectionTitle: section.title,
        order: Number(data.order ?? 100),
        body,
        headings: collectHeadings(body),
      });
    }
  }
  pages.sort(
    (a, b) =>
      SECTIONS.findIndex((s) => s.dir === a.section) -
        SECTIONS.findIndex((s) => s.dir === b.section) ||
      a.order - b.order ||
      a.title.localeCompare(b.title),
  );
  const nav: DocNav = SECTIONS.map((s) => ({
    dir: s.dir,
    title: s.title,
    items: pages.filter((p) => p.section === s.dir).map((p) => ({ href: p.href, title: p.title })),
  })).filter((s) => s.items.length > 0);
  return { pages, byHref: new Map(pages.map((p) => [p.href, p])), nav };
}

function docs(): Loaded {
  if (!g.__zeemaDocs) g.__zeemaDocs = load();
  return g.__zeemaDocs;
}

/** Every page, in sidebar order. */
export const allDocs = (): DocPage[] => docs().pages;

/** The sidebar tree as it ships. */
export const docsNav = (): DocNav => docs().nav;

/** One page, or null when the address names nothing. */
export const docPage = (href: string): DocPage | null => docs().byHref.get(href) ?? null;

/** The page before and after this one in reading order, across section boundaries. */
export function docNeighbours(href: string) {
  const pages = docs().pages;
  const i = pages.findIndex((p) => p.href === href);
  return {
    prev: i > 0 ? pages[i - 1] : null,
    next: i >= 0 && i < pages.length - 1 ? pages[i + 1] : null,
  };
}

/** The crumb trail for a page: Docs / Section / Page. */
export function docBreadcrumb(page: DocPage) {
  return [
    { label: "Docs", href: "/docs" },
    { label: page.sectionTitle, href: null },
    { label: page.title, href: null },
  ];
}

/** The search index the sidebar filters against: one row per page and per heading. */
export function docSearchIndex() {
  const rows: Array<{ href: string; title: string; page: string; section: string }> = [];
  for (const p of docs().pages) {
    rows.push({ href: p.href, title: p.title, page: p.title, section: p.sectionTitle });
    for (const h of p.headings)
      rows.push({
        href: `${p.href}#${h.id}`,
        title: h.text,
        page: p.title,
        section: p.sectionTitle,
      });
  }
  return rows;
}
