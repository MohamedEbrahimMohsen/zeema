# Zeema Postgres: the stock image plus the one-time init that creates grafana_ro, the
# read-only account Grafana queries the application tables with. Baked in so a deployment
# needs no files on the host.
# Build from the repository root:
#   docker build -f ops/postgres/Dockerfile -t zeema-db .
FROM postgres:17-alpine

# Postgres runs everything in this directory once, when the data directory is first created.
COPY ops/postgres/init/ /docker-entrypoint-initdb.d/
