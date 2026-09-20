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
export const roleEnum = pgEnum("role", ["admin"]);

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
    // An admin signs in as an ordinary member; this session-scoped switch turns the role on.
    actingAdmin: boolean("acting_admin").notNull().default(false),
  },
  (t) => [uniqueIndex("sessions_token").on(t.tokenHash), index("sessions_user").on(t.userId)],
);

// Role assignments with their history: a grant row per assignment, closed by revoked_at.
// A user holds a role while an open grant exists.
export const roleGrants = pgTable(
  "role_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    grantedById: uuid("granted_by_id").references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    revokedById: uuid("revoked_by_id").references(() => users.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    note: text("note"),
  },
  (t) => [index("role_grants_user").on(t.userId, t.role)],
);

export const designs = pgTable(
  "designs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    // The long description, Markdown, written by the owner. Plain text in the column: it is
    // rendered at read time, never stored as HTML.
    readme: text("readme"),
    visibility: visibilityEnum("visibility").notNull().default("private"),
    origin: originEnum("origin").notNull().default("authored"),
    sourceDesignId: uuid("source_design_id"),
    // The head: every save moves it. Only the owner (or an acting admin) sees it.
    currentVersionId: uuid("current_version_id"),
    // The release: what everyone else sees. Moves only on publish.
    publishedVersionId: uuid("published_version_id"),
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

// Every address a design has ever answered to once it was public. A rename writes the old slug
// here and a first publish writes the current one, so a released address keeps resolving and is
// never claimable by anything else -- including by its own owner, whose new design under an old
// name would silently serve different content to every link already out there.
//
// Rows point at the design, not at the next name, so a design renamed ten times still resolves
// every old address in one hop with no chain to walk or repair.
export const designSlugs = pgTable(
  "design_slugs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id),
    slug: text("slug").notNull(),
    designId: uuid("design_id").notNull(),
    reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("design_slugs_owner_slug").on(
      sql`coalesce(${t.ownerId}::text, '')`,
      sql`lower(${t.slug})`,
    ),
    index("design_slugs_design").on(t.designId),
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
    // Set when this version was released; readers only ever see released versions.
    publishedAt: timestamp("published_at", { withTimezone: true }),
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
export type RoleGrant = typeof roleGrants.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
