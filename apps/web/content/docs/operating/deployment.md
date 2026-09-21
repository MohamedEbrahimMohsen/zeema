---
title: Deployment and operations
description: The compose stack, every environment variable by name, the metrics guard, Grafana's read-only role, and backups.
order: 2
---

The web app is one Node process in front of a Postgres database. Migrations and the seeding of
the curated designs happen at boot, so a fresh deployment needs no manual steps.

The supported way to run it is the compose stack at the repository root: the app, its database,
and the monitoring that watches both.

## Start the stack

```bash
cp .env.example .env
docker compose up -d --build
```

Four secrets must be filled in before the stack will start. Generate each one:

```bash
openssl rand -hex 24
```

| Variable | What it protects |
|---|---|
| `POSTGRES_PASSWORD` | The database |
| `METRICS_TOKEN` | `/api/metrics`, and the token Prometheus presents to scrape it |
| `GRAFANA_PASSWORD` | The Grafana admin account |
| `GRAFANA_DB_PASSWORD` | The read-only database account Grafana queries with |

> [!WARNING]
> Values never go in the repository, in a page like this one, or in a log line. Only the names
> are written down anywhere.

First boot seeds the curated designs, which takes a minute or two. `docker compose logs -f web`
shows the progress, and `curl localhost:3000/api/health` reports `ok` once the database is
reachable.

## What runs

| Service | Port | Reachable from |
|---|---|---|
| `web` | 3000 | every interface |
| `landing` | 4000 | every interface |
| `grafana` | 3001 | localhost |
| `prometheus` | 9090 | localhost |
| `db` | 5432 | localhost |
| `postgres-exporter` | 9187 | the compose network only |

Everything except the app binds to localhost, so on a server you reach Grafana through a tunnel
rather than exposing it:

```bash
ssh -L 3001:127.0.0.1:3001 you@your-server
```

The bind addresses are all settings, if you would rather put Grafana behind your own reverse
proxy with authentication.

## Environment

Names only. Every one of them is read from the environment; none has a value in the repository.

| Variable | Required | Meaning |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | Database password, used by the app, the exporter and backups |
| `METRICS_TOKEN` | yes | Bearer token for `/api/metrics`. Without a match the endpoint answers 404 |
| `GRAFANA_PASSWORD` | yes | Grafana admin password |
| `GRAFANA_DB_PASSWORD` | yes | Password for `grafana_ro`, the read-only database account |
| `APP_ORIGIN` | yes | The public origin. Used for the OAuth callback |
| `CANVAS_URL` | no | Where the landing page's buttons send visitors. Defaults to `APP_ORIGIN` |
| `GITHUB_CLIENT_ID` | for sign-in | From a GitHub OAuth app |
| `GITHUB_CLIENT_SECRET` | for sign-in | The same app's secret. Without these, reading works and creating is disabled |
| `ZEEMA_ADMINS` | once | Usernames granted the admin role at their next sign-in |
| `EVENT_SALT` | recommended | Salt for the hashed network addresses in the event log |
| `AUTO_SEED` | no | `0` skips seeding the curated designs into an empty database |
| `DATABASE_URL` | outside compose | Postgres connection string. Unset locally to use the embedded database |
| `ZEEMA_ROOT` | no | Repository root holding `kinds/`, `components/`, `designs/` |

## GitHub OAuth

GitHub, then Settings, Developer settings, OAuth Apps, New OAuth App.

- **Homepage URL:** your `APP_ORIGIN`.
- **Authorization callback URL:** `<APP_ORIGIN>/api/auth/github/callback`.

Only the `read:user` scope is requested. The access token reads the profile once and is not
stored.

## Monitoring

Prometheus scrapes two targets every fifteen seconds and keeps thirty days by default.

**The app**, at `/api/metrics`: response time and count for every request by route, method and
status, taken from Node's own HTTP diagnostics channels, so pages are measured as accurately as
API calls. Route labels collapse dynamic segments, so every design page is one series called
`/d/:owner/:slug`. Alongside those: the Node process metrics, counters for design creates, saves,
publishes, clones, deletes, exports and sign-ins, and gauges for accounts, designs by visibility,
unpublished drafts, stored versions and active sessions.

**Postgres**, through `postgres-exporter`: connections, database size, transaction rates.

### The metrics guard

`/api/metrics` is never published to the internet. In compose it is reachable on the internal
network only, and where the port is exposed at all, `METRICS_TOKEN` gates it: a request without a
matching `Authorization: Bearer` header — or `?token=` — answers **404**, not 401. An endpoint
that admits it exists is an endpoint worth attacking.

### Grafana's read-only role

Grafana also reads the application database directly, as `grafana_ro`, an account that can only
`SELECT`. That is for the panels Prometheus cannot serve: a view count per design would be one
time series per design, which is exactly the cardinality Prometheus is bad at, and the number
already sits in a table.

The role is created when the database is first initialised. On a database that already exists,
run it once by hand:

```bash
docker compose exec -T db sh /docker-entrypoint-initdb.d/10-grafana-ro.sh
```

Everything Grafana shows is provisioned from the repository, and both the datasources and the
dashboard are reapplied on restart. An edit made in the Grafana interface survives restarts until
the repository file changes, at which point the file wins and the edit is gone. To keep a change,
export the dashboard JSON over the file.

> [!TIP]
> Two numbers matter more than the rest. **Event loop lag** growing means the single Node thread
> is saturated, which is the real ceiling on this app. **Latency per section** tells you which
> part of the product is responsible.

## Backups

The database lives in a named volume. `docker compose down` and `docker compose rm` leave it
alone; only `docker compose down -v` or an explicit volume removal destroys it.

A volume is not a backup. The backup script writes a compressed dump and prunes old ones:

```bash
./ops/backup.sh
```

Nightly, from the repository root:

```text
15 3 * * * cd /srv/zeema && ./ops/backup.sh >> /var/log/zeema-backup.log 2>&1
```

Copy the dumps off the machine, and restore one into a scratch database once, so you know the
procedure works. Every design version is a row, so a restore brings back history as well as
current state — and the curated reference designs are also files in the repository, so an empty
database reseeds itself from them.

## Updating

```bash
git pull
docker compose up -d --build
```

Migrations run on the first request after boot. Take a backup first when a release adds one.

## Without compose

```bash
pnpm install
pnpm --filter @zeema/web build
cd apps/web && pnpm start
```

`DATABASE_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `APP_ORIGIN` come from the
environment. Put the process behind TLS: the session cookie is marked `Secure` in production, so
plain HTTP will not keep anyone signed in.

One Node process uses about one core, whatever the machine has. To use more, run several
containers behind a reverse proxy; they share the database and need no coordination.

## Checks after a deployment

- `curl localhost:3000/api/health` returns `{"status":"ok"}`.
- `GET /api/v1/designs` returns the seeded list.
- `/signin` shows "Continue with GitHub".
- Prometheus, at `/targets`, shows both targets up.
- The Grafana overview dashboard draws traffic.
