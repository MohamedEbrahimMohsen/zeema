# Deploying the Zeema platform

The web app is one Node process in front of a Postgres database. Migrations and the seeding of
the curated designs happen at boot, so a fresh deployment needs no manual steps.

The supported way to run it is the compose stack at the repository root: the app, its database,
and the monitoring that watches both.

## 1. Start the stack

```bash
cp .env.example .env
```

Fill in the five required secrets in `.env`. Generate each with `openssl rand -hex 24`:

| Variable | What it protects |
|---|---|
| `POSTGRES_PASSWORD` | The database |
| `METRICS_TOKEN` | `/api/metrics`, and the token Prometheus presents to scrape it |
| `GRAFANA_PASSWORD` | The Grafana admin account |
| `GRAFANA_DB_PASSWORD` | The read-only database account Grafana queries with |
| `EVENT_SALT` | The hashed network addresses in the event log. The app refuses to start in production without a real one |

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
| `landing` | 4000 | every interface |
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
| `METRICS_TOKEN` | yes | Token for `/api/metrics`, sent as `Authorization: Bearer <token>` or `X-Metrics-Token: <token>`, never in the URL. Without a match, or with no token set in production, the endpoint answers 404 |
| `GRAFANA_PASSWORD` | yes | Grafana admin password |
| `GRAFANA_DB_PASSWORD` | yes | Password for `grafana_ro`, the read-only database account Grafana queries with |
| `APP_ORIGIN` | yes | The public origin, such as `https://zeema.example.com`. Used for the OAuth callback, the sign-in redirect check, the cross-site write check, and HSTS (sent only when this is `https://`) |
| `CANVAS_URL` | no | Where the landing page's "Open Canvas" and "Get started" buttons send visitors. Defaults to `APP_ORIGIN` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | for sign-in | From a GitHub OAuth app. Without them, reading works and creating is disabled |
| `ZEEMA_ADMINS` | once | Usernames granted the admin role at their next sign-in. See `roles-and-publishing.md` |
| `EVENT_SALT` | yes | Salt for the hashed network addresses in the event log. Production refuses to start when it is unset, `zeema` or `change-me` |
| `TRUSTED_PROXY` | behind a proxy | How many reverse proxies in front of the app append to `X-Forwarded-For`. `0` (default in `docker-compose.yml`) ignores the header; `1` (default in `docker-compose.deploy.yml`) takes its rightmost entry as the client. See section 8 |
| `AUTO_SEED` | no | `0` skips seeding the curated designs into an empty database |
| `DATABASE_URL` | outside compose | Postgres connection string. Unset locally to use the embedded database under `apps/web/.pglite`. Production refuses to start without it, and `/api/health` answers 503 with `"database":"not configured"` |
| `ZEEMA_ROOT` | no | Repository root holding `kinds/`, `components/`, `designs/`. Defaults to the monorepo root |

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

Grafana also reads the application database directly, as `grafana_ro`. This is for the panels
Prometheus cannot serve: a view count per design would be one time series per design, which is
exactly the cardinality Prometheus is bad at, and the number already sits in `design_stats`.

`grafana_ro` reads views, not tables. The app's migration `0004_grafana_views` creates a
`grafana` schema holding four views. The account can SELECT those and nothing else; its
`search_path` is `grafana` and every session it opens is read-only:

| View | Columns |
|---|---|
| `grafana.designs` | `id, owner_id, slug, title, visibility, origin, created_at, updated_at, published_at, deleted_at` |
| `grafana.design_stats` | `design_id, view_count, clone_count, export_count, updated_at` |
| `grafana.design_events` | `id, design_id, kind, format, created_at` (no address hash, no actor) |
| `grafana.users` | `id, username, created_at` |

Sessions, role grants, design versions (the text of private designs) and everything else in
`public` are out of its reach. A panel that needs another column needs a view change in a
migration, which is the point.

