// The catalogue gate as a test, plus the bundle's two properties: deterministic and complete.
import fs from "node:fs";
import path from "node:path";
import { COUNT_PROPS } from "@zeema/core/document";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { renderBundle } from "../src/build.js";
import {
  boundaryIconIds,
  designIndex,
  loadCatalogue,
  PROVIDER_MARK_BOX,
  providerFolderIds,
  searchRows,
} from "../src/index.js";
import { aliasFindings, validateRepository } from "../src/validate.js";

describe("repository gate", () => {
  it("passes on the committed repository", () => {
    const lines = [];
    const { ok, problems } = validateRepository(undefined, { log: (l) => lines.push(l) });
    expect(problems).toEqual([]);
    expect(ok).toBe(true);
    expect(lines.some((l) => l.includes("kinds="))).toBe(true);
  }, 120_000);
});

describe("bundle", () => {
  it("is deterministic and complete", () => {
    const a = renderBundle();
    const b = renderBundle();
    expect(a.missing).toEqual([]);
    for (const name of Object.keys(a.texts)) expect(b.texts[name]).toBe(a.texts[name]);
    const cat = JSON.parse(a.texts["catalogue.json"]);
    const live = loadCatalogue();
    expect(Object.keys(cat.kinds).length).toBe(Object.keys(live.kinds).length);
    expect(Object.keys(cat.components).length).toBe(Object.keys(live.components).length);
    expect(cat.rules.length).toBe(live.rules.length);
    const icons = JSON.parse(a.texts["icons.json"]);
    for (const id of Object.keys(cat.components)) expect(icons[id], id).toBeTypeOf("string");
    for (const id of Object.keys(cat.kinds)) expect(icons[`kind:${id}`], id).toBeTypeOf("string");
  }, 120_000);

  it("carries a cropped brand mark under provider:<id> for every provider folder but default", () => {
    const root = loadCatalogue().root;
    expect(Object.keys(PROVIDER_MARK_BOX).sort()).toEqual(
      providerFolderIds(root).filter((id) => id !== "default"),
    );
    const icons = JSON.parse(renderBundle().texts["icons.json"]);
    const want = providerFolderIds(root)
      .filter((id) => id !== "default")
      .map((id) => `provider:${id}`);
    expect(want.length).toBeGreaterThan(0);
    expect(
      Object.keys(icons)
        .filter((k) => k.startsWith("provider:"))
        .sort(),
    ).toEqual(want);
    for (const key of want) {
      expect(icons[key], key).toMatch(
        /^<svg viewBox="[-\d. ]+" width="24" height="24"><g fill="#[0-9a-fA-F]{3,8}">/,
      );
      expect(icons[key], key).not.toMatch(/<title>/);
    }
  }, 120_000);

  it("carries every boundary icon on disk under boundary:<id>, named in the locale", () => {
    const root = loadCatalogue().root;
    const onDisk = fs
      .readdirSync(path.join(root, "icons", "boundaries"))
      .filter((f) => f.endsWith(".svg"))
      .map((f) => f.slice(0, -4))
      .sort();
    expect(onDisk.length).toBeGreaterThan(0);
    expect(boundaryIconIds(root)).toEqual(onDisk);
    const { texts } = renderBundle();
    const icons = JSON.parse(texts["icons.json"]);
    const cat = JSON.parse(texts["catalogue.json"]);
    expect(
      Object.keys(icons)
        .filter((k) => k.startsWith("boundary:"))
        .sort(),
    ).toEqual(onDisk.map((id) => `boundary:${id}`));
    for (const id of onDisk) {
      expect(icons[`boundary:${id}`], id).toMatch(/^<g /);
      expect(cat.locale.boundaryIcons[id]?.name, id).toBeTruthy();
    }
    expect(Object.keys(cat.locale.boundaryIcons).sort()).toEqual(onDisk);
  }, 120_000);

  it("names every group kind the design schema allows, and nothing else", () => {
    const cat = loadCatalogue();
    const kinds = cat.schema.properties.groups.items.properties.kind.enum;
    for (const id of kinds) expect(cat.locale.groupKinds[id]?.name, id).toBeTruthy();
    expect(Object.keys(cat.locale.groupKinds).sort()).toEqual([...kinds].sort());
  }, 120_000);

  it("indexes every design on disk with its tier and writability", () => {
    const index = designIndex(loadCatalogue().root);
    expect(index.length).toBeGreaterThan(20);
    for (const e of index) {
      expect(e.path).toMatch(
        /^designs\/(reference|imported|authored)\/[a-z0-9-]+\/design(\.broken)?\.yaml$/,
      );
      expect(e.editable).toBe(e.tier === "authored" && !e.broken);
    }
  });
});

