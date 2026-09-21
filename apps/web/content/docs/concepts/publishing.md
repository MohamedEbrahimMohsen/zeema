---
title: Publishing and addresses
description: Head and release, visibility, renaming, deleting, cloning — what readers see while you work.
order: 4
---

A design on this site has two pointers, and almost everything below follows from the difference
between them.

- **head** — the current version. It moves on every save, and autosave keeps it current.
- **release** — what everyone else sees. It moves only when you press **Publish**.

So a reader of your public design keeps seeing the last release while you edit. The design page
shows you a `draft` tag and a Publish button whenever head and release differ; the canvas toolbar
carries the same button and saves any unsaved edits first.

## Visibility

A new design is **private** with no release. Private means a 404 to everyone else, not a
permission error — a private design does not announce that it exists.

Making a design public with nothing released yet releases the head at that moment, so a public
page is never empty. Publishing a private design is allowed; the release simply shows once the
design is public. A design created public — the curated designs, or an explicit public create —
is released at creation.

A public design is readable by everyone and writable only by its owner.

## Addresses

A new design is parked at a temporary address of the form `draft-a1b2c3` until it is named.
Publishing an unnamed draft moves it to an address derived from its title, so `Order processing`
becomes `order-processing`. An address you chose by hand is never changed for you.

The rule that makes an address is one function: lower-case, every run of non-alphanumeric
characters becomes a hyphen, leading and trailing hyphens are dropped, and the result is cut to
64 characters.

### Renaming

Renaming works the way it does on GitHub. The old address is **reserved** and redirects to the
new one, so links already in the world keep working, and nothing else can ever take that name —
not another of your designs, and not a stranger's.

> [!WARNING]
> A reservation is permanent. Asking for an address that a published design of yours once used
> answers `409`, and so does asking for one that is currently in use. That is deliberate: silently
> pointing an old link at a different design would be worse than a dead end.

### Deleting

Deleting depends on whether anyone could have seen the design.

| Was it ever published? | What happens | The address |
|---|---|---|
| No | The design, its versions, events, stats and reservations are removed outright | Goes back to you |
| Yes | The row stays, marked deleted and forced private — a tombstone | Keeps answering, as a tombstone |

Clones are unaffected either way. A clone copies the YAML when it is made, and the pointer back to
its source carries no foreign key, so deleting a source orphans a pointer and breaks nothing.

### Cloning

Cloning copies a design into your account, with its layout. The clone keeps the name it was given
and gets a free address under your own username; where that name is taken, a numeric suffix is
added. You own the clone completely: it is private until you say otherwise, and nothing about it
refers back to the original except a recorded source id.

## Versions

Every save is a version row. Two rules keep the history readable.

**Coalescing.** A save by the same author, within ten minutes of the head, when the head has not
been released and the save carries no message, rewrites the head in place. Autosave fires at
every pause; without this, history would be keystrokes rather than working sessions. A released
version is never rewritten.

**Releases are the public history.** Readers can list and open released versions only. The writer
sees every save, marked `released` or `draft`. A `?v=<id>` link to an unreleased version answers
not-found to a reader.

Saving requires the content hash you last saw. A mismatch is a `409` carrying `currentHash`, and
nothing is merged for you — see [the API](/docs/api#saving-and-conflicts).

## Roles and admin presence

Every account is a **member**: it owns the designs it creates, and sees public designs plus its
own private ones.

**Admin** is a grant, not a flag. One row per assignment records who granted it, when, an optional
note, and who revoked it and when; a user holds the role while an unrevoked grant exists.
Revoking keeps the row, so the history stays. The first admin comes from the `ZEEMA_ADMINS`
environment variable and is granted at that user's next sign-in with the note `bootstrap`; after
that, roles are managed from `/admin/iam` or [the admin API](/docs/api#administration).

An admin signs in as a member. The role is **off** until they switch it on from the account menu,
and the switch is stored on the session, so it applies to that browser only and resets at
sign-out. While acting as admin:

- every private design is readable;
- the curated system designs are writable;
- members' own designs stay read-only.

An admin cannot revoke their own admin role — another admin has to. Revoking a grant also turns
the switch off on every session of that user, so the change takes effect on their next request.
