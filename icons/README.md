# Icons

The visual vocabulary that matches the data vocabulary. Renderers draw a node by looking
up its component id here; nothing in `kinds/`, `components/` or `designs/` references an
icon, so the set can grow or be replaced without touching the model.

| Folder | Files | Contents |
|---|---|---|
| `kinds/` | 71 | One generic line glyph per kind. A queue, a cache, a cylinder, a gear. |
| `providers/` | 217 | Brand marks, used as the badge in the corner of a component icon. |
| `components/<provider>/` | 1623 | One per component, in the same provider subfolder as the component file. For `aws`, `azure` and `oci` this is the vendor's own product icon (see *Two styles* below); everywhere else it is the kind glyph, plus a provider badge where the component is a cloud service or a branded product. |

## Naming

**The file name is the id.** `icons/kinds/<kind-id>.svg`, `icons/components/<provider>/<component-id>.svg`.
`components/default/kafka.yaml` has `id: "kafka"` and `provider: "default"`, so its icon is
`icons/components/default/kafka.svg`; `components/aws/alb.yaml` maps to `icons/components/aws/alb.svg`. No
other lookup, no manifest, no aliases. Provider files are named for their
[Simple Icons](https://simpleicons.org) slug (`apachekafka.svg`, `googlecloud.svg`), except
`aws.svg`, `azure.svg` and `oci.svg`, which are original artwork (see *Licence* below).

## Fallback chain

A renderer resolves an icon in this order and stops at the first hit:

1. `icons/components/<provider>/<component-id>.svg` — provider read from the component file
2. `icons/kinds/<kind-id>.svg` — the kind the component declares
3. the category glyph the renderer uses for `messaging`, `compute`, `data`, `edge`,
   `external`, `client`, `ops` or `security`

Step 1 covers every component today. 544 of them — most of `aws`, `azure` and `oci` — are the
vendor's own product icon; the rest carry a provider badge on the kind glyph, or are the bare
kind glyph where the component is generic. Step 2 is what makes step 1 optional: a component
added without an icon still draws correctly as its kind. Step 3 is the renderer's own
last resort and is not a file in this folder.

## SVG constraints

Every file in this folder, whichever style it is in:

- is `viewBox="0 0 24 24"`, sized `24 x 24`
- contains no text, no raster image, no `<script>`, no event handler, no external
  reference of any kind, and no `data:` URI
- is under 4 KB
- carries no `id` that another icon also uses — every icon is inlined into one document, so
  a gradient id that collides silently repaints someone else's glyph

`packages/catalogue/src/validate.js` enforces the first three on every build.

## Two styles

**Line glyphs** — `kinds/` and the components of `default`, `gcp` and `cloudflare`. The glyph
is drawn in `stroke="currentColor"` with `fill="none"`, `stroke-width="1.5"` and round caps
and joins, so it inherits the surrounding text colour in light and dark.

**Vendor product icons** — the components of `aws`, `azure` and `oci`. These are the vendor's
own artwork, in the vendor's own colours, so that a reader recognises the service at a glance
instead of decoding a generic shape. The original drawing is wrapped in a single
`<g transform="translate(…) scale(…)">` that fits its native viewBox into the 24 unit box and
restores the fill the drawing expects, because a renderer may hand the icon a
`fill="none" stroke="currentColor"` context meant for a line glyph. Monochrome artwork is given
`fill="currentColor"` so it still follows the theme. Coordinates are rounded only as far as
keeping the drawing within about a fiftieth of a pixel at 24 px allows.

In the line-glyph style only the badge carries fixed colour. It is a 9 unit circle centred at `(18.5, 18.5)`
filled with the brand hex, with the mark inside it in white — or in near-black when the
brand colour is light enough that white would not read at 16 px. Behind it sits a slightly
larger halo circle filled with `var(--arkore-icon-bg, #fff)`, which knocks the kind glyph
out from under the badge. Set `--arkore-icon-bg` to the surrounding background colour on a
dark theme; the default white is correct on a light one.

## Adding an icon

When you add a component:

1. If it is unbranded and generic — `cron-job`, `webhook-receiver`, `mobile-app` — you may
   ship nothing. It falls back to its kind glyph, which is the right picture.
2. If it is an `aws`, `azure` or `oci` service, take the icon from the vendor's own
   architecture icon pack and fit it to the 24 unit box. Do not hand-draw one: a redrawn
   product icon is worse than the kind glyph, because it looks official and is not.
3. If it is a branded product on any other provider, ship
   `icons/components/<provider>/<id>.svg`: the kind glyph, plus the provider badge in the
   bottom-right corner. Reuse an existing `icons/providers/*.svg` mark, or add one from
   Simple Icons if the product is not there yet.
4. If you add a kind, `icons/kinds/<kind-id>.svg` is mandatory. It is the fallback for
   every component of that kind, so it must read at 16 px on its own.

Match the style of the folder you are adding to, and check the icon at 16 px. An icon that
only reads at 48 px is not finished.

## Licence

The kind glyphs are original work, MIT licensed with the rest of this repository.

The provider marks in `icons/providers/`, and therefore the badges composed from them,
come from [Simple Icons](https://github.com/simple-icons/simple-icons), which is released
under CC0 1.0 Universal. Path precision has been reduced so each file fits the 4 KB
budget; the artwork is otherwise unchanged.

`aws.svg`, `azure.svg` and `oci.svg` are **not** brand marks. Simple Icons carries no
Amazon Web Services, Microsoft Azure or Oracle Cloud logo, so these three are original
neutral glyphs distinguished only by colour, and they are MIT with the repository like the kind
glyphs.

The `aws`, `azure` and `oci` component icons are the vendors' own artwork, taken from the
packs those vendors publish for architecture diagrams — the AWS Architecture Icons package,
the Azure Public Service Icons set, and Oracle's OCI diagram toolkit. They are scaled into the
24 unit box and their coordinates are rounded; nothing else about the drawings is changed.
Each vendor's terms govern its own marks, and they are not MIT with the rest of this
repository. `_arkore-icons-v2/out/components/<provider>/<id>/source.json` records, per icon,
which pack it came from, the path inside that pack, and the licence page.

All trademarks and logos are the property of their respective owners. The marks are used
here only to identify the product a component models, which is nominative use; nothing in
this repository is endorsed by or affiliated with any of the vendors named.
