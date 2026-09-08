// Parity test for editor/core/rules.js against the rule evaluator in validate.mjs.
//
//   node .claude/tools/test_rules.mjs
//
// Three independent oracles:
//   A. a byte-for-byte transcription of validate.mjs's evaluator, run in-process;
//   B. `node validate.mjs --design <file>` spawned per design, output parsed;
//   C. hard-pinned expectations (slack-messaging 0, notification-system's exact 9, and the
//      rule ids each design.broken.yaml names in its own header).
// Plus syncChainDepth parity per node and a 60-node sync chain under 100 ms.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const VALIDATOR = path.join(HERE, "validate.mjs");

let failures = 0;
const ok = (cond, what, detail) => {
  if (cond) return true;
  failures++;
  console.log(`FAIL ${what}${detail ? "\n     " + detail : ""}`);
  return false;
};
const eq = (a, b, what) =>
  ok(
    JSON.stringify(a) === JSON.stringify(b),
    what,
    JSON.stringify(a) === JSON.stringify(b)
      ? ""
      : `got      ${JSON.stringify(a)}\n     expected ${JSON.stringify(b)}`,
  );

/* ------------------------------------------------------------------- load the catalogue */

const walk = (dir) =>
  fs.existsSync(path.join(ROOT, dir))
    ? fs
        .readdirSync(path.join(ROOT, dir), { withFileTypes: true })
        .flatMap((d) =>
          d.isDirectory()
            ? walk(`${dir}/${d.name}`)
            : d.name.endsWith(".yaml")
              ? [`${dir}/${d.name}`]
              : [],
        )
    : [];
const loadYaml = (rel) => YAML.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

const kinds = Object.fromEntries(walk("kinds").map((r) => loadYaml(r)).map((d) => [d.id, d]));
const components = Object.fromEntries(
  walk("components").map((r) => loadYaml(r)).map((d) => [d.id, d]),
);
const rules = walk("rules").map((r) => loadYaml(r));
const ruleIds = new Set(rules.map((r) => r.id));

// The editor consumes editor/data/catalogue.json when it exists; another agent generates it.
// Use it when it is present and complete, otherwise the YAML we just read. Either way the
// module under test sees the same {kinds, components, rules}.
let catalogue = { kinds, components, rules };
let catalogueSource = "yaml";
const bundlePath = path.join(ROOT, "editor", "data", "catalogue.json");
if (!process.argv.includes("--yaml") && fs.existsSync(bundlePath)) {
  try {
    const b = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
    if (
      b?.kinds &&
      b?.components &&
      Array.isArray(b?.rules) &&
      Object.keys(b.kinds).length === Object.keys(kinds).length &&
      Object.keys(b.components).length === Object.keys(components).length &&
      b.rules.length === rules.length
    ) {
      catalogue = b;
      catalogueSource = "editor/data/catalogue.json";
    } else {
      catalogueSource = "yaml (bundle present but incomplete)";
    }
  } catch {
    catalogueSource = "yaml (bundle present but unreadable)";
  }
}

/* ------------------------------------------ oracle A: transcription of validate.mjs ---- */
/* Copied from .claude/tools/validate.mjs, unchanged apart from formatting. */

const v_propDefs = (c) => ({ ...kinds[c.kind].properties, ...(c.properties ?? {}) });
const v_effective = (node) => {
  const c = components[node.component];
  const defs = v_propDefs(c);
  const out = {};
  for (const [k, d] of Object.entries(defs)) {
    if (node.props?.[k] !== undefined) out[k] = node.props[k];
    else if (c.defaults?.[k] !== undefined) out[k] = c.defaults[k];
    else if (d.default !== undefined) out[k] = d.default;
  }
  return out;
};
const v_kindOf = (node) => kinds[components[node.component].kind];
const v_ancestry = (doc, node) => {
  const out = [];
  let g = (doc.groups ?? []).find((x) => x.id === node.group);
  while (g) {
    out.push(g);
    g = (doc.groups ?? []).find((x) => x.id === g.parent);
  }
  return out;
};
const v_syncDepth = (doc, id, seen = new Set()) => {
  if (seen.has(id)) return 0;
  seen.add(id);
  let best = 0;
  for (const e of doc.edges)
    if (e.from === id && e.mode === "sync")
      best = Math.max(best, 1 + v_syncDepth(doc, e.to, new Set(seen)));
  return best;
};
const v_cmp = (c, v) =>
  v === undefined ? false : c.eq !== undefined ? v === c.eq : c.gt !== undefined ? v > c.gt : v < c.lt;
