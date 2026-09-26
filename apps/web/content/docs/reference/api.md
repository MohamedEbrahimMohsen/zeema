---
title: API
description: Every HTTP route, what it needs, the JSON it takes and the JSON it returns.
order: 5
---

The API is JSON over HTTP. Reading is open; writing needs a session cookie from GitHub sign-in.
Everything the site does, it does through these routes.

## Conventions

- Request bodies are JSON and capped at 1 MiB. A body that is not JSON answers `400`.
- Dates are ISO-8601 strings.
- `{owner}` is a username, or the literal `zeema` for the curated, owner-less designs.
- Authentication is the session cookie. There is no API token in v1.
- Several write endpoints are rate limited per account, or per address for an anonymous caller.

### Errors

Every failure has the same shape.

```json
{
  "error": {
    "code": 422,
    "message": "design is not structurally valid",
    "findings": [
      {
        "id": "structure",
        "severity": "error",
        "message": "node orders-queue unknown component sqz",
        "blocking": true,
        "subject": { "type": "node", "ref": "orders-queue" }
      }
    ]
  }
}
```

| Status | Means |
|---|---|
| `400` | The body is malformed, or a field is the wrong type |
| `401` | Not signed in, where signing in is what is missing |
| `403` | Signed in, but not allowed — writing someone else's **public** design |
| `404` | Not found, **and** what a private design answers to everyone but its owner |
| `409` | A conflict: a save against a stale hash, or an address already taken or reserved |
| `413` | The body, or the design, is too large |
| `422` | Structurally invalid; `findings` carries the blocking findings |
| `428` | A save arrived with no `If-Match` |
| `429` | Rate limited |

> [!WARNING]
> `404` versus `403` is deliberate. A private design answers `404` to everyone but its owner,
> because `403` would confirm that it exists. A **public** design you may not write answers `403`,
> because its existence is not a secret.

## Designs

{{api-routes}}

### List and search

```http
GET /api/v1/designs?q=checkout&provider=aws&sort=updated&page=1&pageSize=24
```

| Parameter | Values |
|---|---|
| `q` | Free text over title, summary and the design's search text |
| `provider` | A provider id, e.g. `aws` |
| `kind` | A kind id, e.g. `queue` |
| `owner` | A username, or `me` for the caller's own designs |
| `sort` | `updated`, `created`, `clones`, `exports` |
| `page`, `pageSize` | `pageSize` is capped at 100 and defaults to 24 |

```json
{
  "items": [
    {
      "id": "0f2a…",
      "slug": "order-processing",
      "title": "Order processing",
      "summary": null,
      "visibility": "public",
      "origin": "reference",
      "updatedAt": "2026-01-14T09:31:02.000Z",
      "owner": { "username": "ada" },
      "unpublished": false,
      "stats": { "viewCount": 128, "cloneCount": 4, "exportCount": 2 },
      "providers": ["aws", "default"],
      "nodeCount": 9,
      "edgeCount": 11,
      "findingCount": 0,
      "brand": null,
      "sketch": null
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 24
}
```

Visibility is part of the query, never a filter applied afterwards, so a private design cannot
leak through a paging edge.

### Create

```http
POST /api/v1/designs
Content-Type: application/json
```

```json
{
  "title": "Order processing",
  "slug": "order-processing",
  "summary": "The path a placed order takes.",
  "visibility": "private",
  "yaml": "schemaVersion: \"1\"\ntype: \"design\"\nid: \"order-processing\"\nnodes: []\nedges: []\n",
  "layout": null,
  "message": "first draft"
}
```

`title` is required and at most 120 characters. `yaml` is required and is validated before
anything is stored: a structurally invalid design answers `422` and nothing is written. Without
`slug`, the address is derived from the title; where that is taken, a numeric suffix is added.
Answers `201`.

```json
{
  "design": {
    "id": "0f2a…",
    "slug": "order-processing",
    "owner": { "username": "ada" },
    "address": "/d/ada/order-processing"
  },
  "version": { "id": "9c11…", "contentHash": "5f3a…" }
}
```

### Read one

```http
GET /api/v1/designs/ada/order-processing
```

```json
{
  "design": { "id": "0f2a…", "slug": "order-processing", "title": "Order processing" },
  "owner": { "username": "ada", "displayName": "Ada", "avatarUrl": null },
  "stats": { "viewCount": 128, "cloneCount": 4, "exportCount": 2 },
  "can": { "read": true, "write": false, "clone": true, "publish": false },
  "currentVersion": {
    "id": "9c11…",
    "contentHash": "5f3a…",
    "createdAt": "2026-01-14T09:31:02.000Z",
    "message": "first draft"
  }
}
```

