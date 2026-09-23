-- What Grafana may read, and nothing more. The read-only account grafana_ro is granted SELECT on
-- this schema alone (ops/postgres/init/10-grafana-ro.sh) and has no access to public, so the
-- sessions, role grants, design versions (the text of private designs) and hashed addresses
-- stay out of reach. Each view exposes only the columns the dashboards use or could sensibly
-- use: counts, titles, visibility, timestamps. Views run with their owner's rights, so the
-- account needs no grant on the underlying tables.
CREATE SCHEMA IF NOT EXISTS grafana;
--> statement-breakpoint
CREATE OR REPLACE VIEW grafana.designs AS
  SELECT id, owner_id, slug, title, visibility, origin, created_at, updated_at, published_at, deleted_at
  FROM public.designs;
--> statement-breakpoint
CREATE OR REPLACE VIEW grafana.design_stats AS
  SELECT design_id, view_count, clone_count, export_count, updated_at
  FROM public.design_stats;
--> statement-breakpoint
CREATE OR REPLACE VIEW grafana.design_events AS
  SELECT id, design_id, kind, format, created_at
  FROM public.design_events;
--> statement-breakpoint
CREATE OR REPLACE VIEW grafana.users AS
  SELECT id, username, created_at
  FROM public.users;