const v_get = (o, p) => p.split(".").reduce((a, k) => a?.[k], o);
const v_scalarTest = (p, v) => {
  if (p.exists !== undefined) return (v !== undefined) === p.exists;
  if (p.in) return p.in.includes(v);
  if (p.gt !== undefined) return typeof v === "number" && v > p.gt;
  if (p.lt !== undefined) return typeof v === "number" && v < p.lt;
  return v === p.equals;
};
const v_nodeById = (doc, id) => doc.nodes.find((n) => n.id === id);
const v_matchKind = (w, n) => [].concat(w).includes(v_kindOf(n).id);
const v_matchCat = (w, n) => [].concat(w).includes(v_kindOf(n).category);
const v_evalPred = (p, ctx) => {
  const { doc, node, edge } = ctx;
  if (p.all) return p.all.every((x) => v_evalPred(x, ctx));
  if (p.any) return p.any.some((x) => v_evalPred(x, ctx));
  if (p.not) return !v_evalPred(p.not, ctx);
  if (p.prop) return v_scalarTest(p, v_effective(node)[p.prop]);
  if (p.field) return v_scalarTest(p, edge[p.field]);
  if (p.requirement) return v_scalarTest(p, v_get(doc.requirements ?? {}, p.requirement));
  if (p.nfr) {
    const [k, c] = Object.entries(p.nfr)[0];
    return v_cmp(c, node?.nfr?.[k]);
  }
  if (p.hasEdge) {
    const h = p.hasEdge;
    const n = doc.edges.filter((e) => {
      const dirOk =
        h.direction === "any"
          ? e.from === node.id || e.to === node.id
          : h.direction === "in"
            ? e.to === node.id
            : e.from === node.id;
      if (!dirOk) return false;
      if (h.mode && e.mode !== h.mode) return false;
      if (h.delivery && e.delivery !== h.delivery) return false;
      const peer = v_nodeById(doc, e.from === node.id ? e.to : e.from);
      if (h.peerKind && !v_matchKind(h.peerKind, peer)) return false;
      if (h.peerCategory && !v_matchCat(h.peerCategory, peer)) return false;
      return true;
    }).length;
    return h.count ? v_cmp(h.count, n) : n > 0;
  }
  if (p.hasNode)
    return doc.nodes.some(
      (n) =>
        (!p.hasNode.kind || v_matchKind(p.hasNode.kind, n)) &&
        (!p.hasNode.category || v_matchCat(p.hasNode.category, n)),
    );
  if (p.inGroup) {
    const n = v_ancestry(doc, node).filter((g) => g.kind === p.inGroup.kind).length;
    return p.inGroup.count ? v_cmp(p.inGroup.count, n) : n > 0;
  }
  if (p.syncChainDepth) return v_cmp(p.syncChainDepth, v_syncDepth(doc, node.id));
  if (p.from) return v_evalPred(p.from, { doc, node: v_nodeById(doc, edge.from) });
  if (p.to) return v_evalPred(p.to, { doc, node: v_nodeById(doc, edge.to) });
  if (p.crossesGroup) {
    const gOf = (id) =>
      v_ancestry(doc, v_nodeById(doc, id)).find((g) => g.kind === p.crossesGroup.kind)?.id;
    const a = gOf(edge.from),
      b = gOf(edge.to);
    return a !== b || a === undefined;
  }
  throw new Error("unknown predicate " + JSON.stringify(p));
};
const v_render = (tpl, ctx) =>
  String(tpl ?? "").replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, p) => {
    const v = v_get(ctx, p);
    return v === undefined ? `{{${p}}}` : String(v);
  });
const v_runRules = (doc) => {
  const hits = [];
  for (const r of rules) {
    try {
      if (r.select.node) {
        for (const node of doc.nodes) {
          if (r.select.node.kind && !v_matchKind(r.select.node.kind, node)) continue;
          if (r.select.node.category && !v_matchCat(r.select.node.category, node)) continue;
          if (v_evalPred(r.when, { doc, node }))
            hits.push({
              id: r.id,
              severity: r.severity,
              message: v_render(r.message, { node, design: doc }),
            });
        }
      } else if (r.select.edge) {
        for (const edge of doc.edges) {
          if (r.select.edge.mode && edge.mode !== r.select.edge.mode) continue;
          if (r.select.edge.delivery && edge.delivery !== r.select.edge.delivery) continue;
          if (v_evalPred(r.when, { doc, edge }))
            hits.push({
              id: r.id,
              severity: r.severity,
              message: v_render(r.message, { edge, design: doc }),
            });
        }
      } else if (r.select.design) {
        if (v_evalPred(r.when, { doc }))
          hits.push({ id: r.id, severity: r.severity, message: v_render(r.message, { design: doc }) });
      }
    } catch (e) {
      throw new Error(`rule ${r.id} on ${doc.id}: ${e.message}`);
    }
  }
  return hits;
};

