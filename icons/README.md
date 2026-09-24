# Icons

The visual vocabulary that matches the data vocabulary. Renderers draw a node by looking
up its component id here; nothing in `kinds/`, `components/` or `designs/` references an
icon, so the set can grow or be replaced without touching the model.

| Folder | Files | Contents |
|---|---|---|
| `kinds/` | 72 | One generic line glyph per kind. A queue, a cache, a cylinder, a gear. |
| `providers/` | 292 | Brand marks, used as the badge in the corner of a component icon. |
| `boundaries/` | 58 | Icons a boundary (a design group) can show before its label, kept apart from everything else here: platform and brand marks (`aws`, `gcp`, `kubernetes`, `github`) and concept glyphs (`on-premises`, `internet`, `users`, `environment-prod`). Referenced as `boundary:<id>` from a layout sidecar, never from a document. |
| `components/<provider>/` | 2156 | One per component, in the same provider subfolder as the component file. For `aws`, `azure`, `gcp`, `oci` and `k8s` this is the vendor's own product icon wherever the vendor publishes one (see *Two styles* below); everywhere else it is the kind glyph, plus a provider badge where the component is a cloud service or a branded product. |

## Naming

**The file name is the id.** `icons/kinds/<kind-id>.svg`, `icons/components/<provider>/<component-id>.svg`,
`icons/boundaries/<id>.svg`.
`components/default/kafka.yaml` has `id: "kafka"` and `provider: "default"`, so its icon is
`icons/components/default/kafka.svg`; `components/aws/alb.yaml` maps to `icons/components/aws/alb.svg`. No
other lookup, no manifest, no aliases. Provider files are named for their
[Simple Icons](https://simpleicons.org) slug (`apachekafka.svg`, `googlecloud.svg`), except
`aws.svg`, `azure.svg`, `oci.svg`, `ibm.svg` and `outscale.svg`, which are original artwork (see *Licence* below).

A boundary icon id is plain kebab-case and names what the boundary stands for, not a Simple Icons
slug: `gcp` (Google Cloud), `kafka` (Apache Kafka), `environment-prod`. The folder is the set; there
is no manifest. Every file needs a display name in `locales/en.yaml` under `boundaryIcons`, and the
gate fails on a file without one or a name without a file. The bundle carries each one in
`icons.json` as `boundary:<id>`, a namespace of its own, so `boundary:network` and `kind:network`
never collide. They are written by `node .claude/tools/icons.mjs` from
`.claude/tools/boundaries.mjs`, which says where each mark comes from.

## Fallback chain

A renderer resolves an icon in this order and stops at the first hit:

1. `icons/components/<provider>/<component-id>.svg` — provider read from the component file
2. `icons/kinds/<kind-id>.svg` — the kind the component declares
3. the category glyph the renderer uses for `messaging`, `compute`, `data`, `edge`,
   `external`, `client`, `ops` or `security`

Step 1 covers every component today. 849 of them are the vendor's own product icon: 297 of the 298
`aws`, 192 of the 202 `azure`, 205 of the 236 `gcp`, 138 of the 175 `oci` and 17 of the 19 `k8s`.
The remaining 81 in those five folders are products the vendor publishes no icon for, or whose
drawing will not fit the 4 KB budget; they carry a provider badge on the kind glyph like every
other provider does, and *Adding an icon* says what to do if a vendor icon appears later.
[`docs/icons-missing.md`](../docs/icons-missing.md) names those 81, why each one has no icon, and
where to check for one.
Step 2 is what makes step 1 optional: a component
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

`packages/catalogue/src/validate.js` enforces the first three on every build, and for
`boundaries/` the fourth as well: a boundary icon carries no `id` attribute at all.

## Two styles

**Line glyphs** — `kinds/` and the components of `default`, `cloudflare`, `ibm`, `alibabacloud`,
`digitalocean`, `openstack` and `outscale`, plus the components of the five vendor-icon providers
that the vendor ships no usable icon for. The glyph
is drawn in `stroke="currentColor"` with `fill="none"`, `stroke-width="1.5"` and round caps
and joins, so it inherits the surrounding text colour in light and dark.

**Vendor product icons** — the components of `aws`, `azure`, `gcp`, `oci` and `k8s`. These are the vendor's
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
larger halo circle filled with `var(--zeema-icon-bg, #fff)`, which knocks the kind glyph
out from under the badge. Set `--zeema-icon-bg` to the surrounding background colour on a
dark theme; the default white is correct on a light one.

**Boundary icons** are in both styles. A concept glyph is a line glyph exactly as above. A brand
mark is the provider mark drawn full size: one path in the brand colour, inside a
`<g fill="#hex" stroke="none">` so the stroking context a renderer gives a line glyph does not
outline it. A mark whose brand colour is near black (GitHub, Anthropic, Apple, Vercel, Helm,
Apache Kafka) is drawn in `currentColor` instead, so it follows the theme rather than vanishing on
a dark canvas. The files carry no `<title>`: the name comes from the locale.

## Adding an icon

When you add a component:

1. If it is unbranded and generic — `cron-job`, `webhook-receiver`, `mobile-app` — you may
   ship nothing. It falls back to its kind glyph, which is the right picture.
2. If it is an `aws`, `azure`, `gcp`, `oci` or `k8s` resource, take the icon from the vendor's own
   architecture icon pack and fit it to the 24 unit box with
   `node .claude/tools/vendor-icons/fit.mjs <map.json>`, which maps component id to source file.
   Do not hand-draw one: a redrawn product icon is worse than the kind glyph, because it looks
   official and is not. Where the vendor publishes nothing for that product — and several do not,
   especially for a feature of a larger service — fall back to rule 3 and ship the badge; a
   stand-in from a different product is worse than either.
3. If it is a branded product on any other provider, ship
   `icons/components/<provider>/<id>.svg`: the kind glyph, plus the provider badge in the
   bottom-right corner. Reuse an existing `icons/providers/*.svg` mark, or add one from
   Simple Icons if the product is not there yet.
4. If you add a boundary icon, add its id to `.claude/tools/boundaries.mjs` (a provider key or
   Simple Icons slug in `BOUNDARY_BRANDS`, or a line glyph in `BOUNDARY_GLYPHS`), run
   `node .claude/tools/icons.mjs`, and add its name under `boundaryIcons` in `locales/en.yaml`.
5. If you add a kind, `icons/kinds/<kind-id>.svg` is mandatory. It is the fallback for
   every component of that kind, so it must read at 16 px on its own.

Match the style of the folder you are adding to, and check the icon at 16 px. An icon that
only reads at 48 px is not finished.

## Licence

The kind glyphs are original work, MIT licensed with the rest of this repository.

The boundary icons in `boundaries/` come from three places:

- **Original glyphs**, MIT with the repository: `ai`, `analytics`, `cloud`, `database`, `edge`,
  `environment-dev`, `environment-prod`, `environment-test`, `internet`, `iot`, `mobile`,
  `network`, `office`, `on-premises`, `partner`, `region`, `security`, `users`.
- **Copied from `providers/`**, under that file's licence below (Simple Icons CC0, or original
  artwork for `aws`, `azure`, `ibm` and `oci`): `alibabacloud`, `anthropic`, `apple`, `aws`,
  `azure`, `cisco`, `cloudflare`, `databricks`, `datadog`, `digitalocean`, `docker`, `elastic`,
  `gcp` (from `googlecloud`), `github`, `gitlab`, `grafana`, `huggingface`, `ibm`, `kafka` (from
  `apachekafka`), `kubernetes`, `mongodb`, `mysql`, `nvidia`, `oci`, `okta`, `openstack`,
  `postgresql`, `prometheus`, `redis`, `snowflake`, `vercel`, `vmware`.
