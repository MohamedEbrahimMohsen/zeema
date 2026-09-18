CREATE TYPE "public"."role" AS ENUM('admin');--> statement-breakpoint
CREATE TABLE "role_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"granted_by_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by_id" uuid,
	"revoked_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "design_versions" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "published_version_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "acting_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_revoked_by_id_users_id_fk" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "role_grants_user" ON "role_grants" USING btree ("user_id","role");--> statement-breakpoint
-- Backfill: every existing public design's head becomes its release, so readers keep seeing it.
UPDATE "designs" SET "published_version_id" = "current_version_id" WHERE "visibility" = 'public' AND "deleted_at" IS NULL;--> statement-breakpoint
UPDATE "design_versions" v SET "published_at" = v."created_at" FROM "designs" d WHERE d."published_version_id" = v."id";
