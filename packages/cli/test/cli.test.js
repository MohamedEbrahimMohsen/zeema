// The command line against the committed designs: exit codes, every output format, render,
// catalogue queries and init, all in a temporary directory so nothing touches the repository.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { main, resolveInside, resolveOut } from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");
const clean = "designs/reference/order-processing/design.yaml";
const broken = "designs/reference/order-processing/design.broken.yaml";

let tmp;
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeema-cli-"));
});
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const run = async (args, cwd = ROOT) => {
  let out = "";
  let err = "";
  const code = await main(args, { stdout: (s) => (out += s), stderr: (s) => (err += s), cwd });
  return { code, out, err };
};

describe("lint", () => {
  it("exits 0 on a clean reference design", async () => {
    const r = await run(["lint", clean]);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`ok    ${clean}`);
  });

  it("exits 1 on its broken twin and names the rules", async () => {
    const r = await run(["lint", broken]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/queue-missing-dlq|pubsub-replay-required|datastore/);
    expect(r.out).toMatch(/\d+ errors?, \d+ warnings?/);
  });

  it("json output is structured", async () => {
    const r = await run(["lint", broken, "--format", "json"]);
    const j = JSON.parse(r.out);
    expect(j.version).toBe(1);
    expect(j.files[0].file).toBe(broken);
    expect(j.files[0].findings.length).toBeGreaterThan(0);
    for (const f of j.files[0].findings) {
      expect(f).toMatchObject({
        id: expect.any(String),
        severity: expect.stringMatching(/^(error|warning|info)$/),
        message: expect.any(String),
        line: expect.any(Number),
      });
    }
  });

  it("sarif output validates its basic shape", async () => {
    const r = await run(["lint", broken, "--format", "sarif"]);
    const s = JSON.parse(r.out);
    expect(s.version).toBe("2.1.0");
    expect(s.runs[0].tool.driver.name).toBe("zeema");
    expect(s.runs[0].results.length).toBeGreaterThan(0);
    expect(s.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri).toBe(broken);
  });

  it("--fail-on never returns 0 despite rule findings, but structure still fails", async () => {
    expect((await run(["lint", broken, "--fail-on", "never"])).code).toBe(0);
    const bad = path.join(tmp, "bad.zeema.yaml");
    fs.writeFileSync(
      bad,
      'schemaVersion: "1"\ntype: "design"\nid: "bad"\nnodes:\n  - { id: "a", component: "no-such-component" }\nedges: []\n',
    );
    const r = await run(["lint", bad, "--fail-on", "never"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("structure");
  });

  it("a malformed design ref is a structure finding on the node's line", async () => {
    const bad = path.join(tmp, "ref.zeema.yaml");
    fs.writeFileSync(
      bad,
      [
        'schemaVersion: "1"',
        'type: "design"',
        'id: "feed"',
        "nodes:",
        '  - id: "a"',
        '    component: "kafka"',
        "  - id: notify",
        '    component: "kafka"',
        "    ref:",
        '      design: "not-owner-slug"',
        '      version: "latest"',
        "edges: []",
        "",
      ].join("\n"),
    );
    const r = await run(["lint", bad, "--format", "json"]);
    expect(r.code).toBe(1);
    const found = JSON.parse(r.out).files[0].findings.filter((f) => / ref /.test(f.message));
    expect(found.map((f) => [f.id, f.line, f.blocking])).toEqual([
      ["structure", 7, true],
      ["structure", 7, true],
    ]);
    expect(found[0].message).toBe('node notify ref design "not-owner-slug" is not owner/slug');
    expect(found[1].message).toBe(
      'node notify ref version "latest" is not a release number (1 or more) or "head"',
    );
  });

  it("a YAML refusal is a finding with a line, not a crash", async () => {
    const bad = path.join(tmp, "tabs.zeema.yaml");
    fs.writeFileSync(
      bad,
      'schemaVersion: "1"\ntype: "design"\nid: "bad"\nnodes:\n\t- { id: "a", component: "kafka" }\nedges: []\n',
    );
    const r = await run(["lint", bad]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/yaml.*tab.*line 5/);
  });

  it("lints a whole directory and writes to --out", async () => {
    const out = path.join(tmp, "report.json");
    const r = await run(["lint", "designs/reference", "--format", "json", "--out", out]);
    expect(r.code).toBe(1);
    const j = JSON.parse(fs.readFileSync(out, "utf8"));
    // Every reference design is a clean file and its broken twin. Counted from the directory
    // rather than hard-coded, so adding a design does not fail an unrelated test.
    const onDisk = fs
      .readdirSync(path.join(ROOT, "designs", "reference"))
      .flatMap((d) => fs.readdirSync(path.join(ROOT, "designs", "reference", d)))
      .filter((f) => f.endsWith(".yaml")).length;
    expect(onDisk).toBeGreaterThan(1);
    expect(j.counts.files).toBe(onDisk);
  });

  it("usage errors exit 2", async () => {
    expect((await run(["lint", "no/such/path"])).code).toBe(2);
    expect((await run(["frobnicate"])).code).toBe(2);
    expect((await run(["lint", clean, "--format", "xml"])).code).toBe(2);
  });
});

describe("render", () => {
  it("svg", async () => {
    const r = await run(["render", clean]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^<svg xmlns/);
    expect(r.out).toContain("</svg>");
    expect(r.out).toContain('class="ic"');
  });
  it("draws with the design.layout.json beside the design, as the spec says", async () => {
    const dir = path.join(tmp, "sidecar");
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(ROOT, clean), path.join(dir, "design.yaml"));
    const auto = await run(["render", "design.yaml"], dir);
    expect(auto.code).toBe(0);
    fs.writeFileSync(
      path.join(dir, "design.layout.json"),
      JSON.stringify({ version: 2, nodes: { api: [4321, 1234] }, edges: {} }),
    );
    const drawn = await run(["render", "design.yaml"], dir);
    expect(drawn.code).toBe(0);
    expect(drawn.out).not.toBe(auto.out);
    expect(drawn.out).toContain("4321");
    // `--layout none` is the engine's own arrangement; `--layout <file>` names another file.
    expect((await run(["render", "design.yaml", "--layout", "none"], dir)).out).toBe(auto.out);
    fs.renameSync(path.join(dir, "design.layout.json"), path.join(dir, "other.json"));
    expect((await run(["render", "design.yaml"], dir)).out).toBe(auto.out);
    expect((await run(["render", "design.yaml", "--layout", "other.json"], dir)).out).toBe(
      drawn.out,
    );
    fs.writeFileSync(path.join(dir, "design.layout.json"), "{ not json");
    const bad = await run(["render", "design.yaml"], dir);
    expect(bad.code).toBe(2);
    expect(bad.err).toMatch(/design\.layout\.json: not JSON/);
  });
  it("mermaid", async () => {
    const r = await run(["render", clean, "--format", "mermaid"]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^flowchart TD/);
    expect(r.out).toMatch(/-->|-\.->/);
  });
});

