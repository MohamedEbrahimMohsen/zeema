# Zeema — design brief

A brief for redesigning the Zeema web app. Everything below describes what the app *does today*
(pages, data, states, actions) so the new design covers real behaviour, plus a short list of
things the current UI lacks and the new design should add. Nothing here is decoration for its own
sake: every page exists because a user needs to do the thing on it.

---

## 1. What Zeema is

**Architecture as typed, queryable data.** A normal diagram is a picture. A Zeema design is a
model: every box is a component from a curated catalogue with real properties, the promises the
system makes are written down as *requirements*, and *rules* check the two against each other and
report *findings*.

Three layers, always in this order:

| Layer | What it is | Example | Count |
|---|---|---|---|
| **Kind** | An abstract category with typed properties | `queue` has `delivery`, `ordering`, `deadLetterQueue` | 72 |
| **Component** | A concrete product of exactly one kind, with the defaults that product really has | `sns` is a `pubsub-topic` on `aws`, and it cannot replay | 1,927 |
| **Design** | Nodes (components), directed edges, nested boundaries, and requirements | "YouTube", "Order processing" | 68 curated + user-made |

Every number in this section is the catalogue as it stood at the time of writing; the product
derives them from the bundle. Plus **38 rules** — declarative predicates such as *"Cache 'x' is the primary store for its data
but has persistence disabled"* (error) or *"Cache 'x' has no eviction policy"* (warning).

Kinds fall into **9 categories**: `compute`, `edge`, `data`, `ops`, `security`, `messaging`,
`client`, `external`, `custom`. Components come from **12 providers**: `default` (801,
vendor-neutral products like Kafka, Redis, Postgres, GitHub, Stripe, Slack), `aws` (286), `gcp`
(228), `azure` (195), `oci` (168), `cloudflare` (98), `alibabacloud` (69), `openstack` (22),
`ibm` (21), `k8s` (17), `outscale` (12), `digitalocean` (10).

**Who uses it.** Software architects and senior engineers. They read curated reference designs
of well-known systems (YouTube, Twitter timeline, Slack messaging, DoorDash delivery, URL
shortener, rate limiter, web crawler…), clone one, and edit it — on a drag-and-drop canvas or
directly as YAML. The tone should be precise and technical, never playful; think of a tool a
principal engineer opens every day, not a marketing site.

---

## 2. Visual foundations

### 2.1 Icons — the biggest asset the current design ignores

The repo ships **2,275 SVG icons** (at the time of writing), all `24×24`, and the current UI
barely uses them:

- `icons/components/<provider>/<id>.svg` — one per component. For **aws, azure and oci** this is
  the **vendor's own product icon in the vendor's own colours** (the AWS Architecture Icons, Azure
  Public Service Icons, OCI toolkit). For everything else it is a monochrome line glyph of the
  kind, with a small round **provider badge** in the bottom-right corner (a brand mark from
  Simple Icons: GitHub, Stripe, Slack, Kafka, Google Cloud, Cloudflare…).
- `icons/kinds/<kind>.svg` — one generic line glyph per kind (a cylinder for a database, a gear for a
  worker, a funnel for a queue…). Monochrome, `stroke="currentColor"`, so they follow the theme.
- `icons/providers/*.svg` — 276 brand marks.

**Design rule: wherever a component or design is listed, lead with the picture.** A card, a
palette row, a table row, a node on the canvas — the icon comes first, the name second, the id in
monospace third. A user scanning for "the SQS queue" should find the orange SQS mark before they
read a word.

### 2.2 Cards must be visual — the YouTube case

Design cards (Home, Browse, Profile) currently show a title, a summary, a username and some
counts. The new card should be **dominated by an image**:

1. If the design has a **brand mark** (the design of YouTube → the YouTube logo; Slack messaging
   → the Slack logo; Twitter timeline → the X/Twitter mark; DoorDash → DoorDash), the card is
   essentially that logo in a large, centred image area, with the title underneath. Nothing else
   competes with the logo. *(This needs a new optional `brand`/`logo` field on a design; the
   design should assume it exists.)*
2. Otherwise, show a **thumbnail of the rendered diagram** (the app can render any design to SVG;
   the API already exposes `/render`). A faint, zoomed-out picture of the boxes and arrows.
3. Otherwise — a brand-new empty design — show the **title set large** in the image area, on a
   tinted background derived from the design's dominant provider colour.

