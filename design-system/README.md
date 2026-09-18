# Zeema Design System

Zeema is a tool for describing software architecture as **typed, queryable data** rather than
as a drawing. Its own framing, from the source artifact:

> A diagram is a picture. A Zeema design is a model: components with real properties,
> requirements, and rules that check them.

Everything in this system follows from that one sentence. A node on the Zeema canvas is not a
box with a label — it is an instance of a component *kind* with a schema, properties that are
either set or inherited, and rules that can fail against it. The visual language exists to make
that distinction legible: what a human authored versus what the system knows.

---

## Sources

This system was derived from a single design artifact supplied by the user:

- **Artifact:** `https://claude.ai/code/artifact/1985e013-1ef0-44f6-9d36-9479e7ba0b96`
- **Local export:** `uploads/Zeema/` — `Design System.dc.html` (the three-direction board) and
  `DS Sheet.dc.html` (the specimen sheet rendered once per direction per theme).
- **Icons:** `uploads/Zeema/icons/` — 48 SVGs across `components/`, `kinds/` and `providers/`,
  copied verbatim into `assets/icons/`.

The artifact explored three directions — **1a Instrument** (compact, system sans),
**1b Atlas** (airy, Geist + Source Code Pro), **1c Blueprint** (medium density, Geist +
JetBrains Mono, mono uppercase labels, indigo accent).

**This system canonicalises 1c Blueprint.** Its drafting-table character — mono uppercase
section labels, a 8px/4px radius split, indigo rather than the generic blue — matches a product
whose subject is engineering schemas. Instrument's and Atlas's token values are recoverable from
the artifact if the direction is ever revisited; the token structure here (one `--p` density
scalar, one `--fs` base, a `--lab-*` label recipe) is exactly what let the artifact swap between
all three from a single declaration, and that flexibility is preserved.

No codebase or Figma file was supplied. Component behaviour beyond what the specimen sheet shows
is inferred from the sheet and is marked as such where it matters.

---

## Content fundamentals

Zeema's copy is written by engineers, for engineers, and it never pretends to be friendlier
than the situation.

**Two registers, strictly separated.** Prose is sentence case and grammatical. Identifiers are
lowercase-hyphenated or camelCase and are never prettified for display. The same property is
`deadLetterQueue` in a checkbox label and `deadLetterQueue` in the schema table — Zeema does not
translate machine names into "Dead letter queue", because the reader will type the machine name.

**Findings state the problem and the consequence.** Not "Invalid cache configuration" but:

> Cache 'session' is the primary store for its data but has persistence disabled.

The offending node is named in single quotes. The sentence ends in a full stop. Underneath,
always, the machine coordinates: `cache-as-primary-store-without-persistence · node session`.
A finding a reader cannot act on is a bug.

**Descriptions are one sentence, and they describe behaviour, not marketing.**
"Upload, transcode, serve at scale." · "Checkout to fulfilment with a replayable log."
Verb-first where possible, no adjectives of praise, full stop at the end.

**Status is lowercase and unpunctuated.** `saving…` (a real ellipsis character) · `saved` ·
`unsaved` · `conflict`. No icons, no "Your changes have been saved!".

**Empty states suggest the next query rather than apologising.**

> Nothing matches. Try a product name, or `kind:queue`.

The suggestion is rendered in mono, because it is something to type. Page-level empties state the
two possible causes plainly: "There is no design or person at this address, or it is private."

**Counts are always shown, including zeros.** `2 errors · 1 warning · 0 info` — the zero tells
you the info checks ran.

**No emoji. No exclamation marks. No second-person cheerfulness.** The product says "you" only
when describing the user's own artefacts, and mostly avoids the pronoun entirely.

---

## Visual foundations

### Colour

The neutral system is warm-grey, not blue-grey: `#fafaf8` page, `#ffffff` panel, `#1b1b19` ink.
That warmth is what keeps a screen full of pastel taxonomy fills from reading as clinical.

One accent: indigo `#3f4fc4` (light) / `#98a6f2` (dark). It appears on the single primary action,
on selection borders, on active menu items, and on form control accents — nowhere else.

Three status hues — `--ok` green, `--warn` amber, `--err` red — and a hard rule: **status colours
tint text, dots and borders, never fills.** A destructive button is a normal panel button with a
red label. This is deliberate; on a canvas already carrying nine coloured fills, a red button
would read as another category.