describe("aliases", () => {
  const cat = loadCatalogue();
  const valid = () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const read = (n) => JSON.parse(fs.readFileSync(path.join(cat.root, "schema", n), "utf8"));
    // The component schema points at the kind schema for a property definition, so the gate
    // registers that one first; do the same here rather than compiling half a schema.
    ajv.addSchema(read("kind.schema.json"), "kind.schema.json");
    return ajv.compile(read("component.schema.json"));
  };
  const doc = (aliases) => ({
    schemaVersion: "1",
    type: "component",
    id: "thing",
    kind: "queue",
    provider: "aws",
    aliases,
  });

  it("accepts one to eight unique names of one to forty characters", () => {
    const check = valid();
    expect(check(doc(["DCR"]))).toBe(true);
    expect(check(doc(["S3", "Simple Storage Service"]))).toBe(true);
    expect(check(doc(Array.from({ length: 8 }, (_, i) => `a${i}`)))).toBe(true);
  });

  it("refuses an empty list, nine names, a duplicate, an empty string and a long one", () => {
    const check = valid();
    expect(check(doc([]))).toBe(false);
    expect(check(doc(Array.from({ length: 9 }, (_, i) => `a${i}`)))).toBe(false);
    expect(check(doc(["DCR", "DCR"]))).toBe(false);
    expect(check(doc([""]))).toBe(false);
    expect(check(doc(["x".repeat(41)]))).toBe(false);
  });

  it("refuses two aliases that differ only in case", () => {
    const { problems, warnings } = aliasFindings({
      a: { id: "a", provider: "aws", aliases: ["DCR", "dcr"] },
    });
    expect(problems).toEqual(["component a: duplicate alias dcr"]);
    expect(warnings).toEqual([]);
  });

  it("warns, without failing, when an alias is another component's id or alias", () => {
    const sameProvider = aliasFindings({
      a: { id: "a", provider: "aws", aliases: ["DCR"] },
      b: { id: "b", provider: "aws", aliases: ["dcr"] },
      c: { id: "c", provider: "aws" },
      dcr: { id: "dcr", provider: "aws" },
    });
    expect(sameProvider.problems).toEqual([]);
    expect(sameProvider.warnings.length).toBe(2);
    expect(sameProvider.warnings[0]).toContain('alias "dcr" is also');
    // A different provider is a different namespace, so the same abbreviation is silent.
    const across = aliasFindings({
      a: { id: "a", provider: "aws", aliases: ["ASG"] },
      b: { id: "b", provider: "azure", aliases: ["ASG"] },
    });
    expect(across).toEqual({ problems: [], warnings: [] });
  });

  it("puts the aliases in the search row, lower-cased", () => {
    const rows = searchRows(cat);
    const dcr = rows.find((r) => r[0] === "azure-monitor-data-collection-rule");
    expect(dcr[5]).toContain("dcr");
    expect(dcr[6]).toBe("dcr");
    const plain = rows.find((r) => r[0] === "custom");
    expect(plain[6]).toBe("");
  });

  it("gives every alias in the catalogue a non-empty, unique name per component", () => {
    let count = 0;
    for (const c of Object.values(cat.components)) {
      if (!c.aliases) continue;
      count += c.aliases.length;
      const keys = c.aliases.map((a) => a.toLowerCase());
      for (const a of c.aliases) {
        expect(a.trim(), c.id).not.toBe("");
        expect(a.length, c.id).toBeLessThanOrEqual(40);
      }
      expect(new Set(keys).size, c.id).toBe(keys.length);
      expect(keys, c.id).not.toContain(c.id.toLowerCase());
      expect(c.aliases.length, c.id).toBeLessThanOrEqual(8);
    }
    expect(count).toBeGreaterThan(100);
  });
});

describe("group kinds", () => {
  it("are one list: the rule predicates allow exactly the design schema's boundary kinds", () => {
    const root = loadCatalogue().root;
    const read = (n) => JSON.parse(fs.readFileSync(path.join(root, "schema", n), "utf8"));
    const design = read("design.schema.json").properties.groups.items.properties.kind.enum;
    const found = [];
    const walk = (v) => {
      if (!v || typeof v !== "object") return;
      for (const [k, sub] of Object.entries(v)) {
        if ((k === "inGroup" || k === "crossesGroup") && sub?.properties?.kind?.enum)
          found.push([k, sub.properties.kind.enum]);
        walk(sub);
      }
    };
    walk(read("rule.schema.json"));
    expect(found.map(([k]) => k).sort()).toEqual(["crossesGroup", "inGroup"]);
    for (const [k, kinds] of found) expect(kinds, k).toEqual(design);
    expect(design).toContain("namespace");
  });
});

describe("count properties", () => {
  // instances, replicas and shards draw a node as a stack (nodeCount in core/document.js): each
  // must be an integer with no default, or every node of the kind would be drawn as a stack.
  it("are integers with no default wherever a kind defines one", () => {
    const live = loadCatalogue();
    let seen = 0;
    for (const [id, kind] of Object.entries(live.kinds))
      for (const prop of COUNT_PROPS) {
        const def = kind.properties?.[prop];
        if (!def) continue;
        seen += 1;
        expect(def.type, `${id}.${prop}`).toBe("integer");
        expect(def.default, `${id}.${prop}`).toBeUndefined();
      }
    expect(seen).toBeGreaterThan(0);
  });
});