The role is created by `ops/postgres/init/10-grafana-ro.sh` when the database is first
initialised. Postgres runs init scripts only on an empty data directory, so on a database that
already exists, including one set up with the older blanket grants, run it once by hand. It
revokes the old grants and is safe to repeat:

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
`ops/grafana/provisioning`, the dashboard is `ops/grafana/dashboards/zeema-overview.json`, and
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
15 3 * * * cd /srv/zeema && ./ops/backup.sh >> /var/log/zeema-backup.log 2>&1
```

Copy the dumps off the machine too, and restore one into a scratch database once so you know
the procedure works. Every design version is a row in `design_versions`, so a restore brings
back history as well as current state. The curated reference designs are also files in
`designs/reference/`, and an empty database reseeds itself from them.

### Resetting a deployment for a beta

`apps/web/src/db/keep-only.ts` keeps one account's designs and deletes every other design: the
curated ones and every other member's. Accounts stay. Deleted designs are purged, not
tombstoned: versions, stats, events, notifications and reserved addresses (`design_slugs`) go
with them, in one transaction. It refuses an account with no designs, because an empty designs
table is reseeded at the next boot.

1. Take a backup first (section 6): `./ops/backup.sh`.
2. Dry run. Nothing is written without `--yes`; the output lists what would be deleted and kept
   (owner, slug, visibility, version count) with totals:

   ```bash
   docker compose exec web sh -c "cd apps/web && node --import tsx/esm src/db/keep-only.ts --owner <username>"
   ```

3. Apply it, optionally making every kept design public with `--public`. That goes through the
   same service call as the design page's "Make public": a design with no release has its head
   released, and a design its owner cannot edit (or with no version) is listed and left private.
   Run the dry run with `--public` first to see that list.

   ```bash
   docker compose exec web sh -c "cd apps/web && node --import tsx/esm src/db/keep-only.ts --owner <username> --public --yes"
   ```

   `--include-curated-only` deletes only the curated designs and keeps every member's.
4. Set `AUTO_SEED=0` in `.env` (or the Docker Manager environment) and recreate the app, so an
   empty table is never reseeded: `docker compose up -d web`.

With `docker-compose.deploy.yml` (Hostinger), run `export COMPOSE_FILE=docker-compose.deploy.yml`
in the directory holding it first; every `docker compose` call above, the one inside
`ops/backup.sh` included, then targets that stack. The script ships in the `zeema-web` image, so
pull an image built after it was added (`docker compose pull web && docker compose up -d web`).

#### Moving one account's designs to another deployment

`apps/web/src/db/export-owner.ts` and `import-owner.ts` carry one account's designs from one
deployment to another: every version in order (YAML byte for byte, layout sidecars with it), the
head and the release, visibility, reserved addresses (`design_slugs`), stats, timestamps to the
microsecond, and tombstones (flagged, so the addresses they hold stay reserved;
`--no-tombstones` leaves them out). Sessions, notifications, events and follows stay behind.
The bundle is plain JSON, LF, in a fixed order.

The import gives every row a new id and remaps every pointer. It credits versions the account
wrote to the target account and drops anyone else's authorship. The account must exist on the
target, matched by username ignoring case: sign in there once first. An address the account
already uses on the target is refused unless `--replace`, which purges that target design (no
tombstone) in the same transaction before inserting. Curated designs live in their own
namespace: a curated design or reservation with the same name is reported and left alone. The
import deletes nothing else; run `keep-only.ts` afterwards, so the designs table is never empty
in between.

1. On the source, write the bundle and copy it out of the container:

   ```bash
   docker compose exec web sh -c "cd apps/web && node --import tsx/esm src/db/export-owner.ts --owner <username> --out /tmp/<username>-designs.json"
   docker compose cp web:/tmp/<username>-designs.json ./<username>-designs.json
   ```

2. On the target (`export COMPOSE_FILE=docker-compose.deploy.yml` first on Hostinger), with an
   image that carries both scripts, take a backup and copy the bundle in:

   ```bash
   docker compose pull web && docker compose up -d web
   ./ops/backup.sh
   docker compose cp ./<username>-designs.json web:/tmp/<username>-designs.json
   ```

3. Dry run, then apply. Each prints slug, visibility, versions, published and whether the
   design is inserted or replaces one already there:

   ```bash
   docker compose exec web sh -c "cd apps/web && node --import tsx/esm src/db/import-owner.ts --in /tmp/<username>-designs.json --owner <username> --replace"
   docker compose exec web sh -c "cd apps/web && node --import tsx/esm src/db/import-owner.ts --in /tmp/<username>-designs.json --owner <username> --replace --yes"
   ```

4. Then the reset above: `keep-only.ts --owner <username>` as a dry run, then with `--yes`, and
   `AUTO_SEED=0`.

## 7. Updating

```bash
git pull
docker compose up -d --build
```

Migrations run on the first request after boot. On Postgres they run under an advisory lock
(`pg_advisory_lock`), so replicas that start together take turns: the first applies the
migrations and the others wait, then find nothing left to do. Take a backup first when a
release adds a migration.

## 8. Without compose

```bash
pnpm install
pnpm --filter @zeema/web build
cd apps/web && DATABASE_URL=... GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=... APP_ORIGIN=... pnpm start
```

Put the process behind TLS. The session cookie is marked `Secure` in production, so plain HTTP
will not keep anyone signed in.

One Node process uses about one core, whatever the machine has. To use more, run several
containers behind a reverse proxy; they share the database, and migrations serialise themselves
(section 7). Rate limits are the exception: each process keeps its own in memory, so with N
replicas the effective limit is N times the per-process one.

### Behind a reverse proxy

Tell the app how many proxies sit in front of it with `TRUSTED_PROXY` (usually `1`). It then
reads the client address as the rightmost `X-Forwarded-For` entry, which is the one your proxy
wrote; anything the client put further left is ignored. With `TRUSTED_PROXY=0` the header is
ignored entirely and every anonymous caller shares one rate-limit bucket, which is the safe
setting whenever the app's port is reachable without the proxy. Never set it above `0` on a port
the internet can reach directly: anyone could then choose their own address.

#### Cloudflare Tunnel (Hostinger)

`docker-compose.deploy.yml` ships ready for a Cloudflare Tunnel, which is how the beta runs on a
Hostinger VPS. The `cloudflared` service dials out to Cloudflare, so no inbound port is opened.

1. In Cloudflare Zero Trust, Networks → Tunnels, create a tunnel (connector type Docker) and copy
   its token. Paste it as `CLOUDFLARE_TUNNEL_TOKEN` in Hostinger's Docker Manager environment
   (or the `.env` beside the file).
2. One tunnel serves both hostnames. In the tunnel's dashboard open the **Published applications**
   tab and add two routes, each with Type `HTTP`:
   - `beta.zeema.dev` → URL `landing:4000`
   - `beta-canvas.zeema.dev` → URL `web:3000`

   The URL is the compose service name and port, never `localhost` or the server IP: cloudflared
   runs in its own container on the compose network, where `localhost` is itself.
3. The origins default to the tunnel: `APP_ORIGIN=https://beta-canvas.zeema.dev` and
   `CANVAS_URL` follows it. The GitHub OAuth callback is
   `https://beta-canvas.zeema.dev/api/auth/github/callback`.