The **taxonomy** is the one palette that carries meaning: nine fill/line pairs mapped to component
categories — compute (blue), edge (teal), data (amber), ops (violet), security (purple),
messaging (green), client (rose), external (red), unset (grey). Fills are 6–8% saturated so a
dense diagram stays legible; lines are the same hue at working strength.

**Dark is authored, not inverted.** Its accent lightens to `#98a6f2` and its `--accent-ink` goes
dark navy; the taxonomy pairs are re-picked at low luminance rather than algorithmically flipped.
The only mechanical piece is `--icon-filter: invert(1) hue-rotate(180deg)`, applied to
provider logos only.

### Type

Geist for everything a human wrote; JetBrains Mono for everything the system owns — slugs, rule
ids, type hints, property keys, keyboard shortcuts, provider tags. This division is the single
most load-bearing typographic decision in the system. A reader can tell at a glance whether a
string is a name they chose or a name the schema imposed.

One display size (1.75em / 600 / −0.02em). Weight 500 is the workhorse emphasis — node names,
active nav, component names. 600 is reserved for headlines, the wordmark and field labels.

Section labels are the Blueprint signature: mono, uppercase, 0.08em tracking, 0.75em, `--muted`.
They name a *region* and never a value. The recipe is three tokens (`--lab-font`, `--lab-tt`,
`--lab-ls`) so it can be turned off wholesale for a different direction.

### Spacing and density

A single scalar, `--p: 8px`, multiplied. Blueprint's density sits between Instrument's 6 and
Atlas's 10; changing that one value retunes every gap, pad and section break in the product.
Base font is `--fs: 14px` and every other size is em-relative to it, so type rescales with the
same gesture.

### Radius

Two radii, and the ratio matters more than the values: panels 8px, controls 4px. Softer
containers, crisper controls — the combination reads as a drafting instrument rather than a
consumer app. Nested items subtract: a context-menu item is `calc(var(--rc) - 2px)`. Tags alone
are fully round.

### Borders, shadow and elevation

Zeema separates with lines, not shadow. Every panel, card, table and canvas is a 1px `--line`
on `--panel`. **Shadow appears on exactly one class of object: things that float above the
canvas** — context menus, popovers, dialogs. `--shadow-float` is `0 8px 24px rgba(0,0,0,0.12)`;
nothing else in the product is allowed one.

Boundaries (regions, VPCs, accounts) are dashed `--frame` and never filled — a fill would compete
with the taxonomy fills inside them.

### The canvas

A 1px radial dot at 14% ink on a 24px pitch, over `--bg`. Graph paper that is present when you
look for it and invisible when you are reading a diagram. Both values are tokens; never hard-code
a grid.

On a node, three channels carry three meanings and they are never crossed:

| channel | meaning |
|---|---|
| fill | component category (taxonomy) |
| border | selection — 2px `--accent`, replacing the category line |
| corner dot | worst unresolved finding on this node |

A selected node **keeps its category fill**. Losing it would break the reading of the whole
diagram at the moment the user most needs it.

Edges encode synchrony: **dashed is asynchronous** (queue, topic, stream), **solid is
synchronous** (a call). 1.2px `--muted` — the quietest marks on the canvas.

### Motion and interaction states

Two durations (`--dur-fast: 90ms` for hover/press, `--dur: 150ms` for selection and panel
open) and one easing, `cubic-bezier(0.2, 0, 0.2, 1)`. No bounce, no spring, no entrance
animation. Diagrams do not need to arrive.

- **Hover:** background or border shifts one step; nothing moves or scales.
- **Press:** no transform. The state change is the feedback.
- **Disabled:** `opacity: 0.45` with colours unchanged — the control stays recognisable.
- **Focus:** a 2px accent ring at 40% (`--ring-focus`), never a browser default outline.
- **Selection:** border swap only.

### Imagery, transparency, texture

There is no photography and there are no illustrations. The only non-UI imagery in the product
is a design's own thumbnail, which takes one of three treatments, in order of preference: a real
mini-diagram built from taxonomy fills; a vendor brand mark on a 135° hatch of `--bg`/`--panel`;
or a title plate on `--t-blue-fill`. No blur, no glass, no gradients anywhere — `color-mix` is
used only for the canvas dot and the focus ring.

---

## Iconography

Three classes, all supplied with the artifact, all in `assets/icons/`. They are rendered
differently on purpose, and `<Icon>` is the only sanctioned way to render any of them.

