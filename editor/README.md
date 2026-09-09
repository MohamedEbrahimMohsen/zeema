# Arkore canvas

A drag and drop editor for Arkore designs. Drag a component onto the canvas, connect nodes, wrap
them in boundaries, set typed properties, and the file that comes out is a `design.yaml` the
repository validator accepts unchanged.

```bash
node editor/serve.mjs
```

Then open `http://localhost:8000/editor/`. That server is also the write channel: a save is a
PUT back to the same path, so the editor edits the repository in place. Writes are refused
outside `designs/`, and refused for the seven `design.broken.yaml` files, which have to keep
tripping exactly the rules their headers name.

## What it does

- **Palette.** All 1,623 components, searchable. `provider:aws` and `kind:queue` narrow it.
  Drag a row onto the canvas to place a node.
- **Canvas.** Pan, zoom, drag nodes, pull an edge from a node's handle, press `G` to wrap the
  selection in a group. Membership changes when you drop a node inside a frame.
- **Inspector.** Generated from the catalogue, never hard coded: a kind's properties, a
  component's own, the six optional edge fields, group kind and parent, and the whole
  `requirements` tree generated from the JSON Schema. A control shows the value the design would
  resolve to in grey, and writes only when you set something.
- **Findings.** Structural errors block a save because the file would not be valid. Rule
  findings never block, because a real design can legitimately trip a rule. Click one to select
  and centre its subject.
- **New.** `New` starts a design in `designs/authored/<id>/`, the tier for designs made here:
  no external source, so no `mapping.yaml`, and no broken twin. It stays unsaved until it has at
  least one node, because a design with an empty node list is not valid.
- **Save.** Byte preserving. An unmodified file comes back identical, comments and blank lines
  and quoting included; an edited one differs only on the lines you changed. Turn on `auto` and
  the file is written a moment after each change, but only while the design is structurally
  valid, so autosave can never write a file CI would reject. A design with no edges yet is
  written `edges: []`, because a bare `edges:` is YAML for null and a design whose edge list is
  null is a design nothing downstream can read. A file that arrives that way is repaired when it
  opens, and the repair is named in the status line rather than done quietly.
- **Edges you can place.** Drag an edge to bow it away from whatever it collides with, which is
  how you separate two edges running between the same pair. Double click an edge to hand it back
  to the automatic path. Node positions and edge bows go to a `design.layout.json` sidecar,
  never into the YAML, because the format has nowhere to put them.

## Keys

`Ctrl N` new · `Ctrl S` save · `Ctrl Z` / `Ctrl Shift Z` undo and redo · `Ctrl 0` fit · `Ctrl 1` actual size ·
`G` group the selection · `Delete` remove the selection · `Esc` deselect · double click a node to
rename its label.

## How it is built

Vanilla ES modules, no framework, no dependencies, no build step. `editor/core/` is DOM free and
importable by node, which is what makes it testable without a browser:

| Module | Job |
|---|---|
| `core/yaml.js` | Parse keeping every source span; serialise by copying spans and splicing only what changed |
| `core/document.js` | Pure document operations, including every cascade an id rename or a delete implies |
| `core/structure.js` | The validator's own structural checks, message for message, plus a schema layer |
| `core/rules.js` | The 36 rules, ported bug for bug, with subjects so a finding points at something |
| `core/layout.js` | The repository renderer's layout, ported number for number |
| `core/geometry.js` | Edge paths, bows and group frames, derived from positions on every drag |

`editor/data/` is generated and committed:

```bash
node .claude/tools/build_editor_data.mjs
```

## Tests

```bash
node .claude/tools/editor_test.mjs
```

Everything runs under node with no browser: parser conformance against a real YAML library,
byte-identical round trips on all 26 committed designs, rule parity with the validator including
the message strings, structural parity on deliberately broken documents, a sweep that builds a
one-node design for every one of the 1,623 components, layout equality with the Python renderer
on all 324 node placements, bundle freshness, the write channel against a real server, the whole
authoring cycle from New through seven saves, and the full repository gate after rewriting every
design with the editor's own serialiser.