/* ------------------------------------------------------------------ the module under test */

const { runRules, effective, kindOf, syncChainDepths } = await import(
  pathToFileURL(path.join(ROOT, "editor", "core", "rules.js")).href
);

/* --------------------------------------------------------------------------- the designs */

const folders = (tier) => {
  const dir = path.join(ROOT, "designs", tier);
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
    : [];
};
const designFiles = [
  ...folders("reference").flatMap((id) => [
    `designs/reference/${id}/design.yaml`,
    `designs/reference/${id}/design.broken.yaml`,
  ]),
  ...folders("imported").map((id) => `designs/imported/${id}/design.yaml`),
].filter((rel) => fs.existsSync(path.join(ROOT, rel)));

const designs = designFiles.map((rel) => ({
  file: rel,
  raw: fs.readFileSync(path.join(ROOT, rel), "utf8"),
  doc: loadYaml(rel),
}));

// validate.mjs's own header parser for the broken variants
const expectedFor = (file, raw) => {
  if (!file.endsWith(".broken.yaml")) return [];
  const header = raw.split("\n").filter((l) => l.startsWith("#")).join("\n");
  const [tripPart] = header.split(/MUST NOT/i);
  const idx = tripPart.search(/MUST trip/i);
  const seg = idx >= 0 ? tripPart.slice(idx) : "";
  return [
    ...new Set(
      [...seg.matchAll(/([a-z][a-z0-9-]+)/g)].map((m) => m[1]).filter((x) => ruleIds.has(x)),
    ),
  ];
};

const key = (h) => `${h.id} ${h.severity} ${h.message}`;
const triples = (hits) => hits.map(key).sort();

/* ------------------------------------------------------- 1. count and structural sanity */

console.log(`catalogue source: ${catalogueSource}`);
console.log(
  `kinds=${Object.keys(kinds).length} components=${Object.keys(components).length} rules=${rules.length} designs=${designs.length}`,
);
ok(designs.length === 26, "26 design files found", `found ${designs.length}`);
ok(
  rules.filter((r) => r.select.edge).length === 4,
  "4 rules select an edge",
  `${rules.filter((r) => r.select.edge).length}`,
);
ok(
  rules.filter((r) => r.select.design).length === 2,
  "2 rules select the design",
  `${rules.filter((r) => r.select.design).length}`,
);

/* --------------------------------------------- 2. oracle A parity on all 26 designs ---- */

const mine = new Map();
for (const d of designs) {
  const got = runRules(d.doc, catalogue);
  mine.set(d.file, got);
  eq(triples(got), triples(v_runRules(d.doc)), `A parity ${d.file}`);
}

/* --------------------------------------------------------- 3. subject shape and validity */

for (const d of designs) {
  const nodeIds = new Set(d.doc.nodes.map((n) => n.id));
  for (const h of mine.get(d.file)) {
    const s = h.subject;
    const good =
      s &&
      ((s.type === "node" && nodeIds.has(s.ref)) ||
        (s.type === "edge" && Number.isInteger(s.ref) && d.doc.edges[s.ref] !== undefined) ||
        (s.type === "design" && s.ref === null));
    ok(good, `subject valid ${d.file} ${h.id}`, JSON.stringify(s));
  }
}
{
  const bySel = { node: new Set(), edge: new Set(), design: new Set() };
  for (const d of designs) for (const h of mine.get(d.file)) bySel[h.subject.type].add(h.id);
  const edgeRules = rules.filter((r) => r.select.edge).map((r) => r.id);
  const designRules = rules.filter((r) => r.select.design).map((r) => r.id);
  ok(
    [...bySel.edge].every((id) => edgeRules.includes(id)),
    "edge subjects only from edge-selecting rules",
    [...bySel.edge].join(", "),
  );
  ok(
    [...bySel.design].every((id) => designRules.includes(id)),
    "design subjects only from design-selecting rules",
    [...bySel.design].join(", "),
  );
}

/* ------------------------------------------- 4. oracle B: the validator, actually spawned */

