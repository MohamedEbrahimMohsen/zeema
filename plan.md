# Arkore canvas: plan

A drag and drop editor for Arkore designs. Drag a component from a palette onto an infinite
canvas, connect nodes, wrap them in boundaries, set typed properties; what comes out is a
`design.yaml` that the repository validator accepts unchanged.

**draw.io** supplies the working model: a searchable palette on the left, a properties panel on
the right, containers, edges you pull from a shape, one canvas that behaves the same way every
time. **Excalidraw** supplies the feel: it opens instantly, has a small tool set, stays out of
the way, and is keyboard first. **Arkore** supplies what neither has. The shapes are typed, so
the editor knows every kind's properties, every component's real defaults, and the 36 lint rules
that read them. It lints while you draw.

This plan is the outcome of a two-round design debate; the drafts are in the session scratchpad
and the decisions are recorded in section 3. It supersedes the "v1 is specification only" rule
for one folder: the editor lives in `editor/` and the format still ships no runtime code.

## 1. Goals

1. Produce a valid `design.yaml` without hand-writing YAML.
2. Reach any of 1,623 components in under five seconds through search.
3. Show rule findings live, attached to the node, edge or design that trips them.
4. Open any of the 19 editable repository designs, edit, save, and still pass the full
   repository gate. The 7 `design.broken.yaml` files are round-trip only and edit-locked,
   because each must trip exactly the rule set named in its own header.
5. Run with no install beyond what the repository already needs: `node`, one command, one page.

## 2. Measured truths this plan is pinned to

| Fact | Value |
|---|---|
| Components / kinds / rules | 1,623 / 71 / 36 |
| Design files | 26, largest 27 nodes and 27 edges, 324 nodes in total |
| Editable designs | 19; the 7 broken variants are locked |
| Catalogue bundle | 988 KB raw |
| Icons bundle | 1.28 MB raw, served uncompressed by a dev server |
| Kinds with a required property | 10, all enums |
| Components whose required property resolves to nothing | 2: `odyssey.poolMode`, `oci-events.delivery` |
| Node pairs with parallel or reciprocal edges | 22 |
| Maximum node degree | 9 |
| Design files with a comma or colon inside a quoted scalar | 12 of 26 |
| Designs with a cycle in the sync subgraph | 7 of 26 |
| Node placements landing exactly on a half pixel | 107 of 324 |
| Rules selecting an edge / the design | 4 / 2 |

## 3. Decisions taken in the debate

Each of these settles something that would otherwise have to be arbitrated mid-build.

1. **`editor/package.json` is `{"type": "module"}`.** The repository root is
   `"type": "commonjs"`, so without this nothing under `editor/core/` is importable by node and
   milestone 1 cannot start.
2. **The dev server writes.** `editor/serve.mjs` is a small node static server that also honours
   `PUT` under `designs/`. This is the write channel for both `design.yaml` and the layout
   sidecar. The alternative, `showDirectoryPicker()`, was rejected because it ties the editor to
   Chromium and adds a permission prompt; node is already required for the generator and the gate.
3. **The serialiser copies spans, it does not reconstruct.** Parsing produces a line-anchored
   concrete syntax tree in which every mapping, entry and scalar keeps its exact source span.
   Saving copies the source byte for byte and splices only the spans that changed. Byte identity
   on an unmodified file is then structurally impossible to fail. All comments, including
   trailing and standalone ones, and all blank lines, keep their position.
4. **Positions live in a sidecar per design file**: `design.layout.json` and
   `design.broken.layout.json`, content exactly `{"version":1,"nodes":{"<id>":[x,y]}}`. Group
   frames and all edge geometry are derived, never stored. The validator reads fixed filenames
   per folder, so a sidecar is invisible to it.
5. **Edge geometry is the port, and only the port.** Centre to centre, clipped at the box border,
   reciprocal pairs offset 16, obstacle bends, exactly as `design_to_svg.py` draws them. Side
   handles are hit targets for starting a drag; they carry no persisted meaning. Edges have no id
   in the schema and parallel edges are indistinguishable, so nothing about an edge can be
   persisted anyway.
