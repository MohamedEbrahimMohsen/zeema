// The viewer shape shared by the service layer. Kept free of Next imports so scripts (seed,
// tests) can load the services without a request context.
import type { Role, User } from "@/db/schema";

/**
 * The signed-in user with what this request may do. `roles` is what the account holds;
 * `actingAdmin` is whether this session has switched the admin role on. Authorization checks
 * look at `actingAdmin`, never at `roles`, so an admin browsing as a member is a member.
 */
export type SessionUser = User & { sessionId: string; roles: Role[]; actingAdmin: boolean };

export const isAdmin = (u: SessionUser | null) => Boolean(u?.roles.includes("admin"));
export const actingAdmin = (u: SessionUser | null) => Boolean(u?.actingAdmin);