const spawnValidator = (rel) => {
  let out;
  try {
    out = execFileSync(process.execPath, [VALIDATOR, "--design", path.join(ROOT, rel)], {
      encoding: "utf8",
      cwd: ROOT,
    });
  } catch (e) {
    out = (e.stdout ?? "") + (e.stderr ?? "");
  }
  const hits = [];
  let sawHeader = false;
  for (const line of out.split(/\r?\n/)) {
    if (line.includes(`${rel}: nodes=`)) sawHeader = true;
    const m = /^ - \[([a-z]+)\] ([a-z][a-z0-9-]*): (.*)$/.exec(line);
    if (m) hits.push({ severity: m[1], id: m[2], message: m[3] });
  }
  return { hits, sawHeader, out };
};

for (const d of designs) {
  const { hits, sawHeader, out } = spawnValidator(d.file);
  if (!ok(sawHeader, `validator ran on ${d.file}`, out.slice(0, 400))) continue;
  eq(triples(hits), triples(mine.get(d.file)), `B parity ${d.file}`);
}

/* --------------------------------------------------------------------- 5. pinned results */

{
  const rel = "designs/reference/slack-messaging/design.yaml";
  eq(mine.get(rel).length, 0, `${rel} fires nothing`);
}
{
  const rel = "designs/imported/notification-system/design.yaml";
  const hits = mine.get(rel);
  eq(hits.length, 9, `${rel} fires exactly 9`);
  const counts = {};
  for (const h of hits) counts[h.id] = (counts[h.id] ?? 0) + 1;
  eq(
    counts,
    {
      "cache-missing-eviction-policy": 1,
      "credentials-without-rotation": 1,
      "datastore-missing-backup": 3,
      "queue-missing-dlq": 4,
    },
    `${rel} per-rule counts`,
  );
  eq(
    triples(hits),
    [
      "cache-missing-eviction-policy warning Cache 'cache' has no eviction policy. Declare lru, lfu or ttl, or justify none explicitly.",
      "credentials-without-rotation warning Design 'notification-system' holds data but declares no credential rotation period and has no key-management node.",
      "datastore-missing-backup error Datastore 'db' has no backup or no retention policy declared.",
      "datastore-missing-backup error Datastore 'notification-log' has no backup or no retention policy declared.",
      "datastore-missing-backup error Datastore 'notification-template' has no backup or no retention policy declared.",
      "queue-missing-dlq error Queue 'android-pn' receives async traffic but has no dead-letter queue.",
      "queue-missing-dlq error Queue 'email-queue' receives async traffic but has no dead-letter queue.",
      "queue-missing-dlq error Queue 'ios-pn' receives async traffic but has no dead-letter queue.",
      "queue-missing-dlq error Queue 'sms-queue' receives async traffic but has no dead-letter queue.",
    ].sort(),
    `${rel} exact messages`,
  );
}
for (const d of designs.filter((x) => x.file.endsWith(".broken.yaml"))) {
  const fired = [...new Set(mine.get(d.file).map((h) => h.id))].sort();
  eq(fired, expectedFor(d.file, d.raw).sort(), `${d.file} fires its header's rule ids`);
}
// every rule is tripped by at least one reference design, as validate.mjs asserts
{
  const refFired = new Set(
    designs
      .filter((d) => d.file.startsWith("designs/reference/"))
      .flatMap((d) => mine.get(d.file).map((h) => h.id)),
  );
  const missing = rules.map((r) => r.id).filter((id) => !refFired.has(id));
  eq(missing, [], "every rule is tripped by some reference design");
}

/* ------------------------------------------------------------ 6. syncChainDepth parity */

let cyclicDesigns = 0;
for (const d of designs) {
  const got = syncChainDepths(d.doc);
  const want = {};
  for (const n of d.doc.nodes) want[n.id] = v_syncDepth(d.doc, n.id);
  eq(got, want, `syncChainDepth parity ${d.file}`);
  // does this design's sync subgraph contain a cycle?
  const succ = new Map();
  for (const e of d.doc.edges)
    if (e.mode === "sync") succ.set(e.from, [...(succ.get(e.from) ?? []), e.to]);
  const colour = new Map();
  let cyclic = false;
  const dfs = (u) => {
    colour.set(u, 1);
    for (const w of succ.get(u) ?? []) {
      if (colour.get(w) === 1) cyclic = true;
      else if (!colour.has(w)) dfs(w);
    }
    colour.set(u, 2);
  };
  for (const n of d.doc.nodes) if (!colour.has(n.id)) dfs(n.id);
  if (cyclic) cyclicDesigns++;
}
ok(cyclicDesigns === 7, "7 designs have a cycle in the sync subgraph", `${cyclicDesigns}`);

/* ------------------------------------------------------- 7. exported helpers behave ---- */

