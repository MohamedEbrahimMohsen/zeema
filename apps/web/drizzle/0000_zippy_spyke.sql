CREATE TYPE "public"."event_kind" AS ENUM('view', 'clone', 'export');--> statement-breakpoint
CREATE TYPE "public"."origin" AS ENUM('authored', 'imported', 'reference');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "design_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_id" uuid NOT NULL,
	"actor_id" uuid,
	"kind" "event_kind" NOT NULL,
	"format" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_stats" (
	"design_id" uuid PRIMARY KEY NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"clone_count" integer DEFAULT 0 NOT NULL,
	"export_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_id" uuid NOT NULL,
	"yaml" text NOT NULL,
	"layout" jsonb,
	"content_hash" text NOT NULL,
	"author_id" uuid,
	"message" text,
	"broken" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"origin" "origin" DEFAULT 'authored' NOT NULL,
	"source_design_id" uuid,
	"current_version_id" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reserved_usernames" (
	"username" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"released_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_id" bigint NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "design_events" ADD CONSTRAINT "design_events_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_events" ADD CONSTRAINT "design_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_stats" ADD CONSTRAINT "design_stats_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserved_usernames" ADD CONSTRAINT "reserved_usernames_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_design_created" ON "design_events" USING btree ("design_id","created_at");--> statement-breakpoint
CREATE INDEX "versions_design_created" ON "design_versions" USING btree ("design_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "designs_owner_slug" ON "designs" USING btree (coalesce("owner_id"::text, ''),lower("slug"));--> statement-breakpoint
CREATE INDEX "designs_owner_updated" ON "designs" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "designs_visibility_updated" ON "designs" USING btree ("visibility","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_github_id" ON "users" USING btree ("github_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username" ON "users" USING btree (lower("username"));