// What a canvas menu holds, as data: the design menu under the title, the zoom menu and the
// right-click menus all hand ContextMenu a tree of these. The design menu's tree is built here,
// pure, from what the canvas can do right now and the commands it shares with quick actions, so
// its grouping, order and disabled states are tested without a page.

export type MenuModel =
  | {
      kind: "item";
      label: string;
      /** Muted words under the label that add something the label does not say. */
      hint?: string;
      /** The keys, shown right-aligned ("Ctrl S"). */
      shortcut?: string;
      disabled?: boolean;
      danger?: boolean;
      run: () => void;
    }
  | {
      kind: "switch";
      label: string;
      hint?: string;
      shortcut?: string;
      /** The hint says how an unset choice decides ("auto"): it goes once the row is clicked. */
      hintUntilSet?: boolean;
      disabled?: boolean;
      checked: boolean;
      onChange: (on: boolean) => void;
    }
  | {
      kind: "submenu";
      label: string;
      hint?: string;
      disabled?: boolean;
      items: MenuEntry[];
    }
  | { kind: "separator" };

/** A null entry is something that does not apply here: it is dropped before drawing. */
export type MenuEntry = MenuModel | null;

export const SEP: MenuModel = { kind: "separator" };

/**
 * The entries to draw: nulls gone, and no separator at either end or next to another, so a
 * group that came out empty leaves no stray line.
 */
export function tidy(entries: MenuEntry[]): MenuModel[] {
  const out: MenuModel[] = [];
  for (const e of entries) {
    if (!e) continue;
    if (e.kind === "separator" && (!out.length || out[out.length - 1].kind === "separator"))
      continue;
    out.push(e);
  }
  while (out.length && out[out.length - 1].kind === "separator") out.pop();
  return out;
}

type Rect = { left: number; top: number; right: number; bottom: number };
type Size = { width: number; height: number };

/**
 * Where a submenu's flyout goes: to the right of its row, overlapping the parent panel by
 * `overlap` so the pointer crosses no gap, or to the left when that would leave the viewport.
 * Its first item lines up with the row; it is clamped to stay `margin` inside the viewport.
 */
export function flyoutPosition(
  row: Rect,
  menu: Size,
  viewport: Size,
  { margin = 8, overlap = 2, pad = 4 } = {},
): { left: number; top: number; side: "right" | "left" } {
  let side: "right" | "left" = "right";
  let left = row.right - overlap;
  if (left + menu.width > viewport.width - margin) {
    const flipped = row.left - menu.width + overlap;
    // Neither side fits: the side with more room, clamped.
    if (flipped >= margin || row.left > viewport.width - row.right) {
      side = "left";
      left = flipped;
    }
  }
  left = Math.max(margin, Math.min(left, viewport.width - menu.width - margin));
  const top = Math.max(margin, Math.min(row.top - pad, viewport.height - menu.height - margin));
  return { left, top, side };
}

export type DownloadWhat = "yaml" | "layout" | "zip";
export type ExportWhat = "svg" | "png" | "mermaid";

/** What the design menu needs: what may be done here, what is on, and the commands to run. */
export type DesignMenuInput = {
  canWrite: boolean;
  canDelete: boolean;
  /** The draft differs from what readers see. */
  unpublished: boolean;
  /** Structural findings: nothing may be saved or published. */
  blocking: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Something is selected (Copy, Duplicate selection). */
  hasSelection: boolean;
  /** The design has anything to select (Select all). */
  hasContent: boolean;
  canPaste: boolean;
  /** "Ctrl" or "⌘". */
  mod: string;
  /** Duplicate, Clone to edit or Sign in to clone, by who is looking. */
  clone: { label: string; hint?: string };
  view: {
    pinPicker: boolean;
    inspectorAway: boolean;
    pinDesign: boolean;
    dimEdges: boolean;
    /** Shown under Dim edges while it follows the design ("past 15 edges"). */
    dimEdgesHint?: string;
    hoverCards: boolean;
  };
  run: {
    quick: () => void;
    rename: () => void;
    settings: () => void;
    save: () => void;
    publish: () => void;
    releases: () => void;
    copyLink: () => void;
    clone: () => void;
    export: (what: ExportWhat) => void;
    download: (what: DownloadWhat) => void;
    importLayout: (mode: "merge" | "replace") => void;
    undo: () => void;
    redo: () => void;
    selectAll: () => void;
    copy: () => void;
    paste: () => void;
    duplicate: () => void;
    help: () => void;
    delete: () => void;
    pinPicker: (on: boolean) => void;
    inspectorAway: (on: boolean) => void;
    pinDesign: (on: boolean) => void;
    dimEdges: (on: boolean) => void;
    hoverCards: (on: boolean) => void;
  };
};