6. **`syncChainDepth` is the longest simple path, as in the validator.** It may be memoised only
   over a sync subgraph proven acyclic by one DFS colouring per pass; id-memoising everywhere
   changes the number on 6 of 26 designs.
7. **Structural parity is split.** The 13 message templates of `checkDesign` are pinned verbatim.
   Schema violations are reported in the editor's own wording, because Ajv is a dependency the
   editor cannot have; the schema uses only nine keywords and they are hand-written.
8. **Four defaults are fixed.** A new node's id is the component id, suffixed `-2`, `-3` to the
   first free value. A new group is `kind: "system"`. There is no cross-kind component swap in
   v1. Findings render the rule's own `message` template through the validator's substituter;
   the locale text is the panel title only.
9. **The Python port needs Python's rounding.** `pyRound(x)` is half to even. 107 of 324 node
   placements land on exactly `.5`, where `Math.round` and Python's `round` disagree, and the
   difference cascades into frames, clip points and bend decisions.
10. **No icon sharding.** One `icons.json`, fetched after first paint, applied as a `<defs>`
    patch that never goes through the structural render path. The scene instantiates at most 27
    distinct symbols.

Cut before a line was written: PNG export, a multi-document project store, palette favourites,
provider tabs, copy and paste, marquee selection, snapping guides, orthogonal routing, and the
in-app shortcut sheet.

## 4. Architecture

```
editor/
  package.json            {"type":"module"}
  index.html              the shell
  serve.mjs               static server with PUT under designs/
  core/                   DOM free, importable by node, the whole testable surface
    yaml.js               parse(text) -> {doc, cst}   serialize(cst, doc) -> text
    document.js           pure document operations, including every cascade
    structure.js          port of checkDesign plus a nine-keyword schema layer
    rules.js              bug-for-bug port of the rule evaluator
    layout.js             port of design_to_svg.py, pyRound included
    catalogue.js          resolve, propDefs, effective
  ui/
    app.js scene.js palette.js inspector.js findings.js files.js
  data/                   generated and committed
    catalogue.json search.json icons.json designs.json
.claude/tools/
  build_editor_data.mjs   the generator
  editor_test.mjs         the acceptance harness, run with node
```

`editor/core` never imports from `editor/ui`. The harness imports only `editor/core`, so every
acceptance test below runs headless.

### Document model

The in-memory document is the design document itself: `schemaVersion`, `type`, `id`,
`requirements`, `groups`, `nodes`, `edges`. Undo clones `{doc, layout}` together, capped at 100
entries, with consecutive drags of one node coalesced inside 400 ms.

### Two render paths

*Structural* rebuilds the scene when nodes, edges or groups are added, removed or re-parented.
*Transform* writes only the `transform` of a moved node's group and the geometry of its attached
edges, and creates no DOM elements. Each distinct component icon is emitted once as a `<symbol>`
and instanced with `<use>`.

### Property controls

Generated from the kind's and component's property definitions: boolean to a switch, integer and
string to fields, enum to a select, `ref` to a picker of nodes of the referenced kind. The
resolved value (node prop, then component default, then kind default) shows in grey; a control
writes only when the user sets a value, and setting it back to the resolved value deletes the
key. Nothing is written on creation, except the two components whose required property resolves
to nothing, which get the first enum value and an amber flag until confirmed.

### Unknown things

A component missing from the bundle renders as a grey placeholder, keeps its props verbatim
through a save, raises one structural error, and any predicate that reaches it evaluates false
rather than throwing. Every rule pass is wrapped per rule so one bad node cannot blank the panel.

## 5. Milestones, each ending in a machine check

**M1 Headless core.** `editor/package.json`; the generator emitting `catalogue.json`,
`search.json`, `designs.json`; the F5 and F6 fixtures; `yaml.js` with the span-copying
serialiser; the complete `document.js` including edge cascade, group orphaning, re-parenting and
id rewrite; `structure.js`; `rules.js`; the undo unit. Green: F1, F2, F4, F5, F8, and the parser
half of F9.

