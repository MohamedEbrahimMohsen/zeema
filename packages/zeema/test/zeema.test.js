// The published package as a user gets it: what `npm pack` would put in the tarball, the tarball
// unpacked into a temporary project and run through its own bin, and the MCP server spoken to
// with the SDK's client. Needs dist/ (turbo runs this package's build before its test).
//
// No network: instead of `npm install`, the tarball is unpacked where npm would put it and its
// two runtime dependencies are linked in from this workspace.
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(here, "..");
const ROOT = path.resolve(PKG, "..", "..");
const manifest = JSON.parse(fs.readFileSync(path.join(PKG, "package.json"), "utf8"));
const DESIGN = "designs/reference/order-processing";
const npm = (args, cwd) =>
  execSync(["npm", ...args.map((a) => JSON.stringify(a))].join(" "), {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

let tmp;
let project;
let bin;
const zeema = (args) => {
  try {
    return {
      code: 0,
      out: execFileSync(process.execPath, [bin, ...args], {
        cwd: project,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    };
  } catch (e) {
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
};

beforeAll(() => {
  if (!fs.existsSync(path.join(PKG, "dist", "bin.js")))
    throw new Error("packages/zeema/dist is missing: run `pnpm --filter zeema build` first");
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeema-pkg-"));
  // The tarball, unpacked where `npm install` would put it.
  const [packed] = JSON.parse(npm(["pack", "--json", "--pack-destination", tmp], PKG));
  project = path.join(tmp, "project");
  const installed = path.join(project, "node_modules", "zeema");
  fs.mkdirSync(installed, { recursive: true });
  // Relative names only: GNU tar on Windows reads "C:" in a path as a remote host.
  execFileSync(
    "tar",
    ["-xzf", path.join("..", "..", "..", packed.filename), "--strip-components=1"],
    {
      cwd: installed,
    },
  );
  for (const dep of Object.keys(manifest.dependencies)) {
    const link = path.join(project, "node_modules", dep);
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(PKG, "node_modules", dep)), link, "junction");
  }
  bin = path.join(installed, manifest.bin.zeema);
  fs.copyFileSync(path.join(ROOT, DESIGN, "design.yaml"), path.join(project, "design.yaml"));
});

afterAll(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe("the tarball", () => {
  it("holds only dist, the readme, the licence and the manifest, under 8 MB", () => {
    const [packed] = JSON.parse(npm(["pack", "--dry-run", "--json"], PKG));
    const files = packed.files.map((f) => f.path);
    for (const f of files)
      expect(f.startsWith("dist/") || ["README.md", "LICENSE", "package.json"].includes(f)).toBe(
        true,
      );
    for (const f of ["dist/bin.js", "dist/zeema.js", "README.md", "LICENSE"])
      expect(files).toContain(f);
    for (const f of ["catalogue.json", "icons.json", "meta.json"])
      expect(files).toContain(`dist/catalogue/${f}`);
    expect(packed.size).toBeLessThan(8 * 1024 * 1024);
  });

  it("depends at run time on the MCP SDK and zod alone", () => {
    expect(Object.keys(manifest.dependencies).sort()).toEqual(["@modelcontextprotocol/sdk", "zod"]);
    expect(manifest.peerDependencies).toBeUndefined();
  });
});

describe("the installed command", () => {
  it("version names the package and the catalogue it carries", () => {
    const meta = JSON.parse(
      fs.readFileSync(path.join(PKG, "dist", "catalogue", "meta.json"), "utf8"),
    );
    const cat = JSON.parse(
      fs.readFileSync(path.join(PKG, "dist", "catalogue", "catalogue.json"), "utf8"),
    );
    expect(meta.counts).toEqual({
      kinds: Object.keys(cat.kinds).length,
      components: Object.keys(cat.components).length,
      rules: cat.rules.length,
    });
    const r = zeema(["version"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`zeema ${manifest.version}`);
    expect(r.out).toContain(`catalogue ${meta.commit.slice(0, 12)} ${meta.date}`);
    expect(r.out).toContain(`${meta.counts.components} components`);
  });

  it("lints a reference design clean", () => {
    const r = zeema(["lint", "design.yaml"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("ok    design.yaml");
  });

  it("renders an SVG with the bundled icons", () => {
    const r = zeema(["render", "design.yaml"]);
    expect(r.code).toBe(0);
    expect(r.out.startsWith("<svg")).toBe(true);
  });

  it("has no validate command, and help lists mcp", () => {
    expect(zeema(["validate"]).code).toBe(2);
    const help = zeema(["help"]).out;
    expect(help).toContain("mcp");
    expect(help).not.toContain("validate");
  });
});

describe("zeema mcp", () => {
  let client;
  beforeAll(async () => {
    client = new Client({ name: "zeema-test", version: "0" });
    await client.connect(
      new StdioClientTransport({ command: process.execPath, args: [bin, "mcp"], cwd: project }),
    );
  });
  afterAll(async () => {
    await client?.close();
  });
  const call = async (name, args = {}) => {
    const r = await client.callTool({ name, arguments: args });
    return { error: Boolean(r.isError), text: r.content[0].text };
  };

  it("lists every tool", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        "catalogue_component",
        "catalogue_find",
        "catalogue_kind",
        "design_schema",
        "explain_rule",
        "lint_design",
        "list_kinds",
        "list_providers",
        "read_design",
        "render_design",
      ].sort(),
    );
    for (const t of tools) expect(t.description.length).toBeGreaterThan(20);
  });

  it("lints a reference design with no errors, by path and by text", async () => {
    const byPath = JSON.parse((await call("lint_design", { path: "design.yaml" })).text);
    expect(byPath.version).toBe(1);
    expect(byPath.counts.error).toBe(0);
    const yaml = fs.readFileSync(path.join(project, "design.yaml"), "utf8");
    const byText = JSON.parse((await call("lint_design", { yaml })).text);
    expect(byText.counts).toEqual(byPath.counts);
  });

  it("reads and renders a design", async () => {
    const read = JSON.parse((await call("read_design", { path: "design.yaml" })).text);
    expect(read.summary.id).toBe("order-processing");
    expect(read.summary.nodes.every((n) => n.component && n.kind)).toBe(true);
    const mermaid = await call("render_design", { path: "design.yaml", format: "mermaid" });
    expect(mermaid.error).toBe(false);
    expect(mermaid.text.length).toBeGreaterThan(0);
  });

  it("refuses a path outside the directory it runs in", async () => {
    const r = await call("read_design", { path: "../outside.yaml" });
    expect(r.error).toBe(true);
    expect(r.text).toMatch(/outside the working directory/);
  });

  it("queries the catalogue", async () => {
    const found = JSON.parse((await call("catalogue_find", { words: ["kafka"] })).text);
    expect(found.total).toBeGreaterThan(0);
    expect(found.components[0]).toMatchObject({
      id: expect.any(String),
      provider: expect.any(String),
      kind: expect.any(String),
      name: expect.any(String),
    });
    const c = JSON.parse((await call("catalogue_component", { id: found.components[0].id })).text);
    expect(c.properties.length).toBeGreaterThan(0);
    const kinds = JSON.parse((await call("list_kinds")).text);
    const k = JSON.parse((await call("catalogue_kind", { id: kinds[0].id })).text);
    expect(k.id).toBe(kinds[0].id);
    expect((await call("catalogue_kind", { id: "no-such-kind" })).error).toBe(true);
  });

  it("explains a rule and serves the schema", async () => {
    const cat = JSON.parse(
      fs.readFileSync(path.join(PKG, "dist", "catalogue", "catalogue.json"), "utf8"),
    );
    const rule = JSON.parse((await call("explain_rule", { id: cat.rules[0].id })).text);
    expect(rule.name).toBe(cat.locale.rules[cat.rules[0].id].name);
    const schema = JSON.parse((await call("design_schema")).text);
    expect(schema).toEqual(cat.schema);
    const res = await client.readResource({ uri: "zeema://schema" });
    expect(JSON.parse(res.contents[0].text)).toEqual(cat.schema);
  });
});
