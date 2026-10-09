// Component search over the real catalogue: synonyms, the kind name in the haystack, and ranking.
import { alternatives, SYNONYMS, scoreRow } from "@zeema/core/search";
import { describe, expect, it } from "vitest";
import { loadCatalogue, searchRows } from "../src/index.js";

const cat = loadCatalogue();
const rows = searchRows(cat);
const hits = (q) => {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return rows
    .map((r) => [scoreRow(r, words), r])
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([s, r]) => ({ id: r[0], score: s }));
};
const ids = (q) => hits(q).map((h) => h.id);
const ofKind = (kind) => Object.values(cat.components).filter((c) => c.kind === kind);

describe("search synonyms", () => {
  it("expands a word into itself first, then its synonyms", () => {
    expect(alternatives("DB")).toEqual(["db", "database"]);
    expect(alternatives("postgres")).toEqual(["postgres"]);
    for (const [w, alts] of Object.entries(SYNONYMS)) {
      expect(w).toBe(w.toLowerCase());
      for (const a of alts) expect(a).toBe(a.toLowerCase());
    }
  });

  it('"db" finds the managed SQL and NoSQL databases', () => {
    const found = ids("db");
    for (const id of ["azure-sql", "azure-cosmos-db", "aws-rds", "dynamodb", "google-cloud-sql"])
      expect(found, id).toContain(id);
  });

  it('"db" and "database" find every SQL and NoSQL database component', () => {
    const db = new Set(ids("db"));
    const database = new Set(ids("database"));
    for (const c of [...ofKind("sql-database"), ...ofKind("nosql-database")]) {
      expect(db.has(c.id), c.id).toBe(true);
      expect(database.has(c.id), c.id).toBe(true);
    }
  });

  it('"vm" finds the virtual machines of each cloud', () => {
    const found = ids("vm");
    for (const id of ["azure-virtual-machine", "aws-ec2", "google-compute-engine"])
      expect(found, id).toContain(id);
  });

  it('"k8s" finds Kubernetes and "lb" finds load balancers', () => {
    expect(ids("k8s").some((id) => id.includes("kubernetes") || id === "aws-eks")).toBe(true);
    const lb = new Set(ids("lb"));
    for (const c of ofKind("load-balancer")) expect(lb.has(c.id), c.id).toBe(true);
  });

  it("ranks a name hit above a description-only hit", () => {
    const h = hits("database");
    const named = h.find((x) => x.id === "azure-sql"); // "Azure SQL Database"
    const kindOnly = h.find((x) => x.id === "aws-ec2");
    expect(named).toBeDefined();
    expect(kindOnly).toBeUndefined();
    // A row that holds the word only in its description or kind name scores 1 for it.
    const descOnly = h.filter((x) => {
      const r = rows.find((row) => row[0] === x.id);
      const n = ` ${r[1].toLowerCase()}`;
      const inName = n.includes(" database") || n.includes(" db") || /db|database/.test(r[0]);
      return !inName && !r[6].includes("database") && !r[6].includes("db");
    });
    expect(descOnly.length).toBeGreaterThan(0);
    for (const d of descOnly) expect(named.score, d.id).toBeGreaterThan(d.score);
  });

  it("an unknown word still has to appear: synonyms widen, never invent", () => {
    expect(ids("zzqqxx")).toEqual([]);
    // Every word must hit: a synonym for one word does not excuse a missing second word.
    expect(ids("db zzqqxx")).toEqual([]);
  });
});

describe("the Zeema design component", () => {
  // Searching for "reference" or "external" must reach the box that places another design: the
  // feature hung on an arbitrary component until it had one of its own.
  it('"reference", "subsystem" and "external design" find zeema-design first', () => {
    for (const q of ["reference", "subsystem", "external design", "zeema design"])
      expect(ids(q)[0], q).toBe("zeema-design");
    expect(ids("external").slice(0, 5)).toContain("zeema-design");
  });
});