**M2 Layout, scene, and the write channel.** `layout.js` gated by a golden file of all 324 node
placements, every group frame and every edge polyline dumped from `design_to_svg.py`; `serve.mjs`;
sidecar read and write; a read-only scene rendering all 26 designs. Green: F7 and the golden
diff, plus a sidecar written and read back over PUT.

**M3 Selection, move, inspector, undo.** Including the requirements editor generated from the
bundled JSON Schema. Green: F6 through the document API.

**M4 Palette and node creation.** `icons.json` and the symbol patch.

**M5 Edge editing.** Side handles, drag to connect, defaults `protocol: "http"` and
`mode: "sync"`, self loops refused, parallel edges allowed.

**M6 Group editing.** Select and press G, membership on drop by innermost frame, `parent` in the
inspector with cycle rejection, `group` also settable in the node inspector so an empty group is
recoverable.

**M7 Findings and save.** Structural errors block save; rule findings never do. Green: F3, the
full repository gate.

**M8 Export, autosave, docs.** Green: F9, F10, F11.

## 6. The walking skeleton

The smallest path that proves the premise, built first: `editor/package.json`, the generator
emitting `catalogue.json` and `designs.json`, the full `yaml.js`, the full `layout.js` with its
golden file, `structure.js` limited to `checkDesign`, one `ui/app.js` that fetches a design,
draws plain rects with two text lines and ported edge lines, selects, drags, edits one label
inline, and saves through `serve.mjs`; plus the sidecar and the gate.

Deliberately absent: icons, palette, node creation, rules, group editing, edge creation, undo,
autosave, export, the schema layer, the requirements editor, zoom and pan beyond fit to content.

A move alone would not prove the serialiser, because a move touches only the sidecar and the
YAML comes back byte identical. The inline label edit is the cheapest mutation that forces one
span splice through the round trip, so it is in the skeleton.

## 7. Acceptance, all runnable by node

| Test | What it asserts |
|---|---|
| F1 | Parser conformance against the `yaml` package on all 26 designs |
| F2 | Round trip: idempotent, all comments and blank lines preserved, byte identical on all 26 unmodified files |
| F3 | Full gate: overwrite all 26 designs with editor output, `node .claude/tools/validate.mjs` exits 0 with stdout identical to a baseline captured beforehand |
| F4 | Rule parity with the validator on all 26 designs, including notification-system's exact 9 findings and slack-messaging's 0 |
| F5 | Structural parity: 12 broken fixtures, the 13 `checkDesign` strings verbatim, schema violations matched by pointer and keyword |
| F6 | Catalogue sweep: a one-node design for each of 1,623 components is structurally clean, with `missing required` for exactly the two known components |
| F7 | Layout determinism, no overlapping boxes, members inside frames, no NaN, and the golden diff against the Python renderer |
| F8 | Bundle freshness: regeneration is byte identical |
| F9 | Robustness: unknown component, unknown group kind, truncated file, unterminated quote |
| F10 | Measured: palette search p95 under 16 ms, layout of 200 nodes under 500 ms, rules over a 60-node sync chain under 100 ms, a 200-event drag creating zero DOM elements |
| F11 | No network and no dependencies inside `editor/` |

The harness lives in `.claude/tools/editor_test.mjs` because `yaml` and `ajv` resolve only in
`.claude/tools/node_modules`.

## 8. The cut list, applied in order without deliberation

If the build runs long, drop in this order. Each cut assumes the earlier ones are made.

1. Export SVG. 2. Autosave. 3. The requirements editor. 4. Group editing, frames still draw.
5. Component swap. 6. Palette and node creation, so it edits existing designs only. 7. Edge
creation, edges still render and their fields still edit. 8. Live rules in the UI, `rules.js`
still ships and still passes F4. 9. The sidecar and manual positions, so every open auto-lays out.

Never cut: the YAML round trip, the structural checker, the layout port, and open and save
against the repository. Without those four, nothing above them is an editor.

## 9. Running it

```bash
node editor/serve.mjs
```

Then open `http://localhost:8000/editor/`. Regenerate the data when the catalogue changes:

```bash
node .claude/tools/build_editor_data.mjs
```

```bash
node .claude/tools/editor_test.mjs
```

## 10. Status

Built and green. `node .claude/tools/editor_test.mjs` passes every check in section 7, and
`node .claude/tools/validate.mjs` still passes on the repository.

What shipped: the whole of sections 4 to 6, plus the palette, edge editing, group editing,
findings, SVG export and autosave. Nothing from the cut list in section 8 had to be applied.

Three things the build found that the plan did not anticipate.

- **CRLF.** A design checked out on Windows arrives with carriage returns. The parser now reads
  either terminator and the serialiser hands back the one it was given, or every save on a fresh
  clone would rewrite every line.
- **109 icons carried invalid path data.** The mark shortener merged two coordinates into one
  whenever a number rounded to zero, and read a pair of packed arc flags as a single number.
  Both faults produce a path a browser refuses to draw, and both were invisible to every check
  the repository had. The shortener is now structural rather than numeric, it validates its own
  output, and `check_icon_paths.mjs` walks all 4,843 paths on every run of the gate. Two brand
  marks cannot be shortened to the badge budget without breaking, so they were dropped and their
  components draw the kind glyph alone.
- **The rules the editor shows are advisory, and it matters more than expected.** Twelve of the
  twelve imported designs trip rules, so a findings panel that blocked a save would have made
  the editor unable to save the repository's own designs. Structural errors block; findings never
  do.

## 11. Added after the first release

Two features the user asked for once the canvas was in their hands.

**A design can be created here, and saved without being asked twice.** `New` writes into
`designs/authored/<id>/`, a third tier for designs with no external source: no `mapping.yaml`,
because there is nothing to be faithful to, and no broken twin, because it owes no rule set. The
validator checks it structurally like an imported design and reports its findings; the dev
server is the only thing that may create the folder, and only for a kebab-case id. Autosave, when
switched on, writes the file a moment after each change and refuses while a structural error
stands, so it can never write something CI would reject. The design list now comes from the
server rather than the committed bundle, so a design created a minute ago is in the picker.

**An edge can be placed by hand.** Dragging an edge bows it: the control point of its curve moves
along the perpendicular, which is what pulls apart two edges running between the same pair, or
lifts one clear of a box it runs under. Double clicking hands it back to the automatic path. A
bow lives in the layout sidecar under a key derived from the pair and its position among that
pair's own edges, never in the design file, because the format has nowhere to put geometry and
edges have no id to hang it on. An unknown key is dropped on load.

Both are covered by the gate: `test_geometry.mjs` for keys, bows and the drag arithmetic, and
`test_editor_server.mjs`, which starts the server and checks what it will and will not write.

## 12. The second pass on the pointer

The canvas worked and did not feel like a canvas. Everything here is a convention someone already
has from draw.io or Excalidraw, so the correct design decision was almost always "do what those
two do", and the interesting part is where the model made that impossible.

- **Selection is a set.** Shift click adds and removes, a drag on empty space sweeps a box, and
  dragging any member of a selection drags all of them as one entry in the history. The inspector
  still edits one node, because its fields come from that node's component, so it says which one.
- **The empty canvas no longer pans.** It sweeps. Panning moved to the middle button and to space
  with the left button, which is where both of those editors put it.
- **Labels are edited where they are**, on a node, an edge or a boundary, by an input placed over
  the drawing rather than a browser prompt. Double click opens it, `Enter` commits, `Escape`
  abandons, an emptied field deletes the key.
- **The right button opens a menu about what is under it.** Group, ungroup, duplicate, reverse an
  edge, switch it between sync and async, straighten it, delete. Nothing in it is unreachable
  from the keyboard, and nothing in it bypasses `commit`.
- **A boundary is now a thing you can hit.** Its border is a 16px stroke target, so a group is
  reachable without finding its label. `Delete` on it removes the boundary and keeps the members,
  which is the reading a keystroke can be trusted with; deleting the contents too is in the menu,
  where it can say how many components it would take.