describe("catalogue", () => {
  it("finds, describes and lists", async () => {
    expect((await run(["catalogue", "find", "kafka"])).out).toContain("kafka");
    expect((await run(["catalogue", "component", "kafka"])).out).toContain("effective properties");
    expect((await run(["catalogue", "kind", "queue"])).out).toContain("components:");
    expect((await run(["catalogue", "kinds"])).out).toContain("queue");
    expect((await run(["catalogue", "providers", "queue"])).out).toContain("aws");
    expect((await run(["catalogue", "find", "zzz-nothing-here"])).code).toBe(1);
    expect((await run(["catalogue"])).code).toBe(2);
  });
});

describe("init and validate", () => {
  it("init writes a starter that lints clean", async () => {
    const dir = path.join(tmp, "proj");
    const r = await run(["init", dir]);
    expect(r.code).toBe(0);
    expect(fs.existsSync(path.join(dir, "architecture", "checkout.zeema.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(dir, ".github", "workflows", "zeema.yml"))).toBe(true);
    const lint = await run(["lint", "--root", ROOT], dir);
    expect(lint.out).toContain("pubsub-replay-required");
    expect(lint.code).toBe(1);
  });

  it("validate passes on the repository", async () => {
    const r = await run(["validate"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("all checks passed");
  }, 120_000);
});

describe("--out stays where it is told (resolveOut)", () => {
  it("accepts a relative path inside the working directory", () => {
    const dir = fs.mkdtempSync(path.join(tmp, "cwd-"));
    expect(resolveOut(dir, "reports/out.svg")).toBe(path.join(dir, "reports", "out.svg"));
  });

  it("refuses a relative path that climbs out of the working directory", () => {
    const dir = fs.mkdtempSync(path.join(tmp, "cwd-"));
    expect(() => resolveOut(dir, "../escape.svg")).toThrow(/outside the working directory/);
    expect(() => resolveOut(dir, "a/../../escape.svg")).toThrow(/outside the working directory/);
  });

  it("accepts an explicit absolute path", () => {
    const dir = fs.mkdtempSync(path.join(tmp, "abs-"));
    const target = path.join(dir, "x.svg");
    expect(resolveOut(process.cwd(), target)).toBe(target);
  });

  it("refuses a directory link inside cwd that points out of it", () => {
    const dir = fs.mkdtempSync(path.join(tmp, "cwd-"));
    const outside = fs.mkdtempSync(path.join(tmp, "outside-"));
    // A junction needs no privilege on Windows; elsewhere it is an ordinary directory link.
    fs.symlinkSync(outside, path.join(dir, "link"), "junction");
    expect(() => resolveOut(dir, "link/x.svg")).toThrow(/through a link/);
  });

  it("refuses a target that is itself a symbolic link", () => {
    const dir = fs.mkdtempSync(path.join(tmp, "cwd-"));
    const victim = path.join(tmp, "victim.txt");
    fs.writeFileSync(victim, "keep");
    try {
      fs.symlinkSync(victim, path.join(dir, "out.svg"), "file");
    } catch {
      return; // file links need a privilege on Windows; the directory case above still runs
    }
    expect(() => resolveOut(dir, "out.svg")).toThrow(/symbolic link/);
    expect(() => resolveOut(dir, path.join(dir, "out.svg"))).toThrow(/symbolic link/);
  });

  it("reports a refused --out as a usage error without writing", async () => {
    const dir = fs.mkdtempSync(path.join(tmp, "cwd-"));
    const design = path.join(ROOT, clean);
    const r = await run(["render", design, "--out", "../nope.svg"], dir);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/outside the working directory/);
    expect(fs.existsSync(path.join(dir, "..", "nope.svg"))).toBe(false);
  });
});

describe("reads stay inside the working directory (resolveInside)", () => {
  it("accepts a file inside, relative or absolute", () => {
    const dir = fs.mkdtempSync(path.join(tmp, "in-"));
    fs.writeFileSync(path.join(dir, "d.yaml"), "x");
    const real = fs.realpathSync(dir);
    expect(resolveInside(dir, "d.yaml")).toBe(path.join(real, "d.yaml"));
    expect(resolveInside(dir, path.join(real, "d.yaml"))).toBe(path.join(real, "d.yaml"));
  });

  it("refuses a climb, an absolute path elsewhere, and a link leading out", () => {
    const dir = fs.mkdtempSync(path.join(tmp, "in-"));
    const outside = fs.mkdtempSync(path.join(tmp, "outside-"));
    fs.writeFileSync(path.join(outside, "secret.yaml"), "x");
    expect(() => resolveInside(dir, "../secret.yaml")).toThrow(/outside the working directory/);
    expect(() => resolveInside(dir, path.join(outside, "secret.yaml"))).toThrow(
      /outside the working directory/,
    );
    fs.symlinkSync(outside, path.join(dir, "link"), "junction");
    expect(() => resolveInside(dir, "link/secret.yaml")).toThrow(/through a link/);
  });
});
