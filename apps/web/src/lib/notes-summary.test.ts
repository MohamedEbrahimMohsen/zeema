// A curated design's summary comes from its notes.md. A bullet's indented continuation lines
// once passed for a paragraph, so a listing showed half a sentence of an import note.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { firstParagraph } from "./notes-summary";

describe("firstParagraph", () => {
  it("skips a bullet with continuation lines and takes the paragraph after it", () => {
    const md = [
      "# Title",
      "",
      "- Source: a thing that wraps",
      "  onto a continuation line that is not a paragraph",
      "  and another one.",
      "- Second bullet",
      "  wrapped too.",
      "",
      "The real paragraph starts here",
      "and wraps once.",
      "",
      "Another paragraph.",
    ].join("\n");
    expect(firstParagraph(md)).toBe("The real paragraph starts here and wraps once.");
  });

  it("returns null when there is no top-level paragraph", () => {
    const md = [
      "# Title",
      "",
      "- Bullet",
      "  continuation",
      "",
      "## Section",
      "",
      "| a | b |",
      "|---|---|",
      "",
      "```",
      "code line",
      "```",
      "",
      "    indented code",
    ].join("\n");
    expect(firstParagraph(md)).toBeNull();
    expect(firstParagraph(null)).toBeNull();
    expect(firstParagraph("")).toBeNull();
  });

  it("takes a paragraph that comes before the bullets", () => {
    const md = ["# Title", "", "First paragraph, plainly.", "", "- Bullet", "  continuation"].join(
      "\n",
    );
    expect(firstParagraph(md)).toBe("First paragraph, plainly.");
  });

  it("never returns a bullet continuation for any committed design", () => {
    const root = path.resolve(import.meta.dirname, "../../../../designs");
    const files = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((t) => t.isDirectory())
      .flatMap((t) =>
        fs
          .readdirSync(path.join(root, t.name), { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => path.join(root, t.name, d.name, "notes.md")),
      )
      .filter((f) => fs.existsSync(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const md = fs.readFileSync(f, "utf8");
      const summary = firstParagraph(md);
      if (summary === null) continue;
      const continuations = md
        .split(/\r?\n/)
        .filter((l) => /^\s+\S/.test(l))
        .map((l) => l.trim().replace(/[*_`]/g, ""))
        .filter((l) => l.length > 0);
      const head = summary.split(" ").slice(0, 6).join(" ");
      for (const c of continuations) {
        expect(c.startsWith(head), `${path.relative(root, f)}: "${summary}"`).toBe(false);
      }
    }
  });
});
