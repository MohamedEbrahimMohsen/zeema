"use client";

// Every control here is generated from the catalogue and the design schema; nothing about a
// product is hard coded. A control shows the value the design resolves to and writes only when
// the user sets something. Text inputs commit on blur or Enter, never per keystroke.
import { effective, propDefs } from "@zeema/core/document";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { BOUNDARY_PREVIEW, boundaryRows } from "@/lib/boundary-icons";
import {
  anchorTarget,
  type FrameStyle,
  frameIconKey,
  type HexTint,
  isHexTint,
  type Note,
  normaliseTint,
  TINTS,
  type Tint,
} from "@/lib/layout-sidecar";
import { own } from "@/lib/own";
import { PALETTE, PALETTE_COLUMNS, pushRecent, readRecent } from "@/lib/tint-palette";
import { parseQuery, type Row, score } from "./Palette";
import type { Subject } from "./scene";

export type InspectorApi = {
  setField: (id: string, field: string, value: string) => void;
  setProp: (id: string, prop: string, value: unknown) => void;
  setNfr: (id: string, field: string, value: unknown) => void;
  setGroup: (id: string, group: string | null) => void;
  rename: (oldId: string, typed: string) => void;
  swap: (id: string, componentId: string) => void;
  setEdge: (index: number, field: string, value: unknown) => void;
  setGroupField: (id: string, field: string, value: unknown) => void;
  renameGroup: (oldId: string, newId: string) => void;
  setParent: (id: string, parent: string | null) => void;
  /** Boundary tint and icon. Sidecar only; `undefined` clears that half. */
  setFrameStyle: (id: string, patch: { tint?: Tint | HexTint; icon?: string }) => void;
  setDesignId: (id: string) => void;
  setRequirement: (path: string, value: unknown) => void;
  setNoteText: (id: string, text: string) => void;
  /** Point the palette at a query, the way the boundary hint does. */
  findInPalette: (query: string) => void;
  detachNote: (id: string) => void;
  remove: (type: "node" | "edge" | "group" | "note", ref: string | number) => void;
};

/**
 * What a clicked finding asks the reader to look at: the fields its rule reads, straight from
 * `ruleReads` in @zeema/core/describe. `fields` are node properties and edge fields by name,
 * `requirements` are design requirement paths like `security.credentialRotationDays`, and
 * `nodeKinds`/`nodeCategories` are what the rule also hunts for in the design.
 */
export type Highlight = {
  fields: string[];
  requirements: string[];
  nodeKinds: string[];
  nodeCategories: string[];
} | null;

const label = (name: string) =>
  name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function Field({
  name,
  note,
  isSet,
  hl,
  path,
  children,
}: {
  name: string;
  note?: string | null;
  isSet?: boolean;
  /** A finding is about this field: it keeps an accent bar until the finding is dismissed. */
  hl?: boolean;
  /** What the field is called to a rule, when that is not its display name. */
  path?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`field${isSet ? " set" : ""}${hl ? " hl" : ""}`} data-field={path ?? name}>
      <div className="field-name">{label(name)}</div>
      {children}
      {note ? <div className="resolved">{note}</div> : null}
    </div>
  );
}

