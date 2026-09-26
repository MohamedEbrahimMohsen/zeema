import { describe, expect, it } from "vitest";
import type { Row } from "./Palette";
import {
  pushRecent,
  type QuickAction,
  type QuickTarget,
  quickSections,
  RECENT_LIMIT,
  textScore,
} from "./quick-actions";

const noop = () => {};
const action = (id: string, group: QuickAction["group"], label: string, extra = {}) =>
  ({ id, group, label, run: noop, ...extra }) as QuickAction;

const actions: QuickAction[] = [
  action("add-component", "Add", "Add component…", { always: true }),
  action("add-note", "Add", "Add note"),
  action("fit", "View", "Fit", { keywords: "zoom whole design" }),
  action("zoom-100", "View", "100%", { keywords: "zoom actual size" }),
  action("arrange", "Design", "Arrange"),
  action("export-svg", "Design", "Export SVG"),
];

// [id, name, kind, category, provider, haystack, aliases]
const row = (id: string, name: string, kind: string, cat: string, prov: string): Row => [
  id,
  name,
  kind,
  cat,
  prov,
  `${id} ${name} ${kind} ${cat} ${prov}`.toLowerCase(),
  "",
];
const rows: Row[] = [
  row("redis", "Redis", "cache", "data", "default"),
  row("azure-cache-redis", "Azure Cache for Redis", "cache", "data", "azure"),
  row("key-vault", "Key Vault", "secrets", "security", "azure"),
  row("benefit-db", "Benefit DB", "database", "data", "default"),
];
const targets: QuickTarget[] = [
  { type: "node", id: "key-vault", label: "Key Vault" },
  { type: "node", id: "orders-api", label: "Orders API" },
  { type: "group", id: "backend", label: "Backend" },
];

const titles = (q: string, recent: string[] = []) =>
  quickSections({ query: q, actions, rows, targets, recent }).map((s) => s.title);
const first = (q: string) => quickSections({ query: q, actions, rows, targets })[0].entries[0];

describe("textScore", () => {
  it("weighs a prefix over a word start over a substring, and 0 when a word is missing", () => {
    expect(textScore("Fit", ["fit"])).toBeGreaterThan(textScore("Benefit", ["fit"]));
    expect(textScore("Export SVG", ["svg"])).toBeGreaterThan(textScore("Exportsvg", ["svg"]));
    expect(textScore("Arrange", ["zzz"])).toBe(0);
  });
});

describe("quickSections", () => {
  it("lists every command by group on an empty box, with recent ones first", () => {
    expect(titles("")).toEqual(["Add", "View", "Design"]);
    const s = quickSections({
      query: "",
      actions,
      rows,
      targets,
      recent: ["fit", "comp:redis", "goto:node:orders-api", "gone"],
    });
    expect(s[0].title).toBe("Recent");
    expect(s[0].entries.map((e) => e.key)).toEqual(["fit", "comp:redis", "goto:node:orders-api"]);
  });

  it("puts the best match first: a component for its name, a command for its label", () => {
    const redis = first("redis");
    expect(redis.kind).toBe("component");
    expect(redis.kind === "component" && redis.row[0]).toBe("redis");
    const fit = first("fit");
    expect(fit.kind === "action" && fit.action.id).toBe("fit");
  });

  it("adds on Enter when a component and a box of the design are called the same", () => {
    const withRedis = [...targets, { type: "node" as const, id: "cache", label: "Redis" }];
    const s = quickSections({ query: "redis", actions, rows, targets: withRedis });
    expect(s.map((x) => x.title).slice(0, 2)).toEqual(["Components", "Go to"]);
  });

  it("finds the design's own boxes under Go to", () => {
    const s = quickSections({ query: "key vault", actions, rows, targets });
    const goTo = s.find((x) => x.title === "Go to");
    expect(goTo?.entries[0].key).toBe("goto:node:key-vault");
    expect(s.some((x) => x.title === "Components")).toBe(true);
  });

  it("answers to keywords, and keeps Add component… for any text", () => {
    const zoom = quickSections({ query: "zoom", actions, rows, targets });
    expect(zoom[0].title).toBe("View");
    const nothing = quickSections({ query: "qqqq", actions, rows, targets });
    expect(nothing).toEqual([
      { title: "Add", entries: [expect.objectContaining({ key: "add-component" })] },
    ]);
  });

  it("applies the picker's filters to components", () => {
    const s = quickSections({ query: "redis provider:azure", actions, rows, targets });
    const comps = s.find((x) => x.title === "Components");
    expect(comps?.entries.map((e) => e.key)).toEqual(["comp:azure-cache-redis"]);
  });
});

describe("pushRecent", () => {
  it("moves a key to the front once and keeps the newest few", () => {
    expect(pushRecent(["a", "b"], "b")).toEqual(["b", "a"]);
    const many = Array.from({ length: 10 }, (_, i) => `k${i}`);
    expect(pushRecent(many, "new")).toHaveLength(RECENT_LIMIT);
  });
});
