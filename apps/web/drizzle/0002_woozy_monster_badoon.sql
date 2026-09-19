CREATE TABLE "design_slugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"slug" text NOT NULL,
	"design_id" uuid NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_slugs" ADD CONSTRAINT "design_slugs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "design_slugs_owner_slug" ON "design_slugs" USING btree (coalesce("owner_id"::text, ''),lower("slug"));--> statement-breakpoint
CREATE INDEX "design_slugs_design" ON "design_slugs" USING btree ("design_id");--> statement-breakpoint
-- Backfill: every design that is already public has an address the world may have linked to,
-- so it reserves that address now rather than only from its next publish.
INSERT INTO "design_slugs" ("owner_id", "slug", "design_id", "reserved_at")
SELECT "owner_id", "slug", "id", "published_at"
FROM "designs"
WHERE "visibility" = 'public' AND "deleted_at" IS NULL AND "published_at" IS NOT NULL
ON CONFLICT DO NOTHING;