function TextInput({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      defaultValue={value}
      placeholder={placeholder}
      onBlur={(e) => {
        if (e.target.value !== value) onCommit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          (e.target as HTMLInputElement).value = value;
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

/**
 * A boundary's colour: "none", a swatch per named tint, and a "More colours" swatch that opens
 * a popover with a fixed palette, the colours applied lately and a hex row. A named swatch and
 * a palette cell apply on click. The popover lives inside the field, so the Inspector's scroll
 * carries it; it closes on Escape, on a click outside it, on a pick and when another boundary
 * is selected (the field is keyed by the boundary).
 */
/**
 * Every commit remounts the Inspector (Canvas keys it by the undo tick), so a colour applied
 * from the popover takes the popover and its trigger with it. This asks the next "More colours"
 * trigger to take focus when it mounts, which is where focus would have returned.
 */
let refocusMoreColours = false;

function TintField({
  tint,
  onPick,
}: {
  tint: Tint | HexTint | undefined;
  onPick: (t: Tint | HexTint | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const hex = isHexTint(tint) ? tint : null;
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!refocusMoreColours) return;
    refocusMoreColours = false;
    trigger.current?.focus();
  }, []);
  return (
    <div className="tint-field">
      <div className="swatches">
        <button
          type="button"
          className="swatch swatch-none"
          aria-label="none"
          aria-pressed={!tint}
          title="none"
          onClick={() => onPick(undefined)}
        />
        {TINTS.map((t) => (
          <button
            key={t}
            type="button"
            className="swatch"
            aria-label={t}
            aria-pressed={tint === t}
            title={t}
            style={{ background: `var(--tint-${t})` }}
            onClick={() => onPick(t)}
          />
        ))}
        <button
          ref={trigger}
          type="button"
          className={`swatch swatch-more${hex ? " has-hex" : ""}`}
          aria-label="More colours"
          title={hex ? `More colours (now ${hex})` : "More colours"}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-pressed={Boolean(hex)}
          style={hex ? { background: hex } : undefined}
          onClick={() => setOpen((o) => !o)}
        />
      </div>
      {open ? (
        <TintPopover
          value={hex}
          trigger={trigger}
          onCommit={(v, done) => {
            refocusMoreColours = true;
            // A commit that does not remount must not leave the request for a later boundary.
            setTimeout(() => {
              refocusMoreColours = false;
            }, 500);
            onPick(v);
            if (done) close(true);
          }}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function TintPopover({
  value,
  trigger,
  onCommit,
  onClose,
}: {
  /** The boundary's hex tint, or null when it has a named one or none. */
  value: HexTint | null;
  trigger: React.RefObject<HTMLButtonElement | null>;
  /** Apply a colour; `done` closes the popover (a commit remounts the Inspector anyway). */
  onCommit: (v: HexTint, done: boolean) => void;
  onClose: (refocus: boolean) => void;
}) {
  const [recent, setRecent] = useState<HexTint[]>(() => readRecent());
  const [draft, setDraft] = useState(value ?? "");
  const [picked, setPicked] = useState<HexTint>(value ?? "#888888");
  const root = useRef<HTMLDivElement>(null);
  const colour = useRef<HTMLInputElement>(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  const dismiss = useRef(onClose);
  dismiss.current = onClose;
  const apply = (v: HexTint, done: boolean) => {
    setRecent(pushRecent(v));
    setDraft(v);
    setPicked(v);
    commit.current(v, done);
  };
  const applyRef = useRef(apply);
  applyRef.current = apply;
  // What is on screen follows the boundary: a pick or an undo.
  useEffect(() => {
    setDraft(value ?? "");
    if (value) setPicked(value);
  }, [value]);
  // Focus moves in: to the current colour when the palette has it, else the first cell.
  useEffect(() => {
    const el = root.current;
    const cell =
      el?.querySelector<HTMLButtonElement>('.tint-cell[aria-pressed="true"]') ??
      el?.querySelector<HTMLButtonElement>(".tint-cell");
    cell?.focus();
  }, []);
  // A press outside the popover and its trigger closes it, leaving focus where the press went.
  useEffect(() => {
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (!t || root.current?.contains(t) || trigger.current?.contains(t)) return;
      dismiss.current(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [trigger]);
  // React's onChange is the input event, which fires all the way through a drag in the native
  // picker. The native change event fires once, when the choice is made: one pick, one undo.
  useEffect(() => {
    const input = colour.current;
    if (!input) return;
    const onChange = () => {
      const v = normaliseTint(input.value);
      if (v && isHexTint(v)) applyRef.current(v, false);
    };
    input.addEventListener("change", onChange);
    return () => input.removeEventListener("change", onChange);
  }, []);
  const applyText = (text: string) => {
    const t = text.trim();
    const v = normaliseTint(t.startsWith("#") ? t : `#${t}`);
    if (v && isHexTint(v)) {
      if (v !== value) apply(v, false);
      else setDraft(v);
    } else setDraft(value ?? "");
  };
  const cell = (c: HexTint) => (
    <button
      key={c}
      type="button"
      className="tint-cell"
      aria-label={c}
      aria-pressed={value === c}
      title={c}
      style={{ background: c }}
      onClick={() => apply(c, true)}
    />
  );
  return (
    <div
      ref={root}
      className="tint-popover"
      role="dialog"
      aria-label="More colours"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          e.preventDefault();
          onClose(true);
        }
      }}
    >
      <div
        className="tint-grid"
        style={{ gridTemplateColumns: `repeat(${PALETTE_COLUMNS}, 18px)` }}
      >
        {PALETTE.map(cell)}
      </div>
      {recent.length ? (
        <>
          <div className="tint-heading">Recent</div>
          <div
            className="tint-grid"
            style={{ gridTemplateColumns: `repeat(${PALETTE_COLUMNS}, 18px)` }}
          >
            {recent.map(cell)}
          </div>
        </>
      ) : null}
      <div className="tint-hex">
        <input
          type="text"
          className="swatch-hex-text"
          aria-label="custom colour, #rrggbb"
          placeholder="#rrggbb"
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => applyText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // Focus lands on "More colours" before the key finishes; without this, the same
            // Enter would press it and open the popover again.
            e.preventDefault();
            applyText((e.target as HTMLInputElement).value);
          }}
        />
        <button
          type="button"
          className="btn btn-sm"
          title="Open the system colour picker"
          onClick={() => colour.current?.click()}
        >
          <span className="tint-pick-chip" style={{ background: picked }} aria-hidden="true" />
          Pick…
        </button>
        <input
          ref={colour}
          type="color"
          className="tint-native"
          aria-label="system colour picker"
          tabIndex={-1}
          value={picked}
          onChange={(e) => {
            const v = normaliseTint(e.target.value);
            if (v && isHexTint(v)) {
              setPicked(v);
              setDraft(v);
            }
          }}
        />
      </div>
    </div>
  );
}

function Control({
  def,
  value,
  resolved,
  onChange,
}: {
  def: { type: string; values?: string[] };
  value: unknown;
  resolved: unknown;
  onChange: (v: unknown) => void;
}) {
  const unset = `unset (${resolved === undefined ? "absent" : String(resolved)})`;
  if (def.type === "boolean")
    return (
      <select
        value={value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value === "true")}
      >
        <option value="">{unset}</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  if (def.type === "enum")
    return (
      <select
        value={value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      >
        <option value="">{unset}</option>
        {(def.values ?? []).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  if (def.type === "integer")
    return (
      <input
        type="number"
        step="1"
        defaultValue={value === undefined ? "" : String(value)}
        placeholder={resolved === undefined ? "absent" : String(resolved)}
        onBlur={(e) => {
          const v = e.target.value === "" ? undefined : Number.parseInt(e.target.value, 10);
          if (v !== value) onChange(v);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
    );
  return (
    <TextInput
      value={value === undefined ? "" : String(value)}
      placeholder={resolved === undefined ? "absent" : String(resolved)}
      onCommit={(v) => onChange(v === "" ? undefined : v)}
    />
  );
}

export function Inspector({
  selection,
  multi,
  doc,
  notes,
  frameStyles,
  catalogue,
  icons,
  searchRows,
  api,
  highlight,
}: {
  selection: Subject;
  multi: Set<string>;
  doc: any;
  notes: Note[];
  /** Boundary tint and icon by group id, from the layout sidecar. */
  frameStyles?: Record<string, FrameStyle>;
  catalogue: any;
  /** The catalogue icon map (icons.json): component ids, `kind:<id>` and `boundary:<id>`. */
  icons?: Record<string, string>;
  /** The palette's search rows, reused by the boundary icon picker. */
  searchRows?: Row[];
  api: InspectorApi;
  /** The fields the finding last clicked in the panel is about, or null. */
  highlight?: Highlight;
}) {
  const hl = highlight ?? null;
  const head =
    multi.size > 1 ? (
      <div className="mb-3 small muted">
        <b>{multi.size} components selected.</b> Right click for group, duplicate and delete. The
        fields below edit the last one you clicked.
      </div>
    ) : null;
  if (selection.type === "node") {
    const node = doc.nodes.find((n: any) => n.id === selection.ref);
    if (node)
      return (
        <>
          {head}
          <NodePanel node={node} doc={doc} catalogue={catalogue} api={api} highlight={hl} />
        </>
      );
  }
  if (selection.type === "edge") {
    const edge = doc.edges[selection.ref as number];
    if (edge)
      return (
        <>
          {head}
          <EdgePanel
            edge={edge}
            index={selection.ref as number}
            doc={doc}
            api={api}
            highlight={hl}
          />
        </>
      );
  }
  if (selection.type === "note") {
    const note = (notes ?? []).find((n) => n.id === selection.ref);
    if (note)
      return (
        <>
          {head}
          <NotePanel note={note} api={api} />
        </>
      );
  }
  if (selection.type === "group") {
    const group = (doc.groups ?? []).find((g: any) => g.id === selection.ref);
    if (group)
      return (
        <>
          {head}
          <GroupPanel
            group={group}
            doc={doc}
            api={api}
            style={own(frameStyles ?? {}, group.id) ?? {}}
            catalogue={catalogue}
            icons={icons ?? {}}
            searchRows={searchRows ?? []}
          />
        </>
      );
  }
  return (
    <>
      {head}
      <DesignPanel doc={doc} catalogue={catalogue} api={api} highlight={hl} />
    </>
  );
}

function NodePanel({
  node,
  doc,
  catalogue,
  api,
  highlight,
}: {
  node: any;
  doc: any;
  catalogue: any;
  api: InspectorApi;
  highlight: Highlight;
}) {
  const c = own(catalogue.components, node.component);
  const defs: Record<string, any> = propDefs(catalogue, node.component);
  const resolved: Record<string, unknown> = effective(catalogue, node);
  const loc = own(catalogue.locale.components, node.component);
  const siblings = c
    ? Object.values(catalogue.components)
        .filter((x: any) => x.kind === c.kind)
        .map((x: any) => x.id as string)
        .sort()
    : [node.component];
  return (
    <>
      <h2>Node</h2>
      <Field name="label" isSet={Boolean(node.label)}>
        <TextInput value={node.label ?? ""} onCommit={(v) => api.setField(node.id, "label", v)} />
      </Field>
      <Field name="id" note="kebab-case, unique">
        <TextInput value={node.id} onCommit={(v) => api.rename(node.id, v.trim())} />
      </Field>
      <Field
        name="component"
        note={
          c ? `${loc?.name ?? node.component} · ${c.kind} · ${c.provider}` : "not in the catalogue"
        }
      >
        <select value={node.component} onChange={(e) => api.swap(node.id, e.target.value)}>
          {siblings.map((id) => (
            <option key={id} value={id}>
              {catalogue.locale.components[id]?.name ?? id}
            </option>
          ))}
        </select>
      </Field>
      {loc?.description ? <p className="muted my-2 small">{loc.description}</p> : null}
      {Object.keys(defs).length ? <h2>Properties</h2> : null}
      {Object.entries(defs).map(([name, def]) => {
        const value = node.props ? node.props[name] : undefined;
        return (
          <Field
            key={name}
            name={name}
            note={[def.type, def.required ? "required" : null].filter(Boolean).join(" · ")}
            isSet={value !== undefined}
            hl={highlight?.fields.includes(name)}
          >
            <Control
              def={def}
              value={value}
              resolved={resolved[name]}
              onChange={(v) => api.setProp(node.id, name, v)}
            />
          </Field>
        );
      })}
      <h2>Non functional</h2>
      {Object.entries({
        rps: { type: "integer" },
        latencyP95Ms: { type: "integer" },
        consistency: { type: "enum", values: ["strong", "eventual"] },
      }).map(([name, def]) => (
        <Field key={name} name={name} isSet={node.nfr?.[name] !== undefined}>
          <Control
            def={def}
            value={node.nfr?.[name]}
            resolved={undefined}
            onChange={(v) => api.setNfr(node.id, name, v)}
          />
        </Field>
      ))}
      <h2>Group</h2>
      <Field name="group" isSet={Boolean(node.group)}>
        <select
          value={node.group ?? ""}
          onChange={(e) => api.setGroup(node.id, e.target.value || null)}
        >
          <option value="">none</option>
          {(doc.groups ?? []).map((g: any) => (
            <option key={g.id} value={g.id}>
              {g.label || g.id}
            </option>
          ))}
        </select>
      </Field>
      <button
        type="button"
        className="btn btn-sm btn-danger mt-3"
        onClick={() => api.remove("node", node.id)}
      >
        Delete node
      </button>
    </>
  );
}

function EdgePanel({
  edge,
  index,
  doc,
  api,
  highlight,
}: {
  edge: any;
  index: number;
  doc: any;
  api: InspectorApi;
  highlight: Highlight;
}) {
  const lit = (name: string) => highlight?.fields.includes(name);
  const ids = doc.nodes.map((n: any) => n.id as string);
  const pick = (name: string) => (
    <select value={edge[name]} onChange={(e) => api.setEdge(index, name, e.target.value)}>
      {ids.map((id: string) => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
    </select>
  );
  const enumField = (name: string, values: string[], note?: string) => (
    <Field name={name} note={note} isSet={edge[name] !== undefined} hl={lit(name)}>
      <Control
        def={{ type: "enum", values }}
        value={edge[name]}
        resolved={undefined}
        onChange={(v) => api.setEdge(index, name, v)}
      />
    </Field>
  );
  const boolField = (name: string) => (
    <Field name={name} isSet={edge[name] !== undefined} hl={lit(name)}>
      <Control
        def={{ type: "boolean" }}
        value={edge[name]}
        resolved={undefined}
        onChange={(v) => api.setEdge(index, name, v)}
      />
    </Field>
  );
  return (
    <>
      <h2>Edge</h2>
      <Field name="from" isSet>
        {pick("from")}
      </Field>
      <Field name="to" isSet>
        {pick("to")}
      </Field>
      <Field name="protocol" note="required" isSet hl={lit("protocol")}>
        <TextInput
          value={edge.protocol ?? ""}
          onCommit={(v) => api.setEdge(index, "protocol", v)}
        />
      </Field>
      <Field name="mode" note="required" isSet hl={lit("mode")}>
        <select value={edge.mode} onChange={(e) => api.setEdge(index, "mode", e.target.value)}>
          <option value="sync">sync</option>
          <option value="async">async</option>
        </select>
      </Field>
      {enumField("delivery", ["at-most-once", "at-least-once", "exactly-once"], "async edges")}
      <Field name="label" isSet={Boolean(edge.label)}>
        <TextInput
          value={edge.label ?? ""}
          onCommit={(v) => api.setEdge(index, "label", v || undefined)}
        />
      </Field>
      <Field name="timeoutMs" isSet={edge.timeoutMs !== undefined} hl={lit("timeoutMs")}>
        <Control
          def={{ type: "integer" }}
          value={edge.timeoutMs}
          resolved={undefined}
          onChange={(v) => api.setEdge(index, "timeoutMs", v)}
        />
      </Field>
      {enumField("retryPolicy", ["none", "fixed", "exponential", "exponential-jitter"])}
      {boolField("idempotent")}
      {boolField("circuitBreaker")}
      {enumField("fallback", ["none", "static", "cached", "degraded"])}
      {boolField("batched")}
      <button
        type="button"
        className="btn btn-sm btn-danger mt-3"
        onClick={() => api.remove("edge", index)}
      >
        Delete edge
      </button>
    </>
  );
}

// A note is not part of the design: it lives in the layout sidecar, so there is nothing here
// but its text and its box. No rule ever reads it and no edge can reach it.
function NotePanel({ note, api }: { note: Note; api: InspectorApi }) {
  return (
    <>
      <h2>Note</h2>
      <p className="muted my-2 small">
        An annotation. It is stored with the positions, never in the design document, so the rules
        never see it and no edge can connect to it.
      </p>
      <Field name="text" isSet={Boolean(note.text)}>
        <textarea
          rows={5}
          defaultValue={note.text}
          onBlur={(e) => {
            if (e.target.value !== note.text) api.setNoteText(note.id, e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              (e.target as HTMLTextAreaElement).value = note.text;
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
        />
      </Field>
      {note.anchor ? (
        <Field name="anchored to" note="an offset from that box's top-right corner">
          <div className="anchor-row">
            <code>{anchorTarget(note.anchor)}</code>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => api.detachNote(note.id)}
              title="Leave it where it is, but stop following"
            >
              Detach
            </button>
          </div>
        </Field>
      ) : null}
      <div className="meta">
        {note.w} × {note.h} {note.anchor ? "offset" : "at"} {note.x}, {note.y}
      </div>
      <button
        type="button"
        className="btn btn-sm btn-danger mt-3"
        onClick={() => api.remove("note", note.id)}
      >
        Delete note
      </button>
    </>
  );
}

/** The boundary kinds the design schema allows, in its order: the schema is the only list. */
function groupKinds(catalogue: any): string[] {
  const kinds = catalogue?.schema?.properties?.groups?.items?.properties?.kind?.enum;
  return Array.isArray(kinds) ? kinds.map(String) : [];
}

const ICON_RESULTS = 40;

/** What an icon reference is called, for the field and the picker: the catalogue's own name. */
function iconName(ref: string | undefined, catalogue: any) {
  if (!ref) return "";
  if (ref.startsWith("kind:")) {
    const id = ref.slice(5);
    return own(catalogue.locale?.kinds, id)?.name ?? id;
  }
  if (ref.startsWith("boundary:")) {
    const id = ref.slice(9);
    return own(catalogue.locale?.boundaryIcons, id)?.name ?? id;
  }
  const id = ref.slice(ref.indexOf("/") + 1);
  return own(catalogue.locale?.components, id)?.name ?? id;
}

/**
 * Choose a boundary icon: a boundary mark (icons/boundaries/), a kind glyph or a component icon,
 * found with the palette's own search (same scoring, same `kind:` / `provider:` / `category:`
 * filters, same aliases). Boundary marks and kinds have no search rows of their own, so they are
 * made here in the same shape. Boundary marks come first: a few of them before any search, all
 * that match once the reader types. A filter names a catalogue attribute they do not have, so
 * any filter leaves them out.
 */
function IconPicker({
  catalogue,
  icons,
  searchRows,
  onPick,
  onClose,
}: {
  catalogue: any;
  icons: Record<string, string>;
  searchRows: Row[];
  onPick: (ref: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const kindRows = useMemo<Row[]>(
    () =>
      Object.keys(catalogue.kinds ?? {})
        .sort()
        .map((id) => {
          const loc = own(catalogue.locale?.kinds, id) ?? {};
          const name = String(loc.name ?? id);
          const category = String(own(catalogue.kinds, id)?.category ?? "");
          const hay = `${id} ${name} ${loc.description ?? ""}`.toLowerCase();
          return [id, name, id, category, "", hay, ""];
        }),
    [catalogue],
  );
  const markRows = useMemo<Row[]>(
    () => boundaryRows(icons, catalogue.locale?.boundaryIcons),
    [icons, catalogue],
  );
  const { marks, kinds, components } = useMemo(() => {
    const { filters, words } = parseQuery(q);
    // Ties keep the rows' own order (the featured marks first), so the list before a search is
    // the curated one rather than an alphabetical run of brands.
    const m = Object.keys(filters).length
      ? []
      : markRows
          .map((row, i) => [score(row, words), i, row] as const)
          .filter(([sc]) => sc > 0)
          .sort((a, b) => b[0] - a[0] || a[1] - b[1])
          .map(([, , row]) => row)
          .slice(0, words.length ? ICON_RESULTS : BOUNDARY_PREVIEW);
    const pick = (rows: Row[], isKind: boolean) => {
      const out: Array<[number, Row]> = [];
      for (const row of rows) {
        if (filters.provider && (isKind || row[4] !== filters.provider)) continue;
        if (filters.kind && row[2] !== filters.kind) continue;
        if (filters.category && row[3] !== filters.category) continue;
        const sc = score(row, words);
        if (sc) out.push([sc, row]);
      }
      out.sort((a, b) => b[0] - a[0] || a[1][1].localeCompare(b[1][1]));
      return out.map((h) => h[1]);
    };
    const k = pick(kindRows, true).slice(0, Math.max(0, ICON_RESULTS - m.length));
    const c = pick(searchRows, false).slice(0, Math.max(0, ICON_RESULTS - m.length - k.length));
    return { marks: m, kinds: k, components: c };
  }, [q, markRows, kindRows, searchRows]);
  const row = (ref: string, key: string, name: string, meta: string) => (
    <button
      key={ref}
      type="button"
      className="pal-row icon-pick-row"
      title={ref}
      onClick={() => onPick(ref)}
    >
      <Icon markup={own(icons, key)} size="sm" />
      <span className="name">{name}</span>
      <span className="kind">{meta}</span>
    </button>
  );
  return (
    <div className="icon-picker">
      <input
        type="text"
        // biome-ignore lint/a11y/noAutofocus: the picker opens on a click that asked to search
        autoFocus
        placeholder="Search boundary icons, kinds and components…"
        aria-label="Search icons"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      />
      <div className="icon-picker-results">
        {marks.length ? <div className="pal-group">Boundary icons</div> : null}
        {marks.map(([id, name]) => row(`boundary:${id}`, `boundary:${id}`, name, "boundary"))}
        {kinds.length ? <div className="pal-group">Kinds</div> : null}
        {kinds.map(([id, name]) => row(`kind:${id}`, `kind:${id}`, name, "kind"))}
        {components.length ? <div className="pal-group">Components</div> : null}
        {components.map(([id, name, , , provider]) =>
          row(`component:${provider}/${id}`, id, name, provider),
        )}
        {!marks.length && !kinds.length && !components.length ? (
          <div className="muted p-2">Nothing matches.</div>
        ) : null}
      </div>
    </div>
  );
}

function GroupPanel({
  group,
  doc,
  api,
  style,
  catalogue,
  icons,
  searchRows,
}: {
  group: any;
  doc: any;
  api: InspectorApi;
  style: FrameStyle;
  catalogue: any;
  icons: Record<string, string>;
  searchRows: Row[];
}) {
  const [picking, setPicking] = useState(false);
  const iconKey = frameIconKey(style.icon);
  const members = doc.nodes.filter((n: any) => n.group === group.id).length;
  return (
    <>
      <h2>Boundary</h2>
      <Field name="label" isSet={Boolean(group.label)}>
        <TextInput
          value={group.label ?? ""}
          onCommit={(v) => api.setGroupField(group.id, "label", v || undefined)}
        />
      </Field>
      <Field name="id">
        <TextInput value={group.id} onCommit={(v) => api.renameGroup(group.id, v.trim())} />
      </Field>
      <Field name="kind" note="required" isSet>
        <select
          value={group.kind}
          onChange={(e) => api.setGroupField(group.id, "kind", e.target.value)}
        >
          {groupKinds(catalogue).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Field>
      <Field name="parent" note="a cycle is refused" isSet={Boolean(group.parent)}>
        <select
          value={group.parent ?? ""}
          onChange={(e) => api.setParent(group.id, e.target.value || null)}
        >
          <option value="">none</option>
          {(doc.groups ?? [])
            .filter((g: any) => g.id !== group.id)
            .map((g: any) => (
              <option key={g.id} value={g.id}>
                {g.label || g.id}
              </option>
            ))}
        </select>
      </Field>
      <Field name="colour" note="layout only, not in the YAML" isSet={Boolean(style.tint)}>
        <TintField
          key={group.id}
          tint={style.tint}
          onPick={(tint) => api.setFrameStyle(group.id, { tint })}
        />
      </Field>
      <Field name="icon" isSet={Boolean(style.icon)}>
        <div className="icon-field">
          {style.icon ? (
            <>
              <Icon markup={iconKey ? own(icons, iconKey) : undefined} size="sm" muted />
              <span className="icon-field-name" title={style.icon}>
                {iconName(style.icon, catalogue)}
              </span>
            </>
          ) : (
            <span className="muted">none</span>
          )}
          <button type="button" className="btn btn-sm" onClick={() => setPicking((p) => !p)}>
            Choose…
          </button>
          {style.icon ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => api.setFrameStyle(group.id, { icon: undefined })}
            >
              Remove
            </button>
          ) : null}
        </div>
      </Field>
      {picking ? (
        <IconPicker
          catalogue={catalogue}
          icons={icons}
          searchRows={searchRows}
          onPick={(ref) => {
            setPicking(false);
            api.setFrameStyle(group.id, { icon: ref });
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
      <div className="meta">
        {members} member{members === 1 ? "" : "s"}
      </div>
      <button
        type="button"
        className="btn btn-sm btn-danger mt-3"
        onClick={() => api.remove("group", group.id)}
      >
        Delete boundary
      </button>
    </>
  );
}

function DesignPanel({
  doc,
  catalogue,
  api,
  highlight,
}: {
  doc: any;
  catalogue: any;
  api: InspectorApi;
  highlight: Highlight;
}) {
  const schema = catalogue.schema?.properties?.requirements ?? { properties: {} };
  // The rule reads `security.credentialRotationDays`; the panel shows a `security` group holding
  // a `credentialRotationDays` field. Split once, here, and both halves are looked up by name.
  const wanted = (highlight?.requirements ?? []).map((path) => path.split("."));
  // A rule that also hunts for a node says so once, under the group it pointed at, because that
  // is where the reader is looking — and the palette can be pointed straight at it.
  const hunted = highlight?.nodeKinds.length
    ? { query: `kind:${highlight.nodeKinds[0]}`, text: highlight.nodeKinds.join(" or ") }
    : highlight?.nodeCategories.length
      ? {
          query: `category:${highlight.nodeCategories[0]}`,
          text: highlight.nodeCategories.join(" or "),
        }
      : null;
  return (
    <>
      <h2>Design</h2>
      <Field name="id" note="kebab-case" isSet>
        <TextInput value={doc.id ?? ""} onCommit={(v) => api.setDesignId(v.trim())} />
      </Field>
      <div className="meta">
        {doc.nodes.length} nodes · {doc.edges.length} edges · {(doc.groups ?? []).length} boundaries
      </div>
      <h2>Requirements</h2>
      <p className="meta mb-2">
        The promises this design makes. Rules compare components against them.
      </p>
      {Object.entries(schema.properties ?? {}).map(([groupName, groupSchema]: [string, any]) => {
        const current = doc.requirements?.[groupName] ?? {};
        const set = Object.keys(current).length;
        const asked = wanted.filter(([g]) => g === groupName).map(([, name]) => name);
        return (
          <details key={groupName} open={set > 0 || asked.length > 0}>
            <summary>
              {label(groupName)}
              {set ? ` · ${set} set` : ""}
            </summary>
            {Object.entries(groupSchema.properties ?? {}).map(([name, def]: [string, any]) => {
              const kind = def.enum
                ? { type: "enum", values: def.enum }
                : def.type === "boolean"
                  ? { type: "boolean" }
                  : def.type === "integer"
                    ? { type: "integer" }
                    : { type: "string" };
              const note = [
                def.type === "string" && def.pattern ? `pattern ${def.pattern}` : null,
                def.minimum !== undefined ? `min ${def.minimum}` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <Field
                  key={name}
                  name={name}
                  note={note}
                  isSet={current[name] !== undefined}
                  hl={asked.includes(name)}
                  path={`${groupName}.${name}`}
                >
                  <Control
                    def={kind}
                    value={current[name]}
                    resolved={undefined}
                    onChange={(v) => api.setRequirement(`${groupName}.${name}`, v)}
                  />
                </Field>
              );
            })}
            {asked.length > 0 && hunted ? (
              <div className="rule-hint">
                <span>This rule also looks for a {hunted.text} node.</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => api.findInPalette(hunted.query)}
                >
                  Find in palette
                </button>
              </div>
            ) : null}
          </details>
        );
      })}
    </>
  );
}
