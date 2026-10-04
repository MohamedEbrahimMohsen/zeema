# Roadmap: parked work

Work that has been scoped and deliberately not built yet. Each entry is a brief to pick up from:
what it is, why it waits, and where it would touch the code. `docs/final-plan.md` stays the
specification; an item moves there (or into its own plan) when it is picked up.

Shipped and not parked: the `zeema` npm package (`packages/zeema`) with the local MCP server
(`zeema mcp`), documented at `/docs/cli` and `/docs/mcp`.

## API tokens (personal access tokens)

Today the API under `/api/v1` authenticates by the GitHub OAuth session cookie only, so nothing
outside a browser can write as a user. A token is a random secret the owner creates on their
profile, stored hashed (with a short visible prefix for identification), with a name, an expiry,
a last-used time and a scope (read-only, or read-write on the owner's designs). A request carries
it as `Authorization: Bearer`; `apps/web/src/lib/auth.ts` resolves it to the same user a session
would, and authorization stays in `apps/web/src/lib/designs.ts` (AGENTS.md invariant 6). Needs a
Drizzle table, a revoke action, rate limiting per token, and audit of token use. Prerequisite for
the remote MCP server and for any CI that writes to the platform.

## Remote MCP on the platform

The local `zeema mcp` reads files on the developer's machine. A remote MCP endpoint on zeema.dev
(Streamable HTTP transport, e.g. `/api/v1/mcp`) would let an agent read and edit designs stored
on the platform: list my designs, read one, lint it, propose an edit as a new draft, publish a
release. Same tool names as the local server where they overlap, so prompts carry over; the
tool bodies call the same `packages/core` functions the API already uses. Waits on API tokens
(the agent needs an identity that is not a browser session) and on deciding which writes an
agent may make unattended (likely: drafts yes, publishing a release no).

## GitHub pull-request sync

A GitHub App the owner installs on a repository. When a design is published on the platform, the
App opens (or updates) a pull request writing the design YAML and its `.layout.json` to a
configured path, so the repository stays the source of truth for code review and the platform
for drawing. The reverse direction (a merged change to the file updates the platform design) is
a webhook on push that re-imports through the same path as `/new/import`, refusing on a
structural finding. Needs the App registration, installation storage, a per-design mapping
(repo, branch, path), and conflict handling via the existing content hash (409 on save conflict).

## VS Code extension, lite

A small extension with no canvas: registers the design JSON Schema for `*.zeema.yaml` and
`design.yaml` (what `zeema init` writes into `.vscode/settings.json` today), and shows lint
findings as diagnostics on save by running the bundled engine in-process (import the same
modules `packages/zeema` bundles; no second implementation). Quick fixes can come later from
rule metadata. Publishing needs a marketplace publisher account and a VSIX build in CI.

## VS Code canvas custom editor

A custom editor that opens a design file as the canvas, draw.io style: the webview hosts a
standalone build of the canvas (the editing surface without the Next.js app around it), reads
and writes the YAML through VS Code's document model so undo, dirty state and git all work, and
keeps the layout sidecar beside the file. Needs the canvas factored into a bundle that runs with
no server (catalogue and icons from the bundled JSON, as `packages/zeema` does), and a message
protocol between webview and extension host. Byte preservation (invariant 2) must hold through
the editor exactly as it does on the platform.

## Protocol vocabulary, autocomplete and protocol rules

`edges[].protocol` is a free string today, so `http`, `HTTP` and `https` are three different
things and no rule can reason about protocols. Parked change: a governed protocol list in the
catalogue (id, family such as sync-request or async-message, locale name), the schema's
`protocol` becomes an enum generated from it (editor autocomplete through the JSON Schema and
the canvas picker), a structural check for unknown protocols with a migration path for existing
designs, and rules that use it (a sync protocol on an edge declared async, a message protocol
into a component that cannot consume it). Touches `schema/`, `packages/catalogue` (gate and
bundle), `packages/core/structure.js` and `rules.js`, and every committed design.

## Release process

Today: `.github/workflows/publish-npm.yml` publishes `zeema` to npm on a `v*` tag, and
`.github/workflows/publish-images.yml` pushes images to GHCR on every push to `main`. Parked:
one release flow that ties them together. A tag `vX.Y.Z` runs the gate once, publishes the npm
package, and tags the images with the same version (alongside `latest` and the sha), then
creates a GitHub release with notes generated from the commits since the previous tag. Decide
whether image versions follow the npm version or the platform keeps its own, and add a check
that the docs' install instructions name a version that exists.
