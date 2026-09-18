# Zeema Grafana: the stock image with this repository's provisioning and dashboards baked in,
# so a deployment needs no files on the host and can run from a pasted compose file.
# Build from the repository root:
#   docker build -f ops/grafana/Dockerfile -t zeema-grafana .
FROM grafana/grafana:11.6.0

# Datasources and the dashboard provider. Grafana applies these at start and re-applies them
# on every restart, so the repository stays the source of truth for both. The datasource file
# still reads $GRAFANA_DB_PASSWORD from the environment at run time; nothing secret is baked in.
COPY ops/grafana/provisioning /etc/grafana/provisioning
COPY ops/grafana/dashboards /var/lib/grafana/dashboards
