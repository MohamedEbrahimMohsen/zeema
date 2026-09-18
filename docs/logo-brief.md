# Zeema — logo prompt for Claude Design

Paste everything below the line into Claude Design.

---

Design the logo for **Zeema**, a developer tool whose one-line pitch is *"software architecture as typed, queryable data."*

## What Zeema is

Zeema replaces hand-drawn architecture diagrams with a strict, machine-readable catalogue. It has three layers that build on each other:

- **Kinds** — 71 abstract building blocks of any system (object storage, message queue, load balancer, virtual machine, secret store…). Each kind declares typed properties.
- **Components** — 1,855 real products across 12 providers (AWS, Azure, GCP, OCI, Cloudflare, IBM, Alibaba Cloud, DigitalOcean, OpenStack, Outscale, Kubernetes, and a vendor-neutral set), each one *an instance of a kind* with documented defaults.
- **Designs** — a user's actual architecture: nodes that are components, edges between them, regions that group them. A design is YAML, so it can be rendered, diffed, and checked by **rules** (36 of them, e.g. "a public bucket has no encryption", "a queue with no dead-letter target").

People sign in with GitHub, create designs on a canvas, publish them at a URL like `zeema.dev/d/owner/slug`, and browse other people's designs. The product feeling is: engineering rigour, calm, typed, auditable. Think Terraform Registry, Linear, and a good schema editor — not a marketing SaaS.

## The name

"Zeema" reads as **ark / arc** (architecture, an arch, a vessel that carries a structured cargo) + **core / ore** (the essential centre; raw material refined into something precise). Either reading can drive the mark. Pronounced "ar-KORE".

## The brand system it must live inside ("Blueprint")

- Typography: **Geist** for UI, **JetBrains Mono** for identifiers and labels. The wordmark should feel native to Geist (geometric, low-contrast, slightly compact) but may be custom-drawn.
- Accent: **indigo `#3f4fc4`**. Light theme ground `#fafaf8`, ink `#1b1b19`. Dark theme ground `#131315`, ink `#ececea`. Radii are 8px on panels, 4px on controls; lines are 1px hairlines.
- Taxonomy colours used on the canvas (the mark may quote one or two, never all): compute blue, edge teal, data amber, ops violet, security purple, messaging green, client rose, external red.
- Tone: mono-spaced, uppercase, letter-spaced section labels; quiet surfaces; no gradients, no glow, no 3-D.

## What the mark should express

Pick one idea and commit to it. Strong candidates, in order of preference:

1. **Structure made of typed parts.** A small constellation of 3–4 nodes joined by hairline edges, arranged so the negative space forms an "A" or an arch. Nodes are simple rounded squares (the canvas draws components as rounded rectangles), one of them filled in the indigo accent, the rest outlined.
2. **The arch / keystone.** A minimal arch built from discrete blocks, with the keystone as the single accented block — "the core that holds the structure".
3. **A monogram "A"** drawn as a schema: an A whose crossbar is a connecting edge between two node-squares.

Avoid: clouds, gears, hexagons with circuit traces, shields, rockets, generic "network" globes, anything that looks like a cloud provider's own logo (this product sits *above* all of them and must look neutral), and any letterform tricks that read as "AK" or a company initial monogram.

## Deliverables

1. **Primary lockup** — mark + wordmark "Zeema", horizontal, for the top bar (rendered at 20–24px tall).
2. **Mark alone** — must survive at 16×16 (favicon), 32×32 (tab/GitHub avatar), and 512×512 (app icon). Test it at 16px: no detail thinner than 1/12 of the icon size.
3. **Wordmark alone** — for docs headers and the sign-in page.
4. **Light and dark variants** of each, using the exact ground and ink colours above. The accent stays `#3f4fc4` in both; if it fails contrast on dark, lighten toward `#6b7ae0` and say so.
5. **Monochrome** version (single ink, no accent) for GitHub README badges and print.
6. A **social/OG card** 1200×630: mark + wordmark + the tagline "Architecture as typed, queryable data." on the light ground.
7. All as clean **SVG** with a 24-unit viewBox for the mark (the whole app's icon system is 24×24), paths only — no text objects, no embedded rasters, no filters.

Present three distinct directions first (one per candidate idea above), each shown at favicon size, in the top bar next to "Browse · Catalogue · Docs", and on the OG card, in both themes. Then refine the one that reads best at 16px.