- **From Simple Icons** (CC0 1.0), path precision reduced the same way as `providers/`:
  `android`, `ansible`, `google`, `helm`, `linux`, `redhat`, `terraform`, `ubuntu`.

The trademark note at the end of this section applies to every brand mark among them.

The provider marks in `icons/providers/`, and therefore the badges composed from them,
come from [Simple Icons](https://github.com/simple-icons/simple-icons), which is released
under CC0 1.0 Universal. Path precision has been reduced so each file fits the 4 KB
budget; the artwork is otherwise unchanged.

`aws.svg`, `azure.svg`, `oci.svg`, `ibm.svg` and `outscale.svg` are **not** brand marks. Simple Icons
carries no Amazon Web Services, Microsoft Azure, Oracle Cloud, IBM or Outscale logo, so these five
are original neutral glyphs distinguished only by colour, and they are MIT with the repository like the kind
glyphs.

The `aws`, `azure`, `gcp`, `oci` and `k8s` component icons are the vendors' own artwork, taken
from the packs those vendors publish for architecture diagrams. They are scaled into the 24 unit
box, their coordinates are rounded, and a handful of the Oracle drawings have had detail finer
than a fifth of a pixel dropped to fit the 4 KB budget; nothing else about the drawings is
changed. Each vendor's terms govern its own marks, and none of them is MIT with the rest of this
repository.

| Pack | Source | Terms as the pack states them |
|---|---|---|
| AWS Architecture Icons (`Icon-package_07312026`) | <https://aws.amazon.com/architecture/icons/> | The package ships no licence file; the download page carries the AWS Architecture Icons terms and asks that the icons be used unaltered except for scaling, in architecture diagrams and technical material. |
| Azure Public Service Icons V24 | <https://learn.microsoft.com/azure/architecture/icons/> | The zip ships `Microsoft_Terms_of_Use.pdf` and `Azure_Icons_FAQ.pdf`: the icons "may be used in architecture diagrams, training materials, or documentation", must not be altered, and must not be used to imply Microsoft endorsement. `azure-fabric` comes from Microsoft's Fluent product icon package under the same rule. |
| Google Cloud icons (`google-cloud-legacy-icons.zip`, `core-products-icons.zip`) | <https://cloud.google.com/icons> | Neither zip ships a licence file. The page exposes no icon-specific licence, only <https://cloud.google.com/product-terms> and <https://policies.google.com/terms>; Google publishes the icons for diagrams and technical documentation and the marks stay Google's. This is weaker than the CC0 that covers `providers/`, and it is the reason the GCP icons are called out separately here. |
| Oracle graphics for diagrams | <https://docs.oracle.com/en-us/iaas/Content/General/Reference/graphicsfordiagrams.htm> | Oracle publishes the set for use in OCI architecture diagrams; the marks remain Oracle's. |
| Kubernetes community icons | <https://github.com/kubernetes/community/tree/master/icons> | Apache License 2.0. |

`_arkore-icons-v2/out/components/<provider>/<id>/source.json` records, per icon, which pack it
came from, the path inside that pack, and the licence page.

All trademarks and logos are the property of their respective owners. The marks are used
here only to identify the product a component models, which is nominative use; nothing in
this repository is endorsed by or affiliated with any of the vendors named.
