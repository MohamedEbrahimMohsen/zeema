---
title: Notes and the layout sidecar
description: Where positions and annotations live, and why they are never in the design document.
order: 5
---

Positions, sizes and colours are not part of a design. That is the first principle of the format,
and it is what makes a diff readable: a pull request that changes `replication: "none"` to
`"async"` is one line, while a pull request that moves a rectangle is noise.

But people do arrange diagrams, and people do annotate them. Both go **beside** the design, never
inside it.

## The sidecar

The sidecar is a small JSON document stored with each version of a design.

```json
{
  "version": 2,
  "nodes": { "api": [120, 80], "orders-queue": [360, 80] },
  "edges": { "api>orders-queue": 0 },
  "ports": { "api>orders-queue": { "from": { "side": "right", "t": 0.5 } } },
  "notes": [],
  "frames": { "vpc": { "tint": "blue", "icon": "kind:api-gateway" } }
}
```

| Field | What it holds |
|---|---|
| `nodes` | A node id to its `[x, y]` in world coordinates |
| `edges` | An edge key to its bow: how far the arrow bends |
| `ports` | An edge key to where its ends meet their boxes (optional; see below) |
| `notes` | Free-text annotations |
| `frames` | A group id to its colour and icon (see below) |
| `tints` | A component's node id to its colour, `{ "tint": "teal", "strength": "bold" }`: the same tint values as a group's, drawn as the card's border and a faint fill (optional) |
| `badge` | The mark the design wears in the browse list, when its owner chose one (optional; see below) |
| `routing` | How edges are drawn: `bundled` or `curved`; absent is `orthogonal` (optional; see below) |

An edge key is `from>to`, or `from>to#n` for the n-th parallel edge between the same pair.

A box's size is never stored: the engine sizes it from the words it shows. Its width is one of
four steps (126, 176, 240 or 256 px), the least that holds its name and the line under it, so a
column of similar names comes out one width. A name stays on one line up to the 240 px box and
wraps onto two past that. On the canvas, dragging a selection lines its edges and centres up with
nearby boxes and group frames and shows a dashed guide; hold Alt to move it freely.