Below the image: title, one-line summary (may be empty → don't leave a hole), owner avatar +
`@username` (or "zeema" for curated designs), component count, provider chips (`aws`, `azure`
… never `default`), and the two stats `clones · exports`. Small tags where relevant: `private`,
and for curated designs their origin (`reference`, `imported`).

The same rule applies to **component cards** in the Catalogue and **palette rows** in the canvas:
the product icon is the visual anchor; for `default`-provider components with no brand
(`cron-job`, `webhook-receiver`) the kind glyph is the picture.

### 2.3 Colour, light and dark

Today: two palettes, switched by `prefers-color-scheme` only; there is **no theme toggle**.
The new design needs a **three-state theme control** (System / Light / Dark) in the header. When
the user picks Light or Dark the `<html>` element gets `data-theme="light|dark"`; System stamps
nothing and the OS decides.

Current tokens (keep the *roles*, feel free to change the values):

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#fafaf8` | `#131315` | page ground (warm off-white, not pure white) |
| `--panel` | `#ffffff` | `#1b1b1f` | cards, header, side panes |
| `--ink` | `#1b1b19` | `#ececea` | text |
| `--muted` | `#6b6b66` | `#a1a19c` | secondary text, ids, counts |
| `--line` | `#e4e4df` | `#2c2c31` | borders |
| `--accent` | `#2f5fd0` | `#7ea2f0` | primary buttons, selection, links |
| `--ok` / `--warn` / `--err` | green / amber / red | lighter versions | finding severities |

**Severity is a first-class colour.** Findings are `error` (red), `warning` (amber), `info`
(muted). These appear on the design page, in the editor, in the canvas side pane and as badges
on nodes. They must read instantly in both themes.

The canvas also has **eight tinted node fills** keyed to kind category (blue, teal, amber, violet,
purple, green, rose, red, grey) with a matching line colour, each in a light and a dark variant.
Keep this: a reader tells "messaging" from "data" by fill colour before reading the label.

Vendor product icons carry fixed brand colours (AWS orange, Azure blue, OCI red) and must sit on
both themes without a white box behind them.

### 2.4 Typography

System sans (`ui-sans-serif, system-ui, Segoe UI, Roboto`) for UI; a **monospace** face for
every identifier — component ids (`aws-api-gateway`), design slugs, rule ids
(`cache-missing-eviction-policy`), YAML. Identifiers are everywhere in this product; the mono
face is how a user tells *the name* from *the id*.

### 2.5 Components of the design system to define

Buttons (default, primary, danger, disabled), text input, select, checkbox/radio, `tag` (pill
chip), `panel` (12 px radius card), tables, `details/summary` disclosure, context menu, inline
status text ("saving… / saved / unsaved / conflict"), a finding row (severity dot + message +
rule id), an empty state, a 404.

---

## 3. Global chrome

**Header** (every page except the canvas, which has its own toolbar): wordmark "Zeema" at left;
nav links **Browse · Catalogue · Docs**; at right, signed-out → **Sign in** (primary); signed-in
→ **New design** (primary), avatar + `username` (links to the profile), **Sign out**. Add the
**theme toggle** here.

**Page container**: max-width ~1152 px, centred, 24 px side padding. The canvas page breaks out
to full viewport.

**404**: "Not found — There is no design or person at this address, or it is private." with a
"Browse designs" button.

---

## 4. Pages

### 4.1 Home — `/`

Two-column hero:

- Left: headline *"Architecture as typed, queryable data."*; one paragraph explaining
  picture vs model; two buttons **Browse designs** (primary) and **Create your own** (goes to
  sign-in first if signed out); three live counters — kinds, components and rules, read from the
  bundle rather than written into the copy.
- Right: a code panel showing a tiny YAML design and, as a comment, the rule it trips
  (`pubsub-replay-required fires: the design requires replay, and SNS cannot replay`). This is
  the product's whole pitch in one panel — give it presence. A rendered mini-diagram next to the
  YAML would be even better than the YAML alone.

Below: **"Most cloned"** — six design cards (see §2.2) and a "See all" link to Browse.

### 4.2 Browse — `/browse`

The catalogue of *designs*.

- Title "Browse" (or **"My designs"** when filtered to the signed-in user), count "N designs",
  and a toggle link "Show only mine / Show public designs" (signed-in only).
- Filter bar: free-text search (title, summary, components), **Provider** select (aws, azure,
  gcp, oci, cloudflare, default), **Kind** select (every kind, by display name), **Sort**
  (Recently updated · Newest · Most cloned · Most exported), Filter button. Filters are URL
  query parameters — a filtered view is a shareable link.
- Grid of design cards, 3 across on desktop, 2 on tablet, 1 on phone. **This is the page the
  YouTube-logo requirement is about**: a card for the "youtube" design shows the YouTube logo.
- Empty state: "Nothing matches." (+ "Create a design." when in My designs).
- Pagination: ← Previous · Page 2 of 5 · Next →.

### 4.3 Catalogue — `/catalogue`

The catalogue of *kinds and components*. Today it is a plain table and a grid of text tiles;
this page needs the most rework.

- Header: "Catalogue" + a sentence built from the live counts: *"N kinds, M components across
  P providers, R rules. A kind is the abstract thing (a queue); a component is the concrete
  product (Kafka, SQS) with its real defaults."*
- Search box for components (matches id, name, description).
- **Kinds grid**, grouped by the 9 categories. Each kind tile: the kind glyph, the display name
  ("Queue"), the category tag, "N components · M properties". Clicking a kind filters the
  component list to it.
- **Components list** (appears when a kind or a search is active; capped at 300): each row/card
  shows the **product icon**, display name, mono id, provider chip, kind. Provide both a dense
  list and a card view if it helps; the icon must be present in either.
- **Kind detail** (currently missing — design it): the kind's properties as a typed table
  (name, type, enum values, default, required), and its components.
- **Component detail** (currently missing — design it): big icon, name, id, provider, kind, the
  description, and the **defaults** it overrides (`sns`: `delivery: at-least-once`,
  `managed: true`, `ordering: none`, `replay: false`) plus its own extra properties
  (`fifo: boolean`). Link to designs that use it.
- **Rules** (currently not shown anywhere as a list — design it): a list/table of every rule:
  severity dot, rule id (mono), human name, the message template, and what it selects
  (`node.kind = cache`). Filter by severity and by the kind it targets.

### 4.4 Docs — `/docs`

A single long-form article, ~3 col-width, sections: **Three layers · Rules · Writing a design
(YAML example + four bullet conventions) · In your repository (three CLI commands) · On this
site**. Design as readable documentation: generous line length, code panels, a sticky
section index on wide screens.

### 4.5 Sign in — `/signin`

Narrow centred card. Title "Sign in", explanation: *"Reading is open to everyone. Creating,
cloning and publishing designs needs an account, and the account is your GitHub identity. Zeema
never sees a password."* One primary button **Continue with GitHub** (OAuth; on return the user
lands on `?next=` or their profile). States: an error line ("Sign-in failed: …"), a "not
configured on this server" notice, and — dev only — a small "Local development account" form
with a username field and "Sign in locally". No password field ever exists.

