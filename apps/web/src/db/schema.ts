// The platform data model (docs/final-plan.md, section 14). YAML is stored verbatim as text so
// byte preservation survives storage; every save is an immutable version.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const visibilityEnum = pgEnum("visibility", ["public", "private"]);
export const originEnum = pgEnum("origin", ["authored", "imported", "reference"]);
export const eventKindEnum = pgEnum("event_kind", ["view", "clone", "export"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    githubId: bigint("github_id", { mode: "number" }).notNull(),
    username: text("username").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_github_id").on(t.githubId),
    uniqueIndex("users_username").on(sql`lower(${t.username})`),
  ],
);

export const reservedUsernames = pgTable("reserved_usernames", {
  username: text("username").primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  releasedAt: timestamp("released_at", { withTimezone: true }).notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revoked: boolean("revoked").notNull().default(false),
  },
  (t) => [uniqueIndex("sessions_token").on(t.tokenHash), index("sessions_user").on(t.userId)],
);

export const designs = pgTable(
  "designs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    visibility: visibilityEnum("visibility").notNull().default("private"),
    origin: originEnum("origin").notNull().default("authored"),
    sourceDesignId: uuid("source_design_id"),
    currentVersionId: uuid("current_version_id"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    searchText: text("search_text").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("designs_owner_slug").on(
      sql`coalesce(${t.ownerId}::text, '')`,
      sql`lower(${t.slug})`,
    ),
    index("designs_owner_updated").on(t.ownerId, t.updatedAt),
    index("designs_visibility_updated").on(t.visibility, t.updatedAt),
  ],
);

export const designVersions = pgTable(
  "design_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    yaml: text("yaml").notNull(),
    layout: jsonb("layout"),
    contentHash: text("content_hash").notNull(),
    authorId: uuid("author_id").references(() => users.id),
    message: text("message"),
    broken: boolean("broken").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("versions_design_created").on(t.designId, t.createdAt)],
);

export const designStats = pgTable("design_stats", {
  designId: uuid("design_id")
    .primaryKey()
    .references(() => designs.id, { onDelete: "cascade" }),
  viewCount: integer("view_count").notNull().default(0),
  cloneCount: integer("clone_count").notNull().default(0),
  exportCount: integer("export_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const designEvents = pgTable(
  "design_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id),
    kind: eventKindEnum("kind").notNull(),
    format: text("format"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_design_created").on(t.designId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Design = typeof designs.$inferSelect;
export type DesignVersion = typeof designVersions.$inferSelect;