`currentVersion` is the head for someone who may write, and the release for everyone else.
`can` is the authorization answer, and pages derive their buttons from it rather than
re-deciding.

### Change metadata

```http
PATCH /api/v1/designs/ada/order-processing
```

```json
{
  "title": "Order processing",
  "slug": "orders",
  "summary": "The path a placed order takes.",
  "readme": "## Notes\n\nWhy the queue is where it is.\n",
  "visibility": "public",
  "tags": ["ecommerce", "aws"]
}
```

Every field is optional; anything the body carries that is not one of them is ignored rather than
refused, so an older client with an extra key still works.

- `summary` is cut to 280 characters.
- `readme` is **refused** at over 20,000 characters (`422`) rather than truncated: silently losing
  the end of someone's writing is worse than making them shorten it.
- `tags` is at most 10, normalised the same way an address is.
- `slug` answers `409` when the address is taken, or was reserved by a published design.
- Going public with nothing released releases the head, so the page is never empty.

### Saving and conflicts

```http
PUT /api/v1/designs/ada/order-processing/version
If-Match: "5f3a…"
```

```json
{ "yaml": "schemaVersion: \"1\"\n…", "layout": null, "message": "add the DLQ" }
```

The last-seen content hash is required — as an `If-Match` header or as `ifMatch` in the body.
Without it the answer is `428`. Where it does not match the current head:

```json
{
  "error": {
    "code": 409,
    "message": "the design changed since you loaded it",
    "findings": { "currentHash": "77be…" }
  }
}
```

Nothing is ever merged for you. Reload, and decide.

A successful save answers with the new version, and `unchanged: true` where the YAML and the
layout were identical to the head, in which case no row was written:

```json
{
  "design": { "id": "0f2a…", "updatedAt": "2026-01-14T10:02:11.000Z" },
  "version": { "id": "a4d0…", "contentHash": "77be…", "createdAt": "2026-01-14T10:02:11.000Z" },
  "unchanged": false
}
```

> [!NOTE]
> A save by the same author within ten minutes of an unreleased head, carrying no message,
> rewrites that head in place instead of adding a row. Autosave fires at every pause; without
> coalescing, the history would be keystrokes. A released version is never rewritten.

### Publish

```http
POST /api/v1/designs/ada/order-processing/publish
```

```json
{ "note": "first public cut" }
```

```json
{
  "design": {
    "id": "0f2a…",
    "slug": "order-processing",
    "address": "/d/ada/order-processing",
    "publishedVersionId": "a4d0…"
  },
  "version": { "id": "a4d0…", "contentHash": "77be…", "publishedAt": "2026-01-14T10:05:00.000Z" },
  "unchanged": false
}
```

The reply carries the slug because publishing an unnamed draft also moves it to an address made
from its title, and the caller has to follow it there.

### Clone

```http
POST /api/v1/designs/ada/order-processing/clone
```

An optional body may override `slug`, `title`, `yaml` or `layout`. Answers `201` with the same
shape as create. Requires a session.

### Versions

```http
GET /api/v1/designs/ada/order-processing/versions
```

```json
{
  "versions": [
    {
      "id": "a4d0…",
      "contentHash": "77be…",
      "message": "add the DLQ",
      "createdAt": "2026-01-14T10:02:11.000Z",
      "authorId": "3b77…"
    }
  ]
}
```

A reader sees released versions only. The writer sees every save.

### Representations

```http
GET /api/v1/designs/ada/order-processing/yaml?version=a4d0&download=1
```

Answers `text/yaml` with an `ETag` of the content hash. `download=1` adds a
`Content-Disposition` so the browser saves the file instead of showing it.

```http
GET /api/v1/designs/ada/order-processing/render?format=svg&theme=light
```

Answers `image/svg+xml`, or `text/plain` for `format=mermaid`. `?download=1` saves it.
`?version=` renders a specific version.

```http
GET /api/v1/designs/ada/order-processing/layout
```

Answers the [layout sidecar](/docs/notes-and-layout) as JSON, or `null` where there is none.

```http
PATCH /api/v1/designs/ada/order-processing/layout
```

```json
{ "badge": "provider:gcp" }
```

