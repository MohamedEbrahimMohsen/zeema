# Arkore

Software architecture as **typed, queryable data**.

A diagram is a picture. An Arkore design is a model: every box is a catalogued component with
real properties, every promise the system makes is written down under `requirements`, and rules
check the two against each other. A linter finds design mistakes deterministically, a diff in a
pull request is readable, and any renderer can draw the same design.

```yaml
schemaVersion: "1"
type: "design"
id: "checkout"
requirements: { messaging: { replay: true } }
nodes:
  - { id: "api", component: "aws-api-gateway" }
  - { id: "events", component: "sns" }
edges:
  - { from: "api", to: "events", protocol: "sns", mode: "async", delivery: "at-least-once" }
```

The rule `pubsub-replay-required` fires: the design requires replay, and SNS cannot replay.

## What is here

| Path | What |
|---|---|
| `kinds/` `components/` `rules/` `locales/` `icons/` `schema/` | The catalogue: 71 kinds, 1,855 components across twelve providers, 36 rules, display text, icons, JSON Schemas |
| `designs/` | Reference designs (each with a deliberately broken twin), imported designs (with fidelity mappings), authored designs |
| `packages/core` | The engine: span-preserving YAML, document operations, structural checks, rules, layout, geometry, renderers. Zero dependencies, no environment |
| `packages/catalogue` | Loads the catalogue, builds the client bundle, runs the repository gate |
| `packages/cli` | `arkore lint / validate / render / catalogue / init` |
| `apps/web` | The community platform: browse, drag-and-drop canvas, YAML editor, own, publish, clone, export; GitHub sign-in |
| `docs/` | The format specification, governance, usage, the full product plan (`docs/final-plan.md`), intake cards, provider inventories |

## Run it

```bash
pnpm install
pnpm validate            # the repository gate
pnpm test                # every package's tests
pnpm dev                 # the web app on http://localhost:3000 (embedded Postgres, local sign-in)
```

The web app needs nothing installed: without `DATABASE_URL` it uses an embedded Postgres under
`apps/web/.pglite`, and with `AUTH_DEV_LOGIN=1` it offers a local account. For a real deployment
set `DATABASE_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `APP_ORIGIN` (see
`apps/web/.env.example`).

## Lint a design in your own repository

```bash
npx @arkore/cli init     # starter design, config, editor schema mapping, CI workflow
npx @arkore/cli lint     # exit 1 on structural errors or rules of severity error
```

## Documents

- `docs/format.md`: every field of every document type.
- `docs/final-plan.md`: the complete product plan, requirements and milestones.
- `docs/deploy.md`: how to run the platform for real (Postgres, GitHub OAuth app, Docker).
- `docs/governance.md`: how the vocabulary is curated and extended.
- `AGENTS.md`: how to work in this repository, for people and for coding agents.

## License

MIT. See `LICENSE`. Icon provenance is recorded in `icons/README.md`.
