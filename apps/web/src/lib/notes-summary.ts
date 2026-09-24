// The one-line summary a curated design shows in listings, taken from its notes.md: the first
// top-level plain paragraph. Headings, list items, tables and fenced code are skipped as whole
// blocks, so a bullet's indented continuation lines never pass for a paragraph of their own.

const BLOCK_MARKERS = ["#", "-", "*", "|", ">"];

export function firstParagraph(md: string | null): string | null {
  if (!md) return null;
  const out: string[] = [];
  let inSkipped = false; // inside a list/heading/table block, which only a blank line ends
  let inFence = false;
  for (const line of md.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("```") || t.startsWith("~~~")) {
      if (out.length) break;
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (t === "") {
      if (out.length) break;
      inSkipped = false;
      continue;
    }
    if (out.length) {
      // A paragraph ends at the first line that opens another block.
      if (BLOCK_MARKERS.some((m) => t.startsWith(m))) break;
      out.push(t);
      continue;
    }
    if (BLOCK_MARKERS.some((m) => t.startsWith(m))) {
      inSkipped = true;
      continue;
    }
    // A continuation of a skipped block, or an indented line that is not top-level text.
    if (inSkipped || /^\s/.test(line)) continue;
    out.push(t);
  }
  const text = out.join(" ").replace(/[*_`]/g, "");
  return text ? text.slice(0, 280) : null;
}
