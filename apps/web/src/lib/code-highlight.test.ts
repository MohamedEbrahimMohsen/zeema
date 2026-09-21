// The tokenizer's one hard promise: it never changes a byte.
//
// Every span of every line, concatenated in order, is the line it came from — for bash, for JSON,
// for HTTP and for a language it has never heard of. A highlighter that drops a character turns a
// copied command into a broken one, so this is the test that matters; the tints are checked
// afterwards, and only where they are load-bearing.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { highlightCode, LANGS } from "./code-highlight";

const rebuild = (lang: string, text: string) =>
  highlightCode(lang, text)
    .map((line) => line.map((s) => s.s).join(""))
    .join("\n");

const SAMPLES: Record<string, string> = {
  bash: [
    "# install and run",
    "pnpm install",
    "$ zeema lint architecture --fail-on warning",
    'zeema render design.yaml --format svg --out "my design.svg"  # tinted',
    "curl -s localhost:3000/api/health | jq '.status'",
    "15 3 * * * cd /srv/zeema && ./ops/backup.sh >> /var/log/zeema.log 2>&1",
    "",
    "echo 'it'\\''s fine'",
  ].join("\n"),
  json: [
    "{",
    '  "version": 1,',
    '  "counts": { "files": 1, "error": 0, "blocking": 0 },',
    '  "valid": true,',
    '  "layout": null,',
    '  "ratio": -12.5e3,',
    '  "message": "a \\"quoted\\" word, and a : colon",',
    "  }",
  ].join("\n"),
  http: [
    "# a request",
    "GET /api/v1/designs/ada/order-processing?q=x HTTP/1.1",
    'If-Match: "5f3a"',
    "Content-Type: application/json",
    "",
    '{ "yaml": "schemaVersion: \\"1\\"" }',
  ].join("\n"),
  text: "nothing in here is a language\n  not even   this\n",
};

describe("highlightCode", () => {
  for (const [lang, source] of Object.entries(SAMPLES))
    it(`is byte-exact for ${lang}`, () => {
      expect(rebuild(lang, source)).toBe(source);
    });

  it("is byte-exact for every alias, and for an unknown language", () => {
    for (const alias of [...Object.keys(LANGS), "rust", "", "YAML"])
      for (const source of Object.values(SAMPLES)) expect(rebuild(alias, source)).toBe(source);
  });

  it("is byte-exact for every code block in the documentation", () => {
    const dir = path.join(process.cwd(), "content", "docs");
    let blocks = 0;
    for (const file of walk(dir)) {
      const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
      for (const m of text.matchAll(/^```([a-z]*)[^\n]*\n([\s\S]*?)^```$/gm)) {
        const [, lang, body] = m;
        if (lang === "yaml" || lang === "yml") continue;
        blocks++;
        expect(rebuild(lang, body.replace(/\n$/, ""))).toBe(body.replace(/\n$/, ""));
      }
    }
    expect(blocks).toBeGreaterThan(10);
  });

  it("keeps an empty input empty", () => {
    expect(highlightCode("bash", "")).toEqual([[]]);
  });

  it("tints the things the reader is looking for", () => {
    const [line] = highlightCode("bash", "$ zeema lint --fail-on warning # go");
    expect(line.find((s) => s.s === "$")?.t).toBe("punct");
    expect(line.find((s) => s.s === "--fail-on")?.t).toBe("key");
    expect(line.find((s) => s.s === "# go")?.t).toBe("comment");

    const [json] = highlightCode("json", '{ "id": "sqs", "n": 4, "ok": true }');
    expect(json.find((s) => s.s === '"id"')?.t).toBe("key");
    expect(json.find((s) => s.s === '"sqs"')?.t).toBe("str");
    expect(json.find((s) => s.s === "4")?.t).toBe("num");
    expect(json.find((s) => s.s === "true")?.t).toBe("bool");

    const [req, , header] = highlightCode(
      "http",
      "POST /api/v1/lint\nHost: zeema.dev\nContent-Type: application/json",
    );
    expect(req[0]).toEqual({ t: "bool", s: "POST" });
    expect(header[0].t).toBe("key");
  });

  it("does not treat a hash inside a quoted string as a comment", () => {
    const source = 'echo "#1 rule"';
    expect(rebuild("bash", source)).toBe(source);
    const [line] = highlightCode("bash", source);
    expect(line.some((s) => s.t === "comment")).toBe(false);
  });
});

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith(".md")) yield full;
  }
}
