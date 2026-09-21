# Working in this repository

This file is for coding agents and for people. It states the invariants, the gates and the
layout. `docs/final-plan.md` is the product specification; when this file and the plan disagree,
the plan wins and this file is the bug.

## Layout

```
kinds/ components/ rules/ locales/ icons/ schema/   the catalogue (data; governed)
designs/reference|imported|authored/<id>/           designs (data; tier decides writability)
packages/core        the engine. Pure ES modules, zero dependencies, no DOM, no fs, no network
packages/catalogue   load the catalogue, build the bundle, run the repository gate
packages/cli         the `zeema` command
apps/web             Next.js app: pages, API under /api/v1, Drizzle schema, GitHub OAuth
docs/                specification, plan, governance, intake cards, inventories
```

## Gates (run before any commit; CI runs the same)

```bash
pnpm validate        # catalogue + designs gate (packages/catalogue/src/validate.js)
pnpm test            # vitest in every package: parser conformance, golden parity, edits, CLI, gate
pnpm lint            # biome
```

Do not weaken a test to make it pass. A golden fixture (`packages/core/test/golden.json`)
changes only when a behaviour change is intended, and the commit says why.

## Invariants

1. **One engine.** Parsing, serialisation, structure, rules, layout, rendering live in
   `packages/core` and nowhere else. The CLI, the web app and the tests import them. A second
   implementation of any of these is a defect.
2. **Byte preservation.** `serialize(parse(text).cst, doc)` returns `text` when `doc` is
   unchanged, and differs only on changed lines otherwise. Tested on every committed design.
3. **Refuse, never guess.** The parser throws with a line number on YAML it does not support.
   It never parses such input into something else.
4. **Structural findings block; rule findings never do.** Storage (the API) and the CLI both
   enforce this through `core/structure.js`.
5. **Tier and ownership decide writability.** Repository designs under `reference/` and
   `imported/` are never written by an editing session. On the platform, a public design is
   read-only to everyone but its owner; a private design is a 404 to everyone else.
6. **Authorization lives in `apps/web/src/lib/designs.ts`.** Pages and routes derive
   "can I edit" from its answers; never the reverse.
7. **Display text lives only in `locales/`.** Documents carry ids.
8. **The catalogue bundle is generated**, never edited: `pnpm bundle` or the web app's
   `predev`/`prebuild` step writes it.
9. **Tests never mutate the source tree.** Use a temporary directory.
10. **No hard-coded catalogue counts in tests.** Derive from disk.

## Adding to the catalogue

- A component: `components/<provider>/<id>.yaml`, a locale entry in `locales/en.yaml`, an icon
  under `icons/components/<provider>/`, an inventory row. Then `pnpm validate`.
- A kind: `kinds/<id>.yaml`, locale, glyph under `icons/kinds/`, and at least one rule or a
  recorded gap. Governance: `docs/governance.md`.
- A rule: `rules/<id>.yaml`, locale entry, a reference design's broken twin that trips it
  (header lists the rule ids). `pnpm validate` fails on a rule no design trips.
- A design import follows `.claude/skills/zeema-design-import`: same boxes, same names, same
  arrows; `mapping.yaml` proves it.

## Web app notes

- Params and `searchParams` are Promises (Next 16). `cookies()` is async.
- Server components read the catalogue through `src/lib/catalogue.ts` (loaded once per process).
- The API returns `{ error: { code, message, findings? } }` on failure. 422 carries structural
  findings. 409 carries `currentHash` on a save conflict. 404 for private designs, 403 for a
  non-owner writing a public one.
- Local development: no database to install (PGlite). There is no local-account sign-in: the
  only identity provider is GitHub, so `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and
  `APP_ORIGIN` are needed to sign in even locally (`src/lib/auth.ts`, `githubConfigured`).
  Without them reading works and creating is disabled. Production also requires `DATABASE_URL`.
