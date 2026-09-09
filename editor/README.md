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
- **Canvas.** The gestures are the ones draw.io and Excalidraw already taught you: drag on
  empty space to sweep a selection box, shift click to add or remove, the middle button or space
  to pan, the wheel to zoom, and the right button for a menu about whatever is under it. Drag a
  node's dot to draw an edge and the component it would land on lights up. Double click any label
  to edit it where it is. Membership changes when you drop a node inside a frame, and dragging one
  node of a selection drags all of them, as one entry in the history.
- **Names.** A component is called what the catalogue calls it: place Azure Functions twice and
  both boxes say Azure Functions, because there is one Azure Functions and these are two of it.
  Double click to name one; the name is what the canvas shows and, while the id is still the one
  the editor generated, the id follows it, so the file says `orders-worker` rather than
  `azure-functions-2`. An id you typed yourself is never rewritten behind you, and the id field
  takes what you type, turns it into kebab-case, and says so when the id is already someone's.
- **Inspector.** Generated from the catalogue, never hard coded: a kind's properties, a
  component's own, the six optional edge fields, group kind and parent, and the whole
  `requirements` tree generated from the JSON Schema. A control shows the value the design would
  resolve to in grey, and writes only when you set something.
- **Findings.** Structural errors block a save because the file would not be valid. Rule
  findings never block, because a real design can legitimately trip a rule. Click one to select
  and centre its subject.
- **Boundaries.** Select components and press `G`, or right click and choose Group. Grouping
  things that already share a boundary nests inside it rather than beside it. `Delete` on a
  boundary removes the boundary and keeps what was in it; the menu also offers deleting both.
- **Export.** `Export` writes the drawing as PNG, JPEG or SVG. The SVG is the source in all
  three cases, so a raster can never show something the vector does not, and it is written with
  the colours the page has rather than references to them, which is what makes it a file and not
  a screenshot of this stylesheet. The palette is the one you chose with `Theme`; with no choice
  made it is light, because a diagram going into a document should not come out dark for having
  been exported in the evening. The SVG carries no background, so it sits on whatever page you
  put it on; PNG and JPEG do, because a raster of a diagram lands on a slide.
- **Arrange.** Places every component again, in layers from the sources down, by the same layout
  the repository's renderer uses. It replaces the positions of the whole design, which is why it
  is one `Ctrl Z` away, like everything else.
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
  how you separate two edges running between the same pair; its label rides the curve rather than
  the control point, so it stays on the line however far you pull it. Right click an edge to
  straighten it, reverse it, or switch it between sync and async. Node positions and edge bows go
  to a `design.layout.json` sidecar, never into the YAML, because the format has nowhere to put
  them.

## Keys

`Ctrl N` new · `Ctrl S` save · `Ctrl Z` undo · `Ctrl Y` or `Ctrl Shift Z` redo · `Ctrl A` select
every component · `Ctrl D` duplicate · `Ctrl 0` fit · `Ctrl 1` actual size · `G` group ·
`Ctrl Shift G` ungroup · arrows nudge, with `Shift` for ten at a time · `Enter` edit the selected
label · `Delete` remove the selection · `Esc` deselect · `?` the whole list, in the page.

Every one of them, and every pointer gesture, goes through the same history: `Ctrl Z` takes it
back and `Ctrl Y` puts it back.

## How it is built

Vanilla ES modules, no framework, no dependencies, no build step. `editor/core/` is DOM free and
importable by node, which is what makes it testable without a browser:

| Module | Job |
|---|---|
| `core/yaml.js` | Parse keeping every source span; serialise by copying spans and splicing only what changed |
| `core/document.js` | Pure document operations, including every cascade an id rename or a delete implies |
| `core/structure.js` | The validator's own structural checks, message for message, plus a schema layer |
| `core/rules.js` | The 36 rules, ported bug for bug, with subjects so a finding points at something |
| `ui/scene.js` | The SVG scene and every pointer gesture on it |
| `ui/export.js` | The drawing as a file: SVG, or that SVG painted onto a canvas |
| `ui/menu.js` | The right click menu, which is data the scene's caller decides |
| `core/layout.js` | The repository renderer's layout, ported number for number |
| `core/geometry.js` | Edge paths, bows, label points and group frames, derived from positions on every drag |

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
authoring cycle from New through seven saves, what grouping, ungrouping, duplicating and
reversing actually do to a document, and the full repository gate after rewriting every design
with the editor's own serialiser.
