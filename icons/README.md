# Icons

The visual vocabulary that matches the data vocabulary. Renderers draw a node by looking
up its component id here; nothing in `kinds/`, `components/` or `designs/` references an
icon, so the set can grow or be replaced without touching the model.

| Folder | Files | Contents |
|---|---|---|
| `kinds/` | 41 | One generic line glyph per kind. A queue, a cache, a cylinder, a gear. |
| `providers/` | 76 | Brand marks, used as the badge in the corner of a component icon. |
| `components/<provider>/` | 248 | One per component, in the same provider subfolder as the component file: the kind glyph, plus a provider badge where the component is a cloud service or a branded product. |

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

Step 1 covers every component today. Step 2 is what makes step 1 optional: a component
added without an icon still draws correctly as its kind. Step 3 is the renderer's own
last resort and is not a file in this folder.

## SVG constraints

Every file in this folder:

- is `viewBox="0 0 24 24"`, sized `24 x 24`
- draws the glyph in `stroke="currentColor"` with `fill="none"`, `stroke-width="1.5"`,
  round caps and joins, so it inherits the surrounding text colour in light and dark
- contains no text, no raster image, no `<script>`, no event handler, no external
  reference of any kind, and no `data:` URI
- is under 4 KB

Only the badge carries fixed colour. It is a 9 unit circle centred at `(18.5, 18.5)`
filled with the brand hex, with the mark inside it in white — or in near-black when the
brand colour is light enough that white would not read at 16 px. Behind it sits a slightly
larger halo circle filled with `var(--arkore-icon-bg, #fff)`, which knocks the kind glyph
out from under the badge. Set `--arkore-icon-bg` to the surrounding background colour on a
dark theme; the default white is correct on a light one.

## Adding an icon

When you add a component:

1. If it is unbranded and generic — `cron-job`, `webhook-receiver`, `mobile-app` — you may
   ship nothing. It falls back to its kind glyph, which is the right picture.
2. If it is a cloud service or a branded product, ship
   `icons/components/<provider>/<id>.svg`: the kind glyph, plus the provider badge in the
   bottom-right corner. Reuse an existing `icons/providers/*.svg` mark, or add one from
   Simple Icons if the product is not there yet.
3. If you add a kind, `icons/kinds/<kind-id>.svg` is mandatory. It is the fallback for
   every component of that kind, so it must read at 16 px on its own.

Match the existing style exactly: same viewBox, same stroke width, same badge geometry.
An icon that only reads at 48 px is not finished.

## Licence

The kind glyphs are original work, MIT licensed with the rest of this repository.

The provider marks in `icons/providers/`, and therefore the badges composed from them,
come from [Simple Icons](https://github.com/simple-icons/simple-icons), which is released
under CC0 1.0 Universal. Path precision has been reduced so each file fits the 4 KB
budget; the artwork is otherwise unchanged.

`aws.svg` and `azure.svg` are **not** brand marks. Simple Icons no longer carries the
Amazon Web Services or Microsoft Azure logos, so these two are original neutral cloud
glyphs distinguished only by colour, and they are MIT with the repository like the kind
glyphs.

All trademarks and logos are the property of their respective owners. The marks are used
here only to identify the product a component models, which is nominative use; nothing in
this repository is endorsed by or affiliated with any of the vendors named.