- **Grouping nests.** Selecting things that already share a boundary and grouping them sets the
  new group's `parent`, because frames are derived from membership and two crossing boundaries
  would otherwise be drawn.
- **An edge's label rides the curve.** It was drawn at the quadratic's control point, which sits
  twice as far from the chord as the curve does, so a bowed edge left its label hundreds of pixels
  away. `midpointOf` returns the curve at t = 0.5.

`test_editing.mjs` covers the document side of all of it, and `?` in the page lists every gesture,
because a canvas whose features can only be found by being told about them has not shipped them.

## 13. Identity

A node was called by its id, and its id was the component's id with a counter on it, so placing
Azure Functions twice drew a box called `azure-functions-2`. That reads as a second, forked
component, which is exactly the thing the catalogue exists to prevent: there is one Azure
Functions and a design may hold two of it.

- A node is drawn with its **name**: its own label, else the component's name from the locale.
  Two instances both say Azure Functions. The line under it still names the component id.
- **The name drives the id.** While the id is the generated one, `azure-functions` or
  `azure-functions-2`, naming the node rewrites the id from the name, cascading through edges,
  ref properties and group membership. `orders-worker` is what lands in the file. An id someone
  typed is never rewritten, which is what `isGeneratedId` is for.
- **The id field accepts what a person types.** "Azure Function EU" becomes
  `azure-function-eu` rather than being silently put back, which is what a field that refuses
  without saying anything looks like from the outside. The one refusal left, an id another node
  has, says so.
- **Double click was broken with a real mouse.** A drag captures the pointer, and a captured
  pointer retargets the click that follows to the element holding the capture, so the listener on
  the node never heard it; only a synthetic event dispatched straight at the node did, which is
  why the tests passed. Double click is now handled once on the scene and hit tested by point.

## 14. Getting the drawing out

`Export` offers PNG, JPEG and SVG. One drawing feeds all three: `scene.toSVG()` is the source,
and the raster formats are that SVG drawn onto a canvas at 2x, so a PNG can never show something
the SVG does not.

The SVG export was not a file anyone else could open. Every colour on the scene is a CSS
variable, including the node fills, which are inline `fill="var(--f-blue-fill)"` attributes, and
a variable resolves to nothing outside the page that declares it: every node body and every
arrowhead would have come out unpainted. The export now resolves each name against the live
document and writes the value, so the file carries its own colours.

Two smaller corrections came with it. The bounds were taken from the node boxes, which clips a
bowed edge, a group frame or a wide label; they are measured with `getBBox` now. And the palette
is a control rather than whatever the operating system says this evening, because the export
takes the theme that is showing and someone exporting a diagram for a document usually wants the
light one.

The colours cannot be checked by rendering under node, so the gate checks the next best thing:
every variable name the scene can emit, the assembled `--f-<hue>-fill` ones included, is declared
in the stylesheet. A typo there is a black box in someone's slide deck and nothing on screen to
warn about it.

## 15. Two things the canvas got wrong about itself

**Undo did not cover anything that moved.** Positions and bows live outside the document, and
every command that changed one mutated `state.positions` and then called `commit`, which takes
its snapshot at the top. The snapshot was therefore of the move, and undo put back what was
already on screen. It looked as though it worked, because the stack still held snapshots from
earlier commands whose positions predated the drag, so an undo far enough back did move things.
`commit` now takes the mutation as `apply` and runs it after the snapshot, and every caller that
touched positions hands it over: a drag, a nudge, a duplicate, an id rename, a placement, a bow,
and the layout button.

**"Tidy" said nothing about what it did.** It is `Arrange`, it says it places every component
again in layers, and it is undoable like everything else.

**The exported SVG was a black box.** The export took the palette the page was showing, and the
page follows the operating system, so an export made in the evening carried a near-black ground
rectangle: opened on its own, a dark box in the corner of a white page. The palette is now the
one the person chose, and light when they have not chosen, and the SVG carries a background only
when it needs one, which is when the ink is pale. A raster keeps its ground: JPEG cannot be
transparent, and a PNG of a diagram is nearly always dropped onto a slide.