Owner only. Sets the [list badge](/docs/notes-and-layout#the-list-badge): `provider:<id>`,
`boundary:<id>`, or `null` for the automatic one; anything else answers `400`. It is a
layout-only save of the head, made the way the canvas saves (it folds into an unreleased head of
yours, or starts a new unreleased version), so readers see it once it is published. Answers
`{ "version": { "id", "contentHash", "createdAt" }, "badge", "unchanged" }`. `403` for a public
design you do not own, `404` for a private one.

### Export events

```http
POST /api/v1/designs/ada/order-processing/events
```

```json
{ "kind": "export", "format": "svg" }
```

Only `export` is accepted here; anything else answers `400`. This is how the export counter on a
design is fed. Answers `{ "ok": true }`.

## Linting

```http
POST /api/v1/lint
```

```json
{ "yaml": "schemaVersion: \"1\"\ntype: \"design\"\nid: \"checkout\"\nnodes: []\nedges: []\n" }
```

```json
{
  "valid": true,
  "findings": [],
  "counts": { "nodes": 0, "edges": 0, "groups": 0 }
}
```

Nothing is stored. This is the editor's live feedback and the same answer the storage gate gives,
which is the point: the check a client runs for convenience is repeated at the point of storage.
`valid` is about structure alone — a design full of rule findings is still `valid: true`.

## Accounts

```http
GET /api/v1/me
```

```json
{
  "user": {
    "id": "3b77…",
    "username": "ada",
    "displayName": "Ada",
    "avatarUrl": "https://…",
    "bio": null,
    "createdAt": "2025-11-02T08:00:00.000Z"
  }
}
```

`401` when not signed in. `PATCH /api/v1/me` takes `{ "displayName": "…", "bio": "…" }`;
`displayName` is cut to 80 characters and `bio` to 500.

`GET /api/v1/users/{username}` returns the same public shape plus the designs the caller may see
and `stats`: `{ designs, clones, followers, following, drafts }`, where `drafts` is a number for
the account's owner and `null` for everyone else.

### Follows

```http
PUT /api/v1/users/{username}/follow
DELETE /api/v1/users/{username}/follow
GET /api/v1/users/{username}/followers?page=2
GET /api/v1/users/{username}/following
```

Following and unfollowing are idempotent and answer `204`. Following yourself is `422`, an
unknown or closed account `404`, no session `401`, and more than 60 changes in an hour `429`.
The lists are public and answer
`{ "users": [{ "username", "displayName", "avatarUrl" }], "page", "pageSize", "total" }`.
See [profiles, follows and notifications](/docs/profiles-and-notifications).

### Notifications

```http
GET /api/v1/notifications?page=1&unread=1
GET /api/v1/notifications/unread-count
POST /api/v1/notifications/read
```

```json
{ "ids": ["5f0c…", "9a1e…"] }
```

The list answers `{ items, page, pageSize, total, unread }`; each item is
`{ id, kind, createdAt, read, actor, design }`, where `actor` and `design` are `null` once the
account is closed or the design is no longer yours to read. `unread-count` answers `{ "count": 3 }`.
Marking takes `{ "ids": [...] }` (at most 100) or `{ "all": true }` and answers `204`; ids that are
not yours are ignored. All three need a session.

## Administration

These need an acting admin — an account holding the role **and** with the session switch on.
See [roles and admin presence](/docs/publishing#roles-and-admin-presence).

```http
GET /api/v1/admin/users?q=ada&admins=1
POST /api/v1/admin/grants
DELETE /api/v1/admin/grants
```

```json
{ "username": "ada", "role": "admin", "note": "on call rotation" }
```

Granting is idempotent: `201` the first time, `200` afterwards. Revoking keeps the row and marks
it revoked, so the history stays. An admin cannot revoke their own admin role.

## The rest of the surface

{{api-other-routes}}

`/api/metrics` answers `404` — not `401` — when `METRICS_TOKEN` is set and the caller does not
present it. An endpoint that admits it exists is an endpoint worth attacking.

## Machine-readable catalogue

Not JSON, but part of the same contract:

| Address | Content type | What |
|---|---|---|
| `/catalogue/components/<id>.md` | `text/markdown` | A component page with front matter and the verbatim YAML |
| `/catalogue/kinds/<id>.md` | `text/markdown` | The same for a kind |
| `/catalogue/rules/<id>.md` | `text/markdown` | The same for a rule |
| `/llms.txt` | `text/plain` | The index over all three, per the llms.txt convention |
| `/catalogue/catalogue.json` | `application/json` | The compiled bundle the browser loads |

[Catalogue reference](/docs/catalogue) explains what is on each of them.
