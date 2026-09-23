#!/bin/sh
# Grafana reads the application database directly for the panels Prometheus cannot serve: the
# top design lists, which are per-design and would be thousands of time series otherwise.
#
# It connects as grafana_ro, which can SELECT from the views in the `grafana` schema and nothing
# else. Those views (apps/web/drizzle/0004_grafana_views.sql) expose counts, titles, visibility
# and timestamps; the tables in `public` — sessions, role grants, design versions (the text of
# private designs), hashed addresses — are not readable at all.
#
# Postgres runs this once, when the data directory is first created. For a database that already
# exists, including one set up by an earlier version of this script with its blanket grants, run
# the same thing by hand; it revokes the old grants and is safe to re-run:
#   docker compose exec -T db sh /docker-entrypoint-initdb.d/10-grafana-ro.sh
set -eu

: "${GRAFANA_DB_PASSWORD:?GRAFANA_DB_PASSWORD is not set}"

# Values reach SQL as psql variables (:'pw' is a quoted literal, :"db" a quoted identifier),
# never pasted into the text, so a quote in a password cannot change the statement. The
# heredoc is quoted for the same reason: the shell expands nothing inside it.
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v pw="$GRAFANA_DB_PASSWORD" -v db="$POSTGRES_DB" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_ro') THEN
    CREATE ROLE grafana_ro LOGIN;
  END IF;
END
$$;

ALTER ROLE grafana_ro WITH PASSWORD :'pw';
GRANT CONNECT ON DATABASE :"db" TO grafana_ro;

-- The application's tables: nothing. This undoes the blanket grants earlier versions made.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM grafana_ro;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM grafana_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM grafana_ro;
REVOKE ALL ON SCHEMA public FROM grafana_ro;

-- The views Grafana is meant to read. The app's migration creates them; on a fresh volume the
-- schema is created here first so the grants below have something to attach to, and the
-- default privilege covers views the migration adds later.
CREATE SCHEMA IF NOT EXISTS grafana;
GRANT USAGE ON SCHEMA grafana TO grafana_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA grafana TO grafana_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA grafana GRANT SELECT ON TABLES TO grafana_ro;
REVOKE CREATE ON SCHEMA grafana FROM grafana_ro;

-- Dashboard queries name the views unqualified, and every session is read-only.
ALTER ROLE grafana_ro SET search_path = grafana;
ALTER ROLE grafana_ro SET default_transaction_read_only = on;
SQL

echo "grafana_ro ready"