{
  const d = designs.find((x) => x.file === "designs/reference/order-processing/design.broken.yaml");
  const node = d.doc.nodes.find((n) => n.id === "orders-queue");
  // key order follows the catalogue's property order, which differs between the YAML kind
  // files and the generated bundle; compare by name/value, not by insertion order.
  const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  eq(
    sorted(effective(d.doc, node, catalogue)),
    sorted(v_effective(node)),
    "effective parity on orders-queue",
  );
  ok(kindOf(d.doc, node, catalogue)?.id === "queue", "kindOf resolves orders-queue to queue");
  ok(
    kindOf(d.doc, { id: "x", component: "no-such-component" }, catalogue) === null,
    "kindOf returns null for an unknown component",
  );
  eq(effective(d.doc, { id: "x", component: "no-such-component" }, catalogue), {}, "effective of an unknown component is {}");
}

/* --------------------------------------------------- 8. unknown components never throw */

{
  const base = designs.find((x) => x.file === "designs/imported/notification-system/design.yaml");
  const doc = JSON.parse(JSON.stringify(base.doc));
  const before = triples(runRules(doc, catalogue));
  // Rewire the design so an unknown component sits on both ends of a real edge and is the
  // peer of several hasEdge tests.
  doc.nodes.push({ id: "mystery", component: "not-in-the-catalogue", props: { anything: 1 } });
  doc.edges.push({ from: "mystery", to: doc.nodes[0].id, protocol: "http", mode: "sync" });
  doc.edges.push({ from: doc.nodes[0].id, to: "mystery", protocol: "http", mode: "async" });
  let after;
  ok(
    (() => {
      try {
        after = runRules(doc, catalogue);
        return true;
      } catch (e) {
        return `threw ${e.message}`;
      }
    })() === true,
    "runRules survives an unknown component",
  );
  ok(
    after.every((h) => h.subject.type !== "node" || h.subject.ref !== "mystery"),
    "an unknown component is never selected as a node subject",
  );
  eq(triples(after).filter((t) => before.includes(t)).length, before.length, "known findings survive an unknown node");
  // a dangling edge endpoint must not throw either
  const doc2 = JSON.parse(JSON.stringify(base.doc));
  doc2.edges.push({ from: doc2.nodes[0].id, to: "nowhere", protocol: "http", mode: "sync" });
  ok(
    (() => {
      try {
        runRules(doc2, catalogue);
        return true;
      } catch {
        return false;
      }
    })(),
    "runRules survives a dangling edge endpoint",
  );
  // a group parent cycle must not hang
  const doc3 = JSON.parse(JSON.stringify(base.doc));
  doc3.groups = [
    { id: "a", kind: "region", parent: "b" },
    { id: "b", kind: "cell", parent: "a" },
  ];
  doc3.nodes[0].group = "a";
  ok(
    (() => {
      try {
        runRules(doc3, catalogue);
        return true;
      } catch {
        return false;
      }
    })(),
    "runRules survives a group parent cycle",
  );
}

/* ------------------------------------------------------------------ 9. 60-node sync chain */

{
  const N = 60;
  const nodes = [{ id: "api", component: "aws-api-gateway", props: { auth: "jwt", apiType: "http" } }];
  const edges = [];
  for (let i = 1; i < N; i++)
    nodes.push({
      id: `svc-${i}`,
      component: "container-service",
      props: { orchestrator: "kubernetes", instances: 2, runtime: "dotnet-10" },
    });
  for (let i = 0; i < N - 1; i++)
    edges.push({ from: nodes[i].id, to: nodes[i + 1].id, protocol: "http", mode: "sync" });
  const doc = {
    schemaVersion: "1",
    type: "design",
    id: "sync-chain-60",
    requirements: { latency: { p95Ms: 300 } },
    groups: [],
    nodes,
    edges,
  };
  ok(
    nodes.every((n) => components[n.component]),
    "the 60-node chain uses real components",
  );
  const depths = syncChainDepths(doc);
  eq(depths["api"], N - 1, "60-node chain depth at the head");
  eq(depths[`svc-${N - 1}`], 0, "60-node chain depth at the tail");
  runRules(doc, catalogue); // warm
  const t0 = process.hrtime.bigint();
  const hits = runRules(doc, catalogue);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  ok(ms < 100, `60-node sync chain in under 100 ms`, `${ms.toFixed(2)} ms`);
  console.log(`60-node sync chain: ${ms.toFixed(2)} ms, ${hits.length} findings`);
  ok(
    hits.some((h) => h.id === "sync-chain-too-deep" && h.subject.ref === "api"),
    "the 60-node chain trips sync-chain-too-deep on the head",
  );
}

/* ------------------------------------------------------------------------------ verdict */

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall rule-parity checks passed");
process.exit(failures ? 1 : 0);
