# Referencing another design (2026-10-09)

Source: system designs reuse one another. The News Feed design draws a "Notification Service"
box, and Notification System is a design of its own on the platform. Today the box says nothing
about that: a reader cannot get from the box to the design that explains it, and an author cannot
say which version of it they drew against.

## What the format gains

- Node field `ref`: the design this node stands for, pinned to a release or following head.

```yaml
- id: notifications
  component: azure-notification-hubs
  label: "Notification Service"
  ref:
    design: "mohamedebrahimmohsen/notification-system"
    version: 3
```

- `ref.design` (required): `owner/slug`, the owner's GitHub login and the design's slug.
- `ref.version` (required): a release number, 1 or more, or `"head"`.
- Nothing else under `ref`. A URL is never stored; the app builds it from `CANVAS_URL`.
- The node stays an ordinary typed node: component, props, edges and rules are unchanged. The
  reference is an annotation.
- A malformed `design` or `version` is a structural error with the node's line. That the target
  exists is remote state, not structure, and is never checked by the engine. A design referencing
  itself is not detected either: the document does not know its own owner.

## What the canvas does

- A link disc at the node's bottom-right corner, the same disc as the edge auth glyphs, with a
  chain-link mark. The server-rendered SVG draws it in the muted colour (it has no remote state);
  the canvas tints it by state.
- Hover: a card with the referenced design's name, owner, release and thumbnail.
- Click: a preview popup of the referenced design. Shift-click: open it in a new tab.
- Four states: current (the pinned release is the latest, or the ref follows head), newer release
  available, unreachable (private now, or the platform did not answer), deleted.

## Limits, for now

- Public targets only. A private design is a 404 to everyone but its owner, so a reference to one
  would show its existence to readers who cannot open it.
- Rules never cross designs: a rule reads the node in this design, never the design behind it.
- No reverse index: a design does not list the designs that reference it.
