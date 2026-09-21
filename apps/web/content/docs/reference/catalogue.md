---
title: Catalogue reference
description: The three entity page types, their Markdown twins, /llms.txt, and the generated indexes.
order: 3
---

Every kind, component and rule in the catalogue has a page, and nothing on it is written by hand.
It is derived from the YAML on disk and the locale each time it is served, so a page can only ever
be as stale as the repository it is served from.

{{catalogue-counts}}

## The three page types

### `/catalogue/components/<id>`

A product. Its provider, kind and category; a link to the official documentation; the full
property table with the defaults this product pins marked as overrides; every rule that can fire
on it, with the condition in plain English; and the other products of the same kind.

### `/catalogue/kinds/<id>`

An abstract kind. The properties it defines, with types, allowed values, defaults and which are
required; the rules that read them; and every component that implements it, grouped by provider
with the vendor-neutral one first.

### `/catalogue/rules/<id>`

A rule. Why it exists, what it selects and what it checks in plain English, its message template,
the kinds and the number of components in scope, and the reference designs whose broken twin
trips it.

## The Markdown twins

Each of those pages is also a Markdown document at the **same address with `.md` appended**,
served as `text/markdown`:

```http
GET /catalogue/components/sqs.md

HTTP/1.1 200 OK
Content-Type: text/markdown; charset=utf-8
```

The Markdown carries the same sections as the page, plus YAML front matter and the verbatim
source file, so an agent can read the document and copy the exact bytes on disk without scraping
HTML.

> [!NOTE]
> The `.md` suffix is a rewrite onto one handler rather than a second set of pages, so the address
> is genuinely "the page plus `.md`" and the two renderings take the same model. They cannot
> disagree about a component.

## `/llms.txt`

[`/llms.txt`](/llms.txt) is the index over all of it, following the llms.txt convention: every
kind, every component grouped by provider, and every rule, each linking to its Markdown page.

There is no `llms-full.txt`, on purpose. A kind's page already lists every component that
implements it, and that is the drill-down path a reader — human or otherwise — should take.

## The bundle

The browser gets the catalogue as a static, versioned bundle under `/catalogue/*.json`, built by
`pnpm bundle` and rebuilt automatically before `dev` and `build`. `GET /api/v1/catalogue` is the
stable name for it and redirects to the current file.

The bundle is generated, never edited. The verbatim source of every file is kept separately, in a
server-only document, because it is about as large again as the whole bundle and no browser needs
it.

## Every kind

Grouped by category, with how many components implement each one. `custom` is last because it is
the [escape hatch](/docs/the-custom-kind), not a place to start.

{{kind-index}}

## Every provider

Provider is ownership, not hosting: `postgres` is `default` even on RDS, and `aurora` is `aws`.

{{provider-index}}

## Finding things from the command line

The same catalogue, without a browser:

```bash
zeema catalogue find message queue      # search ids, names and descriptions
zeema catalogue component sqs           # one product and its effective properties
zeema catalogue kind queue              # one kind, its properties and its components
zeema catalogue kinds                   # every kind with a component count
zeema catalogue providers queue         # which providers implement a kind
```

See [Command line](/docs/cli) for the full set.
