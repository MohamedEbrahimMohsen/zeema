// The markup and name for a list thumbnail's corner badge (badge.ts decides which). Every mark is
// an existing file under icons/providers (Simple Icons, CC0, plus the neutral cloud marks), which
// the repository gate already checks, so nothing is uploaded and nothing new is drawn. The icon
// map sent to browsers does not carry this set; the listing is server-rendered, so it is read
// here, once per process per mark.
import fs from "node:fs";
import path from "node:path";
import type { Badge } from "./badge";
import { type Catalogue, repoRoot } from "./catalogue";
import { own } from "./own";

/** Catalogue provider ids whose mark has another file name under icons/providers. */
const PROVIDER_FILE: Record<string, string> = { gcp: "googlecloud", k8s: "kubernetes" };

type Mark = { markup: string; title: string | null };
const cache = new Map<string, Mark | null>();

// The inner markup of an icon file, its root fill carried onto a group so the mark keeps its
// colour inside the listing's own <svg>. Scripts, event handlers and foreign objects never reach
// the page, whatever the file holds.
function readMark(name: string): Mark | null {
  if (!/^[a-z0-9-]+$/.test(name)) return null;
  if (!cache.has(name)) {
    const file = path.join(repoRoot(), "icons", "providers", `${name}.svg`);
    let mark: Mark | null = null;
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      const open = raw.indexOf("<svg");
      const gt = open < 0 ? -1 : raw.indexOf(">", open);
      const close = raw.lastIndexOf("</svg>");
      if (gt >= 0 && close > gt) {
        const fill = /\sfill="(#[0-9a-fA-F]{3,8})"/.exec(raw.slice(open, gt))?.[1] ?? null;
        const title = /<title>(.*?)<\/title>/s.exec(raw)?.[1]?.trim() ?? null;
        const body = raw
          .slice(gt + 1, close)
          .replace(/<title>.*?<\/title>/gs, "")
          .replace(/<(script|foreignObject)\b[\s\S]*?<\/\1\s*>/gi, "")
          .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
          .replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, "$1#");
        if (body.trim()) mark = { markup: fill ? `<g fill="${fill}">${body}</g>` : body, title };
      }
    }
    cache.set(name, mark);
  }
  return cache.get(name) ?? null;
}

/** Markup and display name for a badge, or null when its mark has no file. */
export function badgeMark(
  badge: Badge,
  cat: Pick<Catalogue, "locale">,
): { markup: string; name: string } | null {
  if (!badge) return null;
  if (badge.kind === "provider") {
    const mark = readMark(own(PROVIDER_FILE, badge.id) ?? badge.id);
    if (!mark) return null;
    return { markup: mark.markup, name: own(cat.locale.providers, badge.id)?.name ?? badge.id };
  }
  const mark = readMark(badge.id);
  if (!mark) return null;
  const name = own(cat.locale.boundaryIcons, badge.id)?.name ?? mark.title ?? badge.id;
  return { markup: mark.markup, name };
}
