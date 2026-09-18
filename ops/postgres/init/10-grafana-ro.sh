#!/bin/sh
# Grafana reads the application tables directly for the panels Prometheus cannot serve: the
# top design lists, which are per-design and would be thousands of time series otherwise.
#
# It connects as grafana_ro, which can SELECT and nothing else. Postgres runs this once, when
# the data directory is first created. For a database that already exists, run the same thing
# by hand:
#   docker compose exec -T db sh /docker-entrypoint-initdb.d/10-grafana-ro.sh
# It is written to be safe to re-run.
set -eu

: "${GRAFANA_DB_PASSWORD:?GRAFANA_DB_PASSWORD is not set}"

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_ro') THEN
    CREATE ROLE grafana_ro LOGIN;
  END IF;
END
\$\$;

ALTER ROLE grafana_ro WITH PASSWORD '${GRAFANA_DB_PASSWORD}';
GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO grafana_ro;
GRANT USAGE ON SCHEMA public TO grafana_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_ro;
-- Tables created later by a migration are covered too, without re-running this.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_ro;
-- No writes, ever.
REVOKE CREATE ON SCHEMA public FROM grafana_ro;
SQL

echo "grafana_ro ready"
