// Identity and access management: who holds which role, and the grant/revoke operations
// behind the IAM page. Every call requires a viewer acting as admin; the checks live here.
import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Role, User } from "@/db/schema";
import { ServiceError } from "./designs";
import { actingAdmin, type SessionUser } from "./viewer";

export type IamUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  roles: Role[];
  /** The open admin grant, when there is one. */
  adminGrant: { grantedAt: Date; grantedBy: string | null; note: string | null } | null;
};

function requireAdmin(viewer: SessionUser | null) {
  if (!viewer) throw new ServiceError(401, "sign in first");
  if (!actingAdmin(viewer)) throw new ServiceError(403, "switch to admin to manage roles");
}

/** Users with their roles, most recent first; `q` filters by username or display name. */
export async function listUsers(
  viewer: SessionUser | null,
  opts: { q?: string; onlyAdmins?: boolean; limit?: number } = {},
): Promise<IamUser[]> {
  requireAdmin(viewer);
  const db = await getDb();
  const conds = [isNull(schema.users.deletedAt)];
  if (opts.q) {
    const t = `%${opts.q.trim()}%`;
    conds.push(sql`(${ilike(schema.users.username, t)} or ${ilike(schema.users.displayName, t)})`);
  }
  if (opts.onlyAdmins)
    conds.push(
      sql`exists (select 1 from role_grants g where g.user_id = ${schema.users.id} and g.role = 'admin' and g.revoked_at is null)`,
    );
  const users = await db
    .select()
    .from(schema.users)
    .where(and(...conds))
    .orderBy(desc(schema.users.createdAt))
    .limit(Math.min(500, opts.limit ?? 200));
  if (!users.length) return [];
  const grants = await db
    .select({
      userId: schema.roleGrants.userId,
      role: schema.roleGrants.role,
      grantedAt: schema.roleGrants.grantedAt,
      note: schema.roleGrants.note,
      grantedBy: sql<
        string | null
      >`(select username from users u where u.id = ${schema.roleGrants.grantedById})`,
    })
    .from(schema.roleGrants)
    .where(isNull(schema.roleGrants.revokedAt));
  const byUser = new Map<string, typeof grants>();
  for (const g of grants) byUser.set(g.userId, [...(byUser.get(g.userId) ?? []), g]);
  return users.map((u) => {
    const mine = byUser.get(u.id) ?? [];
    const admin = mine.find((g) => g.role === "admin");
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt,
      roles: [...new Set(mine.map((g) => g.role))],
      adminGrant: admin
        ? { grantedAt: admin.grantedAt, grantedBy: admin.grantedBy, note: admin.note }
        : null,
    };
  });
}

async function userByName(username: string): Promise<User> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(sql`lower(${schema.users.username})`, username.toLowerCase()),
        isNull(schema.users.deletedAt),
      ),
    )
    .limit(1);
  if (!rows[0]) throw new ServiceError(404, "no such user");
  return rows[0];
}

const ROLES: Role[] = ["admin"];
function checkRole(role: string): Role {
  if (!ROLES.includes(role as Role)) throw new ServiceError(400, `unknown role: ${role}`);
  return role as Role;
}

/** Open a grant. Idempotent: an existing open grant is returned untouched. */
export async function grantRole(
  viewer: SessionUser | null,
  input: { username: string; role: string; note?: string },
) {
  requireAdmin(viewer);
  const role = checkRole(input.role);
  const user = await userByName(input.username);
  const db = await getDb();
  const open = await db
    .select()
    .from(schema.roleGrants)
    .where(
      and(
        eq(schema.roleGrants.userId, user.id),
        eq(schema.roleGrants.role, role),
        isNull(schema.roleGrants.revokedAt),
      ),
    )
    .limit(1);
  if (open[0]) return { grant: open[0], created: false };
  const [grant] = await db
    .insert(schema.roleGrants)
    .values({
      userId: user.id,
      role,
      grantedById: viewer!.id,
      note: input.note?.slice(0, 200) || null,
    })
    .returning();
  return { grant, created: true };
}

/** Close the open grant. An admin cannot revoke their own admin role (no lock-outs by accident). */
export async function revokeRole(
  viewer: SessionUser | null,
  input: { username: string; role: string },
) {
  requireAdmin(viewer);
  const role = checkRole(input.role);
  const user = await userByName(input.username);
  if (user.id === viewer!.id && role === "admin")
    throw new ServiceError(400, "you cannot revoke your own admin role; ask another admin");
  const db = await getDb();
  const rows = await db
    .update(schema.roleGrants)
    .set({ revokedAt: new Date(), revokedById: viewer!.id })
    .where(
      and(
        eq(schema.roleGrants.userId, user.id),
        eq(schema.roleGrants.role, role),
        isNull(schema.roleGrants.revokedAt),
      ),
    )
    .returning();
  // Sessions that had the role switched on fall back to member on their next request.
  await db
    .update(schema.sessions)
    .set({ actingAdmin: false })
    .where(eq(schema.sessions.userId, user.id));
  return { revoked: rows.length > 0 };
}

/** The grant history of one user, newest first. */
export async function grantHistory(viewer: SessionUser | null, username: string) {
  requireAdmin(viewer);
  const user = await userByName(username);
  const db = await getDb();
  return db
    .select()
    .from(schema.roleGrants)
    .where(eq(schema.roleGrants.userId, user.id))
    .orderBy(desc(schema.roleGrants.grantedAt))
    .limit(50);
}