Resting the pointer on a component lights it, its edges in both directions and the components at
their other ends, and fades everything else but the group frames; on an edge, it lights the edge
and its two ends. An edge to a group counts for every component inside it. A click pins that
highlight, so it stays when the pointer moves away, until Esc, a click on empty canvas, or a click
on something else (which pins that instead). Esc drops a pin before it clears the selection.
Panning and zooming keep the highlight; a drag that moves something (a component, a group, an
edge's run or label, a sweep) puts it away until you let go, and a pin comes back after.

**Alt-click** a component (or select it and press **T**, or choose **Trace flow** from its menu)
for the flow lens: everything upstream of it lights up, walking incoming edges back as far as they
go, and the rest fades. A component nothing points at, such as a client that only sends, traces
downstream instead. The lens is a pin: Esc or a click on empty canvas clears it.

A design with more than 15 edges draws its edges, their labels and auth glyphs at a quarter ink,
components at full; hovering or pinning lights the ones you ask about, and selecting an edge or
drawing a new one brings every edge back to full ink. The zoom menu's **Dim edges** switches it
between auto, on and off; the choice is kept in this browser only, not in the sidecar, and exported
pictures are never dimmed.

## Edge style

`routing` says how the edges are drawn. Without it they are orthogonal: horizontal and vertical
runs with rounded corners. `curved` draws curves. `bundled` is orthogonal with shared trunks: the
edges that leave one side of a box (or of a group's frame) toward boxes facing that side leave from
one point and run along one trunk before they split off, and the edges from several boxes into
one side of a box merge onto one trunk before they meet it. A bowed or shaped edge, or one whose
own runs would cut a box, is routed on its own. Pick it in Design settings under **Edges**.

A **port** pins one end of an arrow to a point on its box's border instead of the point the
line from centre to centre would cross. It is `{ "side": "top" | "right" | "bottom" | "left",
"t": 0..1 }`, where `t` runs left to right along the top and bottom and top to bottom along the
sides. An edge may carry a port at its `from` end, its `to` end, both or neither, and the field
is left out when no edge has one. A ported end always leaves its box squarely: a short straight
stub out of that side, then a curve to the other end, so a port on the far side of a box never
sends the line back under it. On the canvas you set one by dragging a selected arrow's end
along its own box; "Reset ends" on the arrow's menu clears it. Dragging the end onto another
component instead is not a layout change: it reconnects the edge, which changes `from` or `to`
in the YAML.

A design with no sidecar is not a design with no picture: the deterministic layout in
`packages/core/layout.js` places it, and every renderer uses that same implementation. The
sidecar only records where a human moved something.

> [!NOTE]
> The sidecar is read through one function that drops anything malformed rather than throwing.
> A sidecar that has drifted out of step with the document — a position for a node that was
> deleted — costs you that position and nothing else.

## Notes

A note is a free-text annotation on the canvas. It is emphatically **not** a node: it has no
component, it takes no edges, no rule ever sees it, and adding one does not change a byte of the
YAML.

A note carries at most one **anchor**, naming either a node or a group by the id the document
uses. That is the only place in the sidecar that refers to the document at all.

- **Unanchored:** `x`/`y` are the note's own top-left corner on the canvas.
- **Anchored:** `x`/`y` are an offset from the **top-right corner** of the target's box. The
  default offset puts the note just outside that corner — and that same corner is where the
  "notes here" marker appears when they are hidden, so one corner explains both.

Because the anchor is an id, moving a node carries its notes along, and renaming a node in the
YAML editor leaves the note pointing at nothing, which the canvas shows rather than hides.

## Group colour and icon

A group can carry a colour and an icon drawn before its name. Both are presentation, so both
live in the sidecar under `frames`, keyed by the group's id. The YAML never changes and no rule
ever reads them. Set them from the group's panel in the canvas inspector; each change can be
undone like any other edit.

- **`tint`** is one of a set of names, `slate`, `blue`, `green`, `amber`, `rose`, `violet` and
  `teal`, or a colour written `#rrggbb` (six hex digits; it is stored in lowercase). It sets the
  dashed stroke and a very light fill of the same colour. A named tint has separate values for
  the light and dark themes; a hex colour is used as it is in both, so pick one that reads on
  either background. The inspector's colour field has a swatch per name, then "More colours":
  a palette of 48 colours, the ones you applied lately, a hex box and the system colour picker. Leave `tint` out to get the default frame.
- **`strength`**, beside a tint on a group or a component, is `light` (half the fill), `normal`
  (the default, never stored) or `bold` (double the fill); the stroke stays as it is.
- **`icon`** is a reference, never the icon itself. It takes one of three forms:
  - `boundary:<id>` for a group icon (the user-facing word is group; boundary stays in the stored format), for example `boundary:aws` or `boundary:on-premises`.
    This is a separate set made for groups: platform and brand marks (AWS, Azure, Google
    Cloud, Kubernetes, GitHub, Anthropic and others) and concept marks (cloud, on-premises,
    internet, users, office, region, security, network, the development, test and production
    environments and others). The files live in `icons/boundaries/`, the file name is the id,
    and their display names are in `locales/en.yaml` under `boundaryIcons`. The inspector's
    picker lists them first.
  - `kind:<kind-id>` for a kind glyph, for example `kind:queue`.
  - `component:<provider>/<component-id>` for a catalogue component's icon, for example
    `component:aws/lambda`.

  A reference to an icon the catalogue does not have draws nothing, and the label stays where it
  was.

The reader drops anything else: a tint that is neither a name on the list nor `#rrggbb` (so not
`#rgb`, not an alpha byte, not `rgb()` or a colour name), an icon reference in the wrong
shape, or a style for a group the design no longer has. Deleting a group deletes its style
too, and renaming a group moves its style with it.

Exports keep both. The SVG and PNG you export from the canvas, and the as-drawn SVG from the
render API, draw the tint and the icon exactly as the canvas shows them.

## The list badge

Each row of the browse list wears a small mark in the corner of its thumbnail. By default it is
chosen for you: a curated design of a well-known product wears that product's mark, and any
other design wears the mark of the provider most of it is built on, when one clearly dominates.

The owner can choose it instead: **⋯ → Badge…** on the design page. The picker offers
"Automatic", every provider mark and every group mark (the `boundary:` set above, brands and
concepts alike). The choice is stored in the sidecar as `badge`:

- `provider:<id>`: a provider, the folder name under `components/`, for example `provider:gcp`.
- `boundary:<id>`: a group mark from `icons/boundaries/`, for example `boundary:google`.

Nothing else is a badge (`kind:` and `component:` references are dropped), and a reference the
catalogue does not know falls back to the automatic choice. Leave `badge` out for automatic.

The badge is not part of the picture: exports and the thumbnail itself never draw it, and
choosing one does not change the thumbnail's cache key. Choosing it is a layout-only save, the
same as moving a box on the canvas: it goes into the head version, folding into your unreleased
draft when there is one and starting one otherwise. Your own listing shows it at once; readers
see it once the draft is published. The canvas keeps a badge it did not set, so saving there
never loses it.

## Getting at it

`GET /api/v1/designs/{owner}/{slug}/layout` returns the sidecar for the current version, or for a
specific one with `?version=`. It answers `null` where a design has none.
`PATCH` on the same address with `{ "badge": "provider:gcp" }` (or `null`) sets the list badge.
See [the API](/docs/api#designs).

For rendering, you do not need the sidecar at all:

```bash
zeema render architecture/checkout.zeema.yaml --format svg --out checkout.svg
zeema render architecture/checkout.zeema.yaml --format mermaid
```

Both go through the same layout the canvas uses, so the picture is always current with the
document and never with a stale copy of it.