4. `TRUSTED_PROXY=1` (the default in this file): cloudflared is the one proxy.
5. `WEB_BIND` and `LANDING_BIND` default to `127.0.0.1`, so the ports answer only on the server
   itself; the tunnel reaches the containers over the compose network. Keep it that way, since
   `TRUSTED_PROXY=1` must never face a port the internet can reach.

### Security headers

The app sets these itself:

| Header | Value |
|---|---|
| `Content-Security-Policy` (pages) | `default-src 'self'; script-src 'self' 'nonce-<per request>' 'strict-dynamic'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://avatars.githubusercontent.com; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https://github.com` |
| `Content-Security-Policy` (the `render` SVG) | `sandbox; default-src 'none'; style-src 'unsafe-inline'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`, only when `APP_ORIGIN` is `https://` |

The page policy carries a fresh nonce per request (`apps/web/proxy.ts`), so a proxy must pass
the app's `Content-Security-Policy` through rather than replace it. The other headers a proxy
may set as well; the values agree. `'unsafe-inline'` applies to styles only, because the canvas
positions and colours shapes with inline styles; scripts never get it.

State-changing API requests (`POST`, `PUT`, `PATCH`, `DELETE`) are refused with 403 when their
`Origin` is neither `APP_ORIGIN` nor the host they were addressed to, or when a browser marks
them `Sec-Fetch-Site: cross-site`. A proxy must therefore keep the `Host` header or `APP_ORIGIN`
must be the public origin, which it has to be for sign-in anyway.

## 9. Checks after a deployment

- `curl localhost:3000/api/health` returns `{"status":"ok","database":"ok"}`.
- `curl -I localhost:3000/` shows the headers listed in section 8.
- `GET /api/v1/designs` returns the seeded list.
- `/signin` shows "Continue with GitHub".
- Prometheus, at `http://localhost:9090/targets`, shows `zeema-web` and `postgres` up.
- The Grafana dashboard "Zeema overview" draws traffic.
