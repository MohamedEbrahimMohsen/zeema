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
  "notes": []
}
```

| Field | What it holds |
|---|---|
| `nodes` | A node id to its `[x, y]` in world coordinates |
| `edges` | An edge key to its bow: how far the arrow bends |
| `notes` | Free-text annotations |

An edge key is `from>to`, or `from>to#n` for the n-th parallel edge between the same pair.

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

A note carries at most one **anchor**, naming either a node or a boundary by the id the document
uses. That is the only place in the sidecar that refers to the document at all.

- **Unanchored:** `x`/`y` are the note's own top-left corner on the canvas.
- **Anchored:** `x`/`y` are an offset from the **top-right corner** of the target's box. The
  default offset puts the note just outside that corner — and that same corner is where the
  "notes here" marker appears when they are hidden, so one corner explains both.

Because the anchor is an id, moving a node carries its notes along, and renaming a node in the
YAML editor leaves the note pointing at nothing, which the canvas shows rather than hides.

## Getting at it

`GET /api/v1/designs/{owner}/{slug}/layout` returns the sidecar for the current version, or for a
specific one with `?version=`. It answers `null` where a design has none. See
[the API](/docs/api#designs).

For rendering, you do not need the sidecar at all:

```bash
zeema render architecture/checkout.zeema.yaml --format svg --out checkout.svg
zeema render architecture/checkout.zeema.yaml --format mermaid
```

Both go through the same layout the canvas uses, so the picture is always current with the
document and never with a stale copy of it.
