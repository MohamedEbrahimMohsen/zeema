---
title: Getting started
description: Run the platform locally, create a design on the site, or lint one from your own repository.
order: 2
---

There are three ways in, and they do not depend on each other. Pick the one that matches what you
want today.

## Run the platform locally

Everything is in one repository and the web app needs nothing installed. Without a
`DATABASE_URL` it runs an embedded Postgres under `apps/web/.pglite`, so there is no database to
set up.

```bash
pnpm install
pnpm validate            # the repository gate: catalogue and designs
pnpm test                # every package's tests
pnpm dev                 # http://localhost:3000
```

There is no local-account sign-in: GitHub is the only identity provider, so signing in locally
needs a GitHub OAuth app and `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `APP_ORIGIN` in
`apps/web/.env.local`. Reading and linting never need an account; creating a design does.

For the real thing — Postgres, GitHub OAuth, Prometheus and Grafana — the supported way is the
compose stack at the repository root:

```bash
cp .env.example .env     # then fill in the four secrets
docker compose up -d --build
```

First boot seeds the curated designs, which takes a minute or two. See
[Deployment](/docs/deployment) for the service list and every environment variable.

> [!WARNING]
> The embedded database runs inside the app process. It cannot be shared between two processes
> and it cannot be backed up while the app is running. It is for local development only.

## Create your first design on the site

1. **New design.** The button is in the site header. A new design is private and parked at a
   temporary address of the form `draft-a1b2c3` until you give it a name.
2. **Draw it.** The canvas has the catalogue in its palette. Drop components, join them with
   edges, nest them in groups. Findings update as you work: structural problems block the
   save, rule findings do not.
3. **Name it.** Click the title. The address follows the title the first time you publish, so
   `Order processing` becomes `/d/<you>/order-processing`.
4. **Publish.** Publishing moves the *release* pointer to what you have saved. Until then, your
   edits are the head and readers keep seeing the last release. Making a design public with
   nothing released yet releases the head at that moment, so a public page is never empty.

> [!NOTE]
> Renaming is safe. The old address is reserved and redirects, exactly as it does on GitHub, so
> links already in the world keep working and nothing else can take that name.
> [Publishing and addresses](/docs/publishing) has the whole model.

## Lint a design in your own repository

The command line tool works on any repository. It needs no account and no network.

```bash
npx @zeema/cli init      # starter design, config, editor schema mapping, CI workflow
npx @zeema/cli lint      # exit 1 on a structural error or a rule of severity error
```

`init` writes four things and never overwrites an existing file:

| File | What it is |
|---|---|
| `architecture/checkout.zeema.yaml` | A starter design you can edit down to nothing |
| `zeema.config.json` | Which paths to lint, the failing severity, disabled rules |
| `.github/workflows/zeema.yml` | A pull-request check that also uploads SARIF |
| `.vscode/settings.json` | Maps `*.zeema.yaml` and `design.yaml` to the design schema |

With the YAML extension installed, your editor now validates the design against the schema and
completes enum values as you type. In a repository that is not this one, the first line of the
file does the same job:

```yaml
# yaml-language-server: $schema=https://zeema.dev/schema/design.schema.json
```

`zeema validate` is a different thing from `zeema lint`: it runs the whole-repository gate over a
*catalogue* — every kind, component, rule, locale entry and reference design — and is what you
run when contributing to the vocabulary rather than describing a system. See
[Command line](/docs/cli) for every command and its exit codes.

## The shape of a design

The smallest true statement, and then grow it:

```yaml complete
schemaVersion: "1"
type: "design"
id: "checkout"
nodes:
  - { id: "api", component: "aws-api-gateway" }
  - { id: "checkout-service", component: "container-service" }
  - { id: "orders-db", component: "postgres" }
edges:
  - { from: "api", to: "checkout-service", protocol: "http", mode: "sync" }
  - { from: "checkout-service", to: "orders-db", protocol: "postgres", mode: "sync" }
```

Add requirements, then groups, then props, then per-node NFRs — in that order, because each step
unlocks rules that the previous one could not answer. [Writing a design](/docs/writing-a-design)
walks through all of it.
