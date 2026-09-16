# Deploying the Arkore platform

The web app is one Node process in front of a Postgres database. Migrations and the seeding of
the curated designs happen at boot, so a fresh deployment needs no manual steps.

The supported way to run it is the compose stack at the repository root: the app, its database,
and the monitoring that watches both.

## 1. Start the stack

```bash
cp .env.example .env
```

Fill in the four required secrets in `.env`. Generate each with `openssl rand -hex 24`:

| Variable | What it protects |
|---|---|
| `POSTGRES_PASSWORD` | The database |
| `METRICS_TOKEN` | `/api/metrics`, and the token Prometheus presents to scrape it |
| `GRAFANA_PASSWORD` | The Grafana admin account |
| `GRAFANA_DB_PASSWORD` | The read-only database account Grafana queries with |

Then:

```bash
docker compose up -d --build
```

The app is on port 3000. First boot seeds the curated designs, which takes a minute or two;
`docker compose logs -f web` shows the progress and `curl localhost:3000/api/health` reports
`ok` once the database is reachable.

## 2. What runs

| Service | Port | Reachable from |
|---|---|---|
| `web` | 3000 | every interface |
| `grafana` | 3001 | localhost |
| `prometheus` | 9090 | localhost |
| `db` | 5432 | localhost |
| `postgres-exporter` | 9187 | the compose network only |

Everything except the app binds to localhost, so on a server you reach Grafana through a
tunnel rather than exposing it:

```bash
ssh -L 3001:127.0.0.1:3001 you@your-server
```

Then open `http://localhost:3001` and sign in as `admin`. The bind addresses are all
`.env` settings if you would rather put Grafana behind your own reverse proxy with
authentication.

## 3. Environment

| Variable | Required | Meaning |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | Database password, used by the app, the exporter and backups |
| `METRICS_TOKEN` | yes | Bearer token for `/api/metrics`. Without a match the endpoint answers 404 |
| `GRAFANA_PASSWORD` | yes | Grafana admin password |
| `GRAFANA_DB_PASSWORD` | yes | Password for `grafana_ro`, the read-only database account Grafana queries with |
| `APP_ORIGIN` | yes | The public origin, such as `https://arkore.example.com`. Used for the OAuth callback |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | for sign-in | From a GitHub OAuth app. Without them, reading works and creating is disabled |
| `ARKORE_ADMINS` | once | Usernames granted the admin role at their next sign-in. See `roles-and-publishing.md` |
| `EVENT_SALT` | recommended | Salt for the hashed network addresses in the event log |
| `AUTO_SEED` | no | `0` skips seeding the curated designs into an empty database |
| `DATABASE_URL` | outside compose | Postgres connection string. Unset locally to use the embedded database under `apps/web/.pglite` |
| `ARKORE_ROOT` | no | Repository root holding `kinds/`, `components/`, `designs/`. Defaults to the monorepo root |

The embedded database is for local development only. It runs inside the app process, so it
cannot be shared by two processes or backed up while the app is running.

## 4. GitHub OAuth app

GitHub, then Settings, Developer settings, OAuth Apps, New OAuth App.

- Homepage URL: your `APP_ORIGIN`.
- Authorization callback URL: `<APP_ORIGIN>/api/auth/github/callback`.

Only the `read:user` scope is requested. The access token reads the profile once and is not
stored.

## 5. Monitoring

Prometheus scrapes two targets every fifteen seconds and keeps thirty days by default.

- **The app**, at `/api/metrics`. Response time and count for every request by route, method
  and status, taken from Node's own HTTP diagnostics channels so pages are measured as
  accurately as API calls. Route labels collapse dynamic segments, so every design page is one
  series called `/d/:owner/:slug`. Alongside those: the Node process metrics, counters for
  design creates, saves, publishes, clones, deletes, exports and sign-ins, and gauges for
  accounts, designs by visibility, unpublished drafts, stored versions and active sessions.
- **Postgres**, through `postgres-exporter`: connections, database size, transaction rates.

Grafana also reads the application database directly, as `grafana_ro`, an account that can
only SELECT. This is for the panels Prometheus cannot serve: a view count per design would be
one time series per design, which is exactly the cardinality Prometheus is bad at, and the
number already sits in `design_stats`. The role is created by
`ops/postgres/init/10-grafana-ro.sh` when the database is first initialised. On a database that
already exists, run it once by hand:

```bash
docker compose exec -T db sh /docker-entrypoint-initdb.d/10-grafana-ro.sh
```

The dashboard has, in order: requests per second, availability, 95th percentile latency and
24 hour uptime as headline numbers; requests per second split by section, where a section is a
part of the product such as canvas, design, browse or api; availability over time with the
error rate beside it; latency across everything at the 50th, 95th and 99th percentile; latency
per API endpoint; and the fifty most viewed and fifty most cloned designs. Two collapsed rows
hold content counts and the system panels.

Everything Grafana shows is provisioned from the repository. The datasources are
`ops/grafana/provisioning`, the dashboard is `ops/grafana/dashboards/arkore-overview.json`, and
both are reapplied on restart. An edit made in the Grafana interface survives restarts until
the repository file changes, at which point the file wins and the edit is gone. To keep a
change, export the dashboard JSON over the file in the repository.

Two numbers matter more than the rest. **Event loop lag** growing means the single Node thread
is saturated, which is the real ceiling on this app. **Latency per section** tells you which
part of the product is responsible.

## 6. Backups

The database lives in the `pgdata` named volume. `docker compose down` and `docker compose rm`
leave it alone; only `docker compose down -v` or an explicit `docker volume rm` destroys it.

A volume is not a backup. `ops/backup.sh` writes a compressed dump and prunes old ones:

```bash
./ops/backup.sh
```

Nightly, from the repository root:

```
15 3 * * * cd /srv/arkore && ./ops/backup.sh >> /var/log/arkore-backup.log 2>&1
```

Copy the dumps off the machine too, and restore one into a scratch database once so you know
the procedure works. Every design version is a row in `design_versions`, so a restore brings
back history as well as current state. The curated reference designs are also files in
`designs/reference/`, and an empty database reseeds itself from them.

## 7. Updating

```bash
git pull
docker compose up -d --build
```

Migrations run on the first request after boot. Take a backup first when a release adds a
migration.

## 8. Without compose

```bash
pnpm install
pnpm --filter @arkore/web build
cd apps/web && DATABASE_URL=... GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=... APP_ORIGIN=... pnpm start
```

Put the process behind TLS. The session cookie is marked `Secure` in production, so plain HTTP
will not keep anyone signed in.

One Node process uses about one core, whatever the machine has. To use more, run several
containers behind a reverse proxy; they share the database and need no coordination.

## 9. Checks after a deployment

- `curl localhost:3000/api/health` returns `{"status":"ok"}`.
- `GET /api/v1/designs` returns the seeded list.
- `/signin` shows "Continue with GitHub".
- Prometheus, at `http://localhost:9090/targets`, shows `arkore-web` and `postgres` up.
- The Grafana dashboard "Arkore overview" draws traffic.
