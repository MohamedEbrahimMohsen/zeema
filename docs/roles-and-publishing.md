# Roles, admin presence, and publishing

How the platform decides who may change what, and what readers see while a design is being
worked on. The service layer (`apps/web/src/lib/designs.ts`, `iam.ts`) is the only place these
rules live; pages and the API derive their state from its answers.

## Roles

- Every account is a **member**. Members own the designs they create, see public designs and
  their own private ones.
- The **admin** role is a grant, not a flag: `role_grants` holds one row per assignment with
  who granted it, when, an optional note, and who revoked it and when. A user holds a role
  while an open (unrevoked) grant exists. Revoking keeps the row, so the history stays.
- The first admin comes from `ARKORE_ADMINS` (comma-separated usernames) and is granted at
  that user's next sign-in with the note `bootstrap`. After that, roles are managed from the
  IAM page (`/admin/iam`) or the API (`/api/v1/admin/users`, `/api/v1/admin/grants`).
- An admin cannot revoke their own admin role. Another admin has to.

## Admin presence

An admin signs in as a member. The role is off until they switch it on from the account
menu ("Act as admin"), and the switch is stored on the **session**, so it applies to that
browser only and resets at sign-out. While acting as admin the avatar carries an accent
ring, and:

- every private design is readable (Browse gains "Private designs" and "Everything");
- the curated system designs (owner-less `reference` and `imported` designs) are writable:
  canvas, YAML editor, rename, publish;
- members' own designs stay read-only to the admin.

Revoking a grant also turns the switch off on every session of that user, so the change
takes effect on their next request.

## Head and release

A design has two pointers:

- **head** (`current_version_id`): moves on every save. Writers work here; autosave keeps
  it current.
- **release** (`published_version_id`): what everyone else sees. Moves only on **Publish**.

Consequences:

- Readers of a public design keep seeing the release while its writer edits. The design
  page shows the writer a `draft` tag and a Publish button while head and release differ;
  the canvas toolbar has the same button (unsaved edits are saved first).
- A new design is private with no release. Making it public with nothing released
  releases the head at that moment, so a public page is never empty. Publishing a private
  design is allowed; the release shows once the design is public.
- A design created public (the seeded curated designs, an explicit public create) is
  released at creation.

## Versions

Every save is a version row. Two rules keep the history meaningful:

- **Coalescing.** A save by the same author, within ten minutes of the head, when the
  head has not been released and the save carries no message, rewrites the head in place.
  Autosave fires at every pause; without this, history would be keystrokes. A released
  version is never rewritten.
- **Releases are the public history.** Readers can list and open released versions only
  (`published_at` is set). The writer sees every save, with `released` and `draft` marks.
  A `?v=<id>` link to an unreleased version returns not-found to a reader.
