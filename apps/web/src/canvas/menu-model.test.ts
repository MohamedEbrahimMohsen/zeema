import { describe, expect, it, vi } from "vitest";
import {
  type DesignMenuInput,
  designMenu,
  flyoutPosition,
  type MenuModel,
  SEP,
  tidy,
} from "./menu-model";

const noop = () => {};

function input(over: Partial<DesignMenuInput> = {}): DesignMenuInput {
  const run = new Proxy({} as DesignMenuInput["run"], { get: () => noop });
  return {
    canWrite: true,
    canDelete: true,
    unpublished: true,
    blocking: false,
    canUndo: true,
    canRedo: true,
    hasSelection: true,
    hasContent: true,
    canPaste: true,
    mod: "Ctrl",
    clone: { label: "Duplicate", hint: "a private copy" },
    view: {
      pinPicker: false,
      inspectorAway: false,
      pinDesign: false,
      dimEdges: false,
      dimEdgesHint: "past 15 edges",
      hoverCards: true,
    },
    run,
    ...over,
  };
}

// The top level as one line per group: labels, a submenu marked with ▸, groups split by "|".
const outline = (items: MenuModel[]) =>
  items
    .map((m) => (m.kind === "separator" ? "|" : m.kind === "submenu" ? `${m.label}▸` : m.label))
    .join(" ");

const subOf = (items: MenuModel[], label: string) => {
  const s = items.find((m) => m.kind === "submenu" && m.label === label);
  if (s?.kind !== "submenu") throw new Error(`no submenu ${label}`);
  return s.items as MenuModel[];
};
const find = (items: MenuModel[], label: string) => {
  const m = items.find((x) => x.kind !== "separator" && x.label === label);
  if (!m) throw new Error(`no item ${label}`);
  return m as Exclude<MenuModel, { kind: "separator" }>;
};

