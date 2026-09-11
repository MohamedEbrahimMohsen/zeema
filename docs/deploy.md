# Deploying the Arkore platform

The web app is one process. It needs a Postgres database and a GitHub OAuth app. Everything
else (migrations, seeding the curated designs, the catalogue bundle) happens at build or boot.

## 1. Environment

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | production: yes | Postgres connection string. Unset locally to use the embedded database under `apps/web/.pglite` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | yes for sign-in | From a GitHub OAuth app (below). Without them, reading works and creating is disabled |
| `APP_ORIGIN` | yes | The public origin, e.g. `https://arkore.example.com`. Used for the OAuth callback |
| `AUTH_DEV_LOGIN` | local only | `1` offers a local account on `/signin`. Ignored in production |
| `AUTO_SEED` | no | `0` disables seeding the curated designs into an empty store |
| `EVENT_SALT` | recommended | Salt for hashed network addresses in the event log |
| `ARKORE_ROOT` | no | Repository root holding `kinds/`, `components/`, `designs/`. Defaults to the monorepo root |

## 2. GitHub OAuth app

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.

- Homepage URL: your `APP_ORIGIN`.
- Authorization callback URL: `<APP_ORIGIN>/api/auth/github/callback`.
- Copy the client id and generate a client secret into the environment.

Only the `read:user` scope is requested. The access token is used once to read the profile and
is not stored.

## 3. Database

Any Postgres 14+ works (a managed instance is simplest). Migrations under `apps/web/drizzle`
run automatically on the first request after boot. Take backups of the database; every design
version is a row in `design_versions`.

## 4. Build and run

With Docker, from the repository root:

```bash
docker build -f apps/web/Dockerfile -t arkore-web .
docker run -p 3000:3000 -e DATABASE_URL=... -e GITHUB_CLIENT_ID=... -e GITHUB_CLIENT_SECRET=... -e APP_ORIGIN=https://arkore.example.com arkore-web
```

Without Docker:

```bash
pnpm install
pnpm --filter @arkore/web build
cd apps/web && DATABASE_URL=... GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=... APP_ORIGIN=... pnpm start
```

Put the process behind TLS (a reverse proxy or the platform's ingress). The session cookie is
marked `Secure` in production, so plain HTTP will not keep anyone signed in.

## 5. First boot

On an empty database the server seeds the 19 curated designs (7 reference with their broken
twins, 12 imported) as public, owner-less, read-only designs. Anyone can browse, open them on
the canvas and export; a signed-in user can clone one into their own account.

## 6. Checks

- `GET /api/v1/designs` returns the seeded list.
- `/signin` shows "Continue with GitHub" (and no local account).
- After signing in, `/new` creates a design, `/d/<user>/<slug>/canvas` opens it, edits autosave.