**`components/<provider>/` — 26 vendor product marks** (`aws/sqs.svg`, `azure/azure-cosmos-db.svg`,
`gcp/spanner.svg`, `cloudflare/cloudflare-workers.svg`, `oci/oci-streaming.svg`,
`default/kafka.svg`, `default/postgres.svg`, `default/redis.svg`, `default/stripe.svg`, …).
Full colour, **never recoloured**. In a canvas of neutral boxes, vendor brand colour is the
fastest identity signal there is. Rendered at `--icon` (24px) in rows and nodes.

**`kinds/` — 16 monochrome category glyphs** (`queue`, `worker`, `cache`, `cdn`, `client`,
`sql-database`, `nosql-database`, `object-store`, `stream`, `pubsub-topic`, `api-gateway`,
`load-balancer`, `identity-provider`, `monitoring`, `search-index`, `third-party-api`).
Lucide-family line icons, 24×24, 1.5px stroke, `currentColor`. These are applied as a **CSS mask**
rather than an `<img>`, so they inherit `--ink`, `--muted`, `--accent` or any tone and work on any
taxonomy fill. They are the fallback whenever a component has no vendor mark.

**`providers/` — 7 vendor logos** (`aws`, `azure`, `googlecloud`, `cloudflare`, `oci`, `github`,
`stripe`). Used small in chrome and filter chips, passed through `--icon-filter` so they invert
in dark mode.

Emoji are never used. Unicode is used for exactly two things: the middle dot `·` as a metadata
separator, and modifier glyphs in keyboard shortcuts (`⌃`, `⇧`, `⌘`, `⌫`). Never draw a new
Zeema icon by hand — take the nearest Lucide line icon at 1.5px stroke and add it to `kinds/`.

### Substitutions flagged

- **Fonts.** No binaries were supplied. Geist and JetBrains Mono are loaded from Google Fonts in
  `tokens/fonts.css`. If Zeema self-hosts these, replace that file with `@font-face` rules and
  drop the files into `assets/fonts/`.
- **No logo was supplied.** None has been drawn. The brand is set in Geist 600 at
  `letter-spacing: -0.01em` wherever a mark would go — see `guidelines/brand-wordmark.html`.
  **Send the real mark and it will be wired in.**

---

## Index

| Path | What it is |
|---|---|
| `styles.css` | Global entry point — `@import` list only. Link this one file. |
| `tokens/` | `fonts`, `colors`, `typography`, `spacing`, `radius`, `elevation`, `base` |
| `assets/icons/` | `components/` (26 vendor marks) · `kinds/` (16 glyphs) · `providers/` (7 logos) |
| `guidelines/` | 18 foundation specimen cards — Colors, Type, Spacing, Brand |
| `components/` | 22 React primitives in five groups |
| `ui_kits/zeema/` | Six-screen click-through recreation of the Zeema app |
| `ds-ns.js` | Bundle-namespace resolver used by the cards and the kit |
| `SKILL.md` | Agent Skills wrapper, for use in Claude Code |

### Components

| Group | Components |
|---|---|
| `components/core/` | `Button` `Tag` `StatusText` `SectionLabel` `Icon` |
| `components/forms/` | `Field` `TextInput` `Select` `Checkbox` `Radio` |
| `components/data/` | `ComponentRow` `PropertyTable` `Disclosure` `DesignCard` |
| `components/feedback/` | `Finding` `FindingsPanel` `EmptyState` |
| `components/canvas/` | `Canvas` `CanvasNode` `CanvasEdge` `Boundary` `ContextMenu` |

Every component has a sibling `.d.ts` (props contract) and `.prompt.md` (what, when, and the rules
that are easy to get wrong).

### Intentional additions

The specimen sheet showed these as raw markup rather than named components; they were factored
out because the kit needed them more than once.

- **`Icon`** — the sheet rendered three icon classes three different ways inline. Wrapping them is
  the only way the "never recolour a vendor mark / always mask a kind glyph" rule survives contact
  with a real screen.
- **`Canvas`** — the dotted ground was an inline background on the sheet. Extracted so the grid
  tokens have exactly one consumer.
- **`SectionLabel`** — the `--lab-*` recipe appeared on nine separate elements in the sheet.
- **`Panel`** (UI-kit local, not a published primitive) — layout scaffolding for the kit screens.

Nothing else was invented. There is no Toast, Avatar, Tabs, Tooltip or Dialog primitive here,
because the source defines none.