### 4.6 New design — `/new` (signed-in only)

Two-column form. Left panel: **Title** (required, ≤120), **Summary** (≤280, "One line for the
browse card"), **Design YAML** (a tall mono textarea, pre-filled with a starter design). Right
column: **Visibility** radio — *Private (only you)* / *Public (anyone can read, clone, export)*
— default private; primary button **Create and open the editor**; error line; a note that the
design must be structurally valid to be created. Consider a template picker (blank / starter /
clone a reference) — the starter YAML is the only option today.

### 4.7 Design page — `/d/<owner>/<slug>`

The read view of one design. Public designs are readable by everyone, signed in or not.

- Breadcrumb `@owner / slug` (or `zeema · reference / slug` for curated designs).
- Title, summary.
- Stat row: `N components · N edges · N boundaries · N views · N clones · N exports`, a
  `public|private` tag, and a `broken twin` tag when viewing one (see below).
- **Action bar** (varies by permission):
  - Owner: **Open in canvas** (primary), **Edit YAML**, **Clone**, **Export SVG**, **YAML**
    (raw), **Make public / Make private**, **Delete** (danger; confirm).
  - Signed-in non-owner: **View in canvas**, **Clone**, **Export SVG**, **YAML**.
  - Signed-out: **View in canvas**, **Sign in to clone**, **Export SVG**, **YAML**.
  - Curated designs cannot be made private or deleted, only cloned.
- Curated reference designs have a **"broken twin"**: a link *"See the deliberately broken twin
  and the rules it trips →"* swaps the page to a variant that violates rules, with *"← Back to the
  clean design"*. Design this as a clear mode switch — the reader must know which one they are
  looking at.
- Main column: the **rendered diagram** (server-side SVG, the same drawing the canvas shows,
  responsive, max ~70 vh) and a collapsible **YAML** panel.
- Side column (360 px): **Findings** (count line "2 errors · 1 warning · 0 info"; each row =
  severity label, rule id, message; empty state "No findings. Every rule is satisfied."),
  **Promises** (the requirements as `group.key → value` rows, e.g. `messaging.replay → true`),
  **Components** (each node: label, then product name · provider — add the icon).
- A `?v=` query shows a historical version; there is a versions API but no versions UI —
  design a **version list** (every save is a version).

### 4.8 YAML editor — `/d/<owner>/<slug>/edit` (owner only)

Two columns. Left: an editor panel with a header bar — title, status word (`unsaved · saving… ·
saved · conflict · error`), **Save** (primary; disabled until valid and changed; Ctrl+S) and
**Done**; the tall mono textarea; an error strip at the bottom for the conflict message
(*"This design changed since you opened it. Reload to see the latest version, or copy your text
and clone."*). Right (360 px): **Structure** (green "Structurally valid. Save is enabled." or a
red list of blocking errors), **Rules** (rule findings with severity-coloured ids, or "No rule
fires."), **Preview** (the rendered picture, refreshed after each save). Findings update live,
300 ms after typing stops.

### 4.9 Profile — `/u/<username>`

Avatar (64 px, grey circle fallback), display name, `@username`, bio. Section "Your designs" /
"Public designs" with a count and the card grid; empty states *"Nothing yet. Create a design or
clone one from Browse."* / *"No public designs yet."*

### 4.10 Canvas — `/d/<owner>/<slug>/canvas` — the heart of the product

Full-viewport editor, no site header. Layout: **toolbar** across the top; below it three
columns **palette (260) · scene · inspector (320)**.

**Toolbar**, left to right: `← <design title>` (back); then by permission — owner: **Save**
(primary, disabled while a structural error exists) + **auto** checkbox (autosave); non-owner:
**Clone to edit**; signed-out: **Sign in to clone**. A status word (`saved`, `unsaved`,
`saving…`, or a red `conflict`/`save failed`). Divider. **Undo · Redo · Fit · Arrange · SVG ·
PNG · Clone**. Right-aligned: a summary of findings (e.g. "1 error · 3 warnings", red when
blocking) and a **?** help toggle. This bar is crowded today — group it (file / edit / view /
export) with icon buttons and tooltips showing the shortcut.

**Palette** (left): a search box with the placeholder `Search components… kind:queue
provider:aws` (the query accepts `provider:`, `kind:`, `category:` filters); results grouped
under category headers (`compute`, `data`, `messaging`…), each row = **product icon (20 px) ·
display name · kind** (muted, right). Drag a row onto the scene, or double-click to place.
Shows the first 60; "N more, keep typing". Empty: "Nothing matches. Try a product name, or
kind:queue." The icon is the point of the row — make it larger than 20 px if the row can take it.

**Scene** (centre): a dotted-grid ground (24 px dots) on `--bg`. Elements:

- **Node**: a rounded rectangle (8 px radius) filled with its category tint, the component
  icon centred at the top (24 px), the node label (14 px, medium) and the component id (12 px,
  mono, muted) below. Selected → accent stroke 2 px; multi-selection's primary → thicker.
  Nodes with findings carry a small red or amber **badge** in a corner. A node being wired to
  glows accent. Cursor: grab.
- **Edge**: 1.2 px line with an arrowhead; **async edges are dashed**; optional label with a
  background knock-out; edges can be **bowed** (curved) by dragging their middle. Selected →
  accent.
- **Boundary / group frame**: a dashed rounded rectangle (`--frame` colour) computed from its
  members, with the label at the top-left (`label` or `id (kind)`); nested boundaries nest
  visually (region ▸ availability-zone ▸ vpc). Selected → accent dashed. Cursor: move on the
  border and label (the whole group drags).
- **Wiring handle**: a small circle on a selected node; drag it to another node to create an
  edge; a live dashed wire follows the pointer.
- **Marquee**: accent-tinted rectangle when dragging on empty space.
- **Inline edit**: a floating text input over a label on double-click.
- **Empty state** (no nodes): "Drag a component from the palette, or double-click one to place
  it."
- **Help card** (the `?`): a 300 px floating panel listing the gestures — drag from palette or
  double-click; drag the dot to wire; drag an edge to bow, right-click to reverse or switch
  sync/async; drag on empty space to marquee, Shift-click adds; middle button or Space+drag
  pans, wheel zooms; double-click a label to rename, Enter edits; G groups, Ctrl Shift G
  ungroups; Ctrl D duplicates, Delete removes, arrows nudge (Shift ×10); Ctrl Z / Ctrl Y, Ctrl
  S, Ctrl 0 fits.
- **Context menu** (right-click on node / edge / boundary / empty space): a 190 px floating
  menu, items with a right-aligned shortcut hint, separators, a red danger item (Delete),
  disabled items dimmed. Actions include group / ungroup, duplicate, delete, reverse edge,
  sync ↔ async, arrange.

**Inspector** (right) — every control is generated from the catalogue, so the design is a
*form language*, not fixed screens. A field = label (muted; **bold when the value is explicitly
set** vs inherited) · control · a small "resolved" note under it (type, `required`, or the
inherited value, shown as the placeholder `unset (at-least-once)`). Panels by selection:

- *Nothing selected → Design*: `id`; "N nodes · N edges · N boundaries"; **Requirements** —
  14 collapsible groups (`availability`, `consistency`, `correctness`, `data`, `durability`,
  `freshness`, `isolation`, `latency`, `messaging`, `money`, `observability`, `security`,
  `traffic`…), each with 1–6 typed fields (booleans, enums, integers, patterned strings); a group
  shows "· 2 set" and opens automatically when anything in it is set.
- *Node*: `label`, `id` (kebab-case, unique), `component` (a select of sibling components of the
  same kind — swap SQS for Kafka in place), the component description, **Properties** (the kind's
  typed properties: boolean/enum/integer/string controls with the resolved default as
  placeholder), **Non functional** (`rps`, `latencyP95Ms`, `consistency`), **Group** (select),
  **Delete node** (danger).
- *Edge*: `from`, `to` (node selects), `protocol` (required), `mode` (sync/async), `delivery`
  (async only), `label`, `timeoutMs`, `retryPolicy`, `idempotent`, `circuitBreaker`, `fallback`,
  `batched`, **Delete edge**.
- *Boundary*: `label`, `id`, `kind` (region, availability-zone, vpc, trust-zone, system, cell,
  point-of-presence), `parent` (a cycle is refused), "N members", **Delete boundary**.
- *Multi-select*: a note "3 components selected. Right click for group, duplicate and delete.
  The fields below edit the last one you clicked."

Below the inspector: **Findings** — structural errors first (red, "structural"), then rule
findings (severity dot, message, rule name · `node api`); clicking a finding centres the canvas
on its subject. Empty: "Nothing to report. The design is valid and trips no rule."

**Canvas states to design**: read-only (non-owner: everything visible, nothing editable,
"Clone to edit" prominent); blocking error present (Save disabled with tooltip "Fix structural
errors first"); autosave on; save conflict; catalogue still loading ("Loading the catalogue…").

---

## 5. Things the new design should add (not in the app today)

1. **Theme toggle** (System / Light / Dark) — §2.3.
2. **Visual design cards** with brand logo → diagram thumbnail → large title fallback — §2.2.
3. **Icons everywhere a component is named** — catalogue rows, design page component list,
   inspector component select, palette (bigger).
4. **Kind detail, component detail and a Rules page** in the Catalogue — §4.3.
5. **Version history** on the design page.
6. **Toolbar grouping** on the canvas with icon buttons and shortcut tooltips — §4.10.
7. A **mobile/tablet story** for the read pages (Home, Browse, Catalogue, Design, Docs,
   Profile). The canvas is desktop-only and may say so.
8. Consistent **empty, loading, error and confirm** states (delete and make-public currently
   use the browser's `confirm()` dialog — design proper dialogs).

---

## 6. Constraints the design must respect

- All icons are 24×24 SVG and monochrome ones inherit `currentColor`; vendor icons are
  full-colour and must not be recoloured.
- Identifiers are always monospace and never truncated in a way that hides the provider prefix
  (`aws-`, `azure-`, `oci-`, `gcp-`, `cloudflare-`).
- Severity colours (error / warning / info) are the same tokens on every page.
- Findings never block reading; structural errors block saving. The UI must make that distinction
  visible (red list under "Structure" vs the rule list).
- Reading requires no account. Every write action must show the sign-in path when signed out.
- Positions are not part of a design; the picture is computed or stored in a layout sidecar. The
  design page's rendered SVG and the canvas must look like the same drawing.
