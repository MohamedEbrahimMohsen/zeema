"use client";

// Every control here is generated from the catalogue and the design schema; nothing about a
// product is hard coded. A control shows the value the design resolves to and writes only when
// the user sets something. Text inputs commit on blur or Enter, never per keystroke.
import { effective, propDefs } from "@zeema/core/document";
import { anchorTarget, type Note } from "@/lib/layout-sidecar";
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
  catalogue,
  api,
  highlight,
}: {
  selection: Subject;
  multi: Set<string>;
  doc: any;
  notes: Note[];
  catalogue: any;
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
          <GroupPanel group={group} doc={doc} api={api} />
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
  const c = catalogue.components[node.component];
  const defs: Record<string, any> = propDefs(catalogue, node.component);
  const resolved: Record<string, unknown> = effective(catalogue, node);
  const loc = catalogue.locale.components[node.component];
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

const GROUP_KINDS = [
  "region",
  "availability-zone",
  "vpc",
  "trust-zone",
  "system",
  "cell",
  "point-of-presence",
];

function GroupPanel({ group, doc, api }: { group: any; doc: any; api: InspectorApi }) {
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
          {GROUP_KINDS.map((k) => (
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