const item = (
  label: string,
  run: () => void,
  more: Partial<Omit<Extract<MenuModel, { kind: "item" }>, "kind" | "label" | "run">> = {},
): MenuModel => ({ kind: "item", label, run, ...more });

const sub = (label: string, items: MenuEntry[]): MenuModel => ({
  kind: "submenu",
  label,
  items: tidy(items),
});

/** The design menu, the chevron beside the title: eight groups, the long lists one level down. */
export function designMenu(m: DesignMenuInput): MenuModel[] {
  const { run, view, mod: k } = m;
  return tidy([
    item("Quick actions", run.quick, { shortcut: `${k} K` }),
    SEP,
    m.canWrite ? item("Rename", run.rename) : null,
    item("Design settings", run.settings, { hint: "id, requirements" }),
    m.canWrite ? item("Save", run.save, { shortcut: `${k} S`, disabled: m.blocking }) : null,
    SEP,
    sub("Publish", [
      m.canWrite
        ? item(m.unpublished ? "Publish" : "Published", run.publish, {
            hint: m.unpublished ? "release the draft" : "readers see this",
            disabled: m.blocking || !m.unpublished,
          })
        : null,
      item("Releases", run.releases, { hint: "design page" }),
      item("Copy link", run.copyLink),
    ]),
    item(m.clone.label, run.clone, { hint: m.clone.hint }),
    SEP,
    sub("Export", [
      item("SVG", () => run.export("svg")),
      item("PNG", () => run.export("png")),
      item("Mermaid", () => run.export("mermaid"), { hint: "flowchart text" }),
    ]),
    sub("Download", [
      item("YAML", () => run.download("yaml"), { hint: "design.yaml" }),
      item("Layout (JSON)", () => run.download("layout"), { hint: "positions, notes" }),
      item("Both (.zip)", () => run.download("zip"), { hint: "re-importable" }),
    ]),
    sub("Import", [
      item("Layout (JSON, merge)", () => run.importLayout("merge")),
      item("Layout (replace)", () => run.importLayout("replace"), {
        hint: "the whole layout",
      }),
    ]),
    SEP,
    sub("Edit", [
      item("Undo", run.undo, { shortcut: `${k} Z`, disabled: !m.canUndo }),
      item("Redo", run.redo, { shortcut: `${k} Y`, disabled: !m.canRedo }),
      SEP,
      item("Select all", run.selectAll, { shortcut: `${k} A`, disabled: !m.hasContent }),
      item("Copy", run.copy, { shortcut: `${k} C`, disabled: !m.hasSelection }),
      item("Paste", run.paste, { shortcut: `${k} V`, disabled: !m.canPaste }),
      item("Duplicate selection", run.duplicate, {
        shortcut: `${k} D`,
        disabled: !m.hasSelection,
      }),
    ]),
    SEP,
    sub("View", [
      {
        kind: "switch",
        label: "Pin the picker",
        shortcut: `${k} Shift K`,
        checked: view.pinPicker,
        onChange: run.pinPicker,
      },
      {
        kind: "switch",
        label: "Keep the inspector away",
        shortcut: `${k} Shift P`,
        checked: view.inspectorAway,
        onChange: run.inspectorAway,
      },
      {
        kind: "switch",
        label: "Pin design settings",
        shortcut: "\\ or D",
        checked: view.pinDesign,
        onChange: run.pinDesign,
      },
      {
        kind: "switch",
        label: "Dim edges",
        hint: view.dimEdgesHint,
        hintUntilSet: true,
        checked: view.dimEdges,
        onChange: run.dimEdges,
      },
      {
        kind: "switch",
        label: "Hover cards",
        shortcut: "Shift H",
        checked: view.hoverCards,
        onChange: run.hoverCards,
      },
    ]),
    SEP,
    item("Keys & gestures", run.help, { shortcut: "?" }),
    SEP,
    m.canDelete ? item("Delete design", run.delete, { danger: true }) : null,
  ]);
}