describe("designMenu", () => {
  it("groups the top level in the agreed order", () => {
    expect(outline(designMenu(input()))).toBe(
      [
        "Quick actions",
        "| Rename Design settings Save",
        "| Publish▸ Duplicate",
        "| Export▸ Download▸ Import▸",
        "| Edit▸",
        "| View▸",
        "| Keys & gestures",
        "| Delete design",
      ].join(" "),
    );
  });

  it("puts the long lists one level down", () => {
    const top = designMenu(input());
    const labels = (name: string) =>
      subOf(top, name).map((m) => (m.kind === "separator" ? "|" : m.label));
    expect(labels("Publish")).toEqual(["Publish", "Releases", "Copy link"]);
    expect(labels("Export")).toEqual(["SVG", "PNG", "Mermaid"]);
    expect(labels("Download")).toEqual(["YAML", "Layout (JSON)", "Both (.zip)"]);
    expect(labels("Import")).toEqual(["Layout (JSON, merge)", "Layout (replace)"]);
    expect(labels("Edit")).toEqual([
      "Undo",
      "Redo",
      "|",
      "Select all",
      "Copy",
      "Paste",
      "Duplicate selection",
    ]);
    expect(labels("View")).toEqual([
      "Pin the picker",
      "Keep the inspector away",
      "Pin design settings",
      "Dim edges",
      "Hover cards",
    ]);
    expect(subOf(top, "View").every((m) => m.kind === "switch")).toBe(true);
    expect(find(top, "Delete design")).toMatchObject({ danger: true });
  });

  it("leaves out what a reader cannot do, and no stray separators", () => {
    const top = designMenu(
      input({ canWrite: false, canDelete: false, clone: { label: "Clone to edit" } }),
    );
    expect(outline(top)).toBe(
      "Quick actions | Design settings | Publish▸ Clone to edit | Export▸ Download▸ Import▸ | Edit▸ | View▸ | Keys & gestures",
    );
    expect(subOf(top, "Publish").map((m) => (m as { label: string }).label)).toEqual([
      "Releases",
      "Copy link",
    ]);
  });

  it("disables Undo and Redo with nothing on their stacks", () => {
    const edit = subOf(designMenu(input({ canUndo: false, canRedo: true })), "Edit");
    expect(find(edit, "Undo").disabled).toBe(true);
    expect(find(edit, "Redo").disabled).toBe(false);
    const edit2 = subOf(designMenu(input({ canUndo: true, canRedo: false })), "Edit");
    expect(find(edit2, "Undo").disabled).toBe(false);
    expect(find(edit2, "Redo").disabled).toBe(true);
  });

  it("disables Copy and Duplicate selection with nothing selected", () => {
    const edit = subOf(designMenu(input({ hasSelection: false })), "Edit");
    expect(find(edit, "Copy").disabled).toBe(true);
    expect(find(edit, "Duplicate selection").disabled).toBe(true);
    expect(find(edit, "Select all").disabled).toBe(false);
    expect(find(edit, "Paste").disabled).toBe(false);
    const empty = subOf(designMenu(input({ hasContent: false, canPaste: false })), "Edit");
    expect(find(empty, "Select all").disabled).toBe(true);
    expect(find(empty, "Paste").disabled).toBe(true);
  });

  it("disables Save and Publish while structural findings block, and Publish with no draft", () => {
    const blocked = designMenu(input({ blocking: true }));
    expect(find(blocked, "Save").disabled).toBe(true);
    expect(find(subOf(blocked, "Publish"), "Publish").disabled).toBe(true);
    const clean = designMenu(input({ unpublished: false }));
    expect(find(subOf(clean, "Publish"), "Published").disabled).toBe(true);
  });

  it("shows the switches as they are and runs the shared commands", () => {
    const pinPicker = vi.fn();
    const exp = vi.fn();
    const base = input();
    const top = designMenu(
      input({
        view: { ...base.view, pinPicker: true, inspectorAway: true },
        run: { ...base.run, pinPicker, export: exp, quick: noop } as DesignMenuInput["run"],
      }),
    );
    const view = subOf(top, "View");
    const pin = find(view, "Pin the picker");
    expect(pin.kind === "switch" && pin.checked).toBe(true);
    expect(find(view, "Keep the inspector away")).toMatchObject({ checked: true });
    if (pin.kind === "switch") pin.onChange(false);
    expect(pinPicker).toHaveBeenCalledWith(false);
    const mermaid = find(subOf(top, "Export"), "Mermaid");
    if (mermaid.kind === "item") mermaid.run();
    expect(exp).toHaveBeenCalledWith("mermaid");
    expect(find(top, "Quick actions")).toMatchObject({ shortcut: "Ctrl K" });
  });
});

describe("tidy", () => {
  it("drops nulls and separators at the ends or doubled", () => {
    const a: MenuModel = { kind: "item", label: "A", run: noop };
    expect(tidy([SEP, null, a, SEP, null, SEP, a, SEP])).toEqual([a, SEP, a]);
  });
});

describe("flyoutPosition", () => {
  const vp = { width: 1000, height: 800 };
  const menu = { width: 200, height: 150 };
  const row = (left: number, right: number, top: number) => ({
    left,
    right,
    top,
    bottom: top + 28,
  });

  it("opens to the right of the row, its first item level with the row", () => {
    expect(flyoutPosition(row(100, 300, 200), menu, vp)).toEqual({
      left: 298,
      top: 196,
      side: "right",
    });
  });

  it("flips left when the right side would overflow", () => {
    expect(flyoutPosition(row(700, 900, 200), menu, vp)).toEqual({
      left: 502,
      top: 196,
      side: "left",
    });
  });

  it("clamps into the viewport vertically", () => {
    expect(flyoutPosition(row(100, 300, 750), menu, vp).top).toBe(800 - 150 - 8);
    expect(flyoutPosition(row(100, 300, 0), menu, vp).top).toBe(8);
  });

  it("with no room either side, takes the roomier side and stays on screen", () => {
    const narrow = { width: 400, height: 800 };
    const p = flyoutPosition(row(150, 330, 100), { width: 250, height: 100 }, narrow);
    expect(p.side).toBe("left");
    expect(p.left).toBe(8);
    const q = flyoutPosition(row(20, 100, 100), { width: 350, height: 100 }, narrow);
    expect(q.side).toBe("right");
    expect(q.left).toBe(400 - 350 - 8);
  });
});
