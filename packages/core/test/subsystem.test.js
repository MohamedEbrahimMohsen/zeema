// A Zeema design box (kind `subsystem`, component `zeema-design`): a node that stands for another
// design. Its two lines come from nodeLines like any node's, so the canvas, the server render,
// the hover text and describe agree: the label, else the referenced design (its name when the
// canvas knows it, else owner/slug), else the kind's placeholder; over "Zeema design · v3".
// The kind and the component are read from the repository, not from the frozen fixture.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { describeNode } from "../src/describe.js";
import { hasRefDisc, isSubsystem, nodeLines } from "../src/document.js";
import { layout } from "../src/layout.js";
import { toSvg } from "../src/render.js";
import { nodeWidth } from "../src/text.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");
const read = (rel) => YAML.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const fixture = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));
const kind = read("kinds/subsystem.yaml");
const comp = read("components/default/zeema-design.yaml");
const en = read("locales/en.yaml");
const catalogue = {
  ...fixture,
  schema: JSON.parse(fs.readFileSync(path.join(ROOT, "schema", "design.schema.json"), "utf8")),
  kinds: { ...fixture.kinds, [kind.id]: kind },
  components: { ...fixture.components, [comp.id]: comp },
  locale: {
    ...fixture.locale,
    kinds: { ...fixture.locale.kinds, [kind.id]: en.kinds[kind.id] },
    components: { ...fixture.locale.components, [comp.id]: en.components[comp.id] },
  },
};
const NAME = en.components[comp.id].name;
const PLACEHOLDER = en.kinds[kind.id].placeholder;
const app = Object.values(fixture.components).find(
  (c) => c.kind === "app-server" && c.provider === "default",
).id;

const box = (extra = {}) => ({ id: "notifications", component: comp.id, ...extra });
const pinned = { design: "zeema/notification-system", version: 3 };
const design = (node) => ({
  schemaVersion: "1",
  type: "design",
  id: "news-feed",
  nodes: [node],
  edges: [],
});

describe("the subsystem kind", () => {
  it("is the zeema-design component's kind, and only a subsystem box is one", () => {
    expect(kind.properties).toEqual({});
    expect(isSubsystem(catalogue, box())).toBe(true);
    expect(isSubsystem(catalogue, { id: "a", component: app })).toBe(false);
    expect(isSubsystem(null, box())).toBe(false);
  });

  it("carries the link disc with or without a reference; another node only with one", () => {
    expect(hasRefDisc(catalogue, box())).toBe(true);
    expect(hasRefDisc(catalogue, box({ ref: pinned }))).toBe(true);
    expect(hasRefDisc(catalogue, { id: "a", component: app })).toBe(false);
    expect(hasRefDisc(catalogue, { id: "a", component: app, ref: pinned })).toBe(true);
  });
});

describe("nodeLines for a subsystem box", () => {
  it("with no reference: the placeholder over the component's name, marked unset", () => {
    expect(nodeLines(catalogue, box())).toEqual({
      name: PLACEHOLDER,
      sub: NAME,
      id: comp.id,
      unset: true,
    });
  });

  it("pinned: owner/slug over the name and release; the resolved name when given", () => {
    const n = box({ ref: pinned });
    expect(nodeLines(catalogue, n)).toMatchObject({
      name: "zeema/notification-system",
      sub: `${NAME} · v3`,
      unset: false,
    });
    expect(nodeLines(catalogue, n, "Notification System").name).toBe("Notification System");
  });

  it("following head says latest", () => {
    const n = box({ ref: { design: pinned.design, version: "head" } });
    expect(nodeLines(catalogue, n).sub).toBe(`${NAME} · latest`);
  });

  it("a label wins over the design's name and the placeholder", () => {
    expect(nodeLines(catalogue, box({ label: "Notifications" })).name).toBe("Notifications");
    expect(nodeLines(catalogue, box({ label: "Notifications" })).unset).toBe(false);
    expect(
      nodeLines(catalogue, box({ label: "Notifications", ref: pinned }), "Notification System")
        .name,
    ).toBe("Notifications");
  });

  it("another node's lines are what they were, whatever refName says", () => {
    const n = { id: "a", component: app, ref: pinned };
    expect(nodeLines(catalogue, n, "Notification System")).toEqual(nodeLines(catalogue, n));
    expect(nodeLines(catalogue, n).unset).toBeUndefined();
  });
});

describe("describeNode for a subsystem box", () => {
  it("reads as the reference it is", () => {
    expect(describeNode(box({ ref: pinned }), catalogue)).toBe(
      `Node "notifications" is a ${NAME} reference to zeema/notification-system at release 3.`,
    );
    expect(
      describeNode(box({ label: "Notifications", ref: { ...pinned, version: "head" } }), catalogue),
    ).toBe(
      `Node "notifications", labelled "Notifications", is a ${NAME} reference to zeema/notification-system at head.`,
    );
  });

  it("with no design chosen", () => {
    expect(describeNode(box(), catalogue)).toBe(
      `Node "notifications" is a ${NAME} reference with no design chosen.`,
    );
  });

  it("without the catalogue, it is described as any node", () => {
    expect(describeNode(box())).toBe(`Node "notifications" is ${comp.id}.`);
  });
});

describe("the server render of a subsystem box", () => {
  it("unset: the placeholder in the muted italic style, the component name, and the disc", () => {
    const svg = toSvg(design(box()), catalogue);
    expect(svg).toContain(`class="n unset"`);
    expect(svg).toContain(`>${PLACEHOLDER}</text>`);
    expect(svg).toContain(`>${NAME}</text>`);
    expect(svg).toContain('class="ref"');
  });

  it("pinned: owner/slug over the name and release, with the disc and the ref in the title", () => {
    const svg = toSvg(design(box({ ref: pinned })), catalogue);
    expect(svg).not.toContain(`class="n unset"`);
    expect(svg).toContain(">zeema/notification-system</text>");
    expect(svg).toContain(`>${NAME} · v3</text>`);
    expect(svg).toContain("ref: zeema/notification-system@v3");
    expect(svg).toContain('class="ref"');
  });

  it("the layout keeps the second line clear of the disc, reference or not", () => {
    const n = box();
    const l = nodeLines(catalogue, n);
    expect(layout(design(n), catalogue).sizes[n.id][0]).toBe(nodeWidth(l.name, l.sub, true));
  });
});
