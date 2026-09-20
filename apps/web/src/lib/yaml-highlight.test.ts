// The colouring may never change the text. Every committed design goes through the tokenizer
// and has to come back out byte for byte, because the block on the page is what people read,
// select and copy — a highlighter that eats a character is a corrupted source.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { highlightYaml, type Line } from "./yaml-highlight";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..", "..");

const flatten = (lines: Line[]) => lines.map((l) => l.map((s) => s.s).join("")).join("\n");
const roundTrip = (text: string) => flatten(highlightYaml(text));

function designFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return designFiles(full);
    return e.isFile() && /\.ya?ml$/.test(e.name) ? [full] : [];
  });
}

describe("yaml highlighting", () => {
  const files = designFiles(path.join(root, "designs"));

  it("finds the committed designs to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => path.relative(root, f)))("leaves %s byte for byte", (rel) => {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    expect(roundTrip(text)).toBe(text);
  });

  const edges: Array<[string, string]> = [
    ["a colon inside a quoted string", 'url: "https://example.com:8443/a?b=c"\n'],
    ["a hash inside a string", 'note: "sharp # not a comment"\n'],
    ["a hash inside single quotes", "note: 'a # b'\n"],
    ["an empty value then a comment", "key: # comment\n"],
    ["a comment line on its own", "# just a comment\n\n  # indented\n"],
    ["a flow map on one line", '- { id: "x", kind: "region", n: 3, ok: true, z: null }\n'],
    ["a flow sequence", "ports: [80, 443, 8080]\n"],
    ["a nested flow", '- { id: "a", tags: ["x", "y"], meta: { deep: { deeper: 1 } } }\n'],
    ["a block scalar with | markers", "desc: |\n  key: not a key\n  # not a comment\nnext: 1\n"],
    ["a folded scalar", "desc: >-\n  folded text\nnext: 1\n"],
    ["an escaped quote", 'q: "he said \\"hi\\" loudly"\n'],
    ["a doubled single quote", "q: 'it''s here'\n"],
    ["a document marker", '---\nid: "x"\n...\n'],
    ["nested sequence markers", "- - a\n  - b\n"],
    ["trailing whitespace", "a: 1   \nb: 2\t\n"],
    ["an unterminated quote", 'a: "oops\n'],
    ["CRLF line endings", 'a: 1\r\nb: "x"\r\n'],
    ["a bare url value", "site: http://example.com/x#y\n"],
    ["no trailing newline", "a: 1"],
    ["the empty document", ""],
    ["blank lines only", "\n\n\n"],
  ];

  it.each(edges)("leaves %s byte for byte", (_name, text) => {
    expect(roundTrip(text)).toBe(text);
  });

  it("tints keys, strings, numbers, booleans and comments apart", () => {
    const [line] = highlightYaml('id: "svc" # note');
    const kinds = Object.fromEntries(line.filter((s) => s.t).map((s) => [s.s.trim(), s.t]));
    expect(kinds.id).toBe("key");
    expect(kinds[":"]).toBe("punct");
    expect(kinds['"svc"']).toBe("str");
    expect(kinds["# note"]).toBe("comment");
    const [nums] = highlightYaml("- { n: 3, ok: true, z: null }");
    const tags = nums.filter((s) => s.t).map((s) => `${s.t}:${s.s.trim()}`);
    expect(tags).toContain("num:3");
    expect(tags).toContain("bool:true");
    expect(tags).toContain("bool:null");
    expect(tags).toContain("punct:-");
  });
});
