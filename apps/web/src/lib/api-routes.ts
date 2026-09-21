// The HTTP surface, as a list.
//
// The table on `/docs/api` is drawn from this and nothing else, and
// `apps/web/src/lib/api-routes.test.ts` walks `app/api` and fails when the two disagree — so a
// route added, removed or given another method cannot quietly leave the documentation behind.
// The handlers are not read at request time: the running app should not depend on its own source
// being on disk.
//
// `auth` says what the endpoint needs from the caller. `summary` is one sentence; the request and
// response shapes are written out on the page, where there is room for them.

export type ApiRoute = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  auth: "none" | "viewer" | "owner" | "admin" | "token";
  summary: string;
};

export const API_ROUTES: ApiRoute[] = [
  // ---- designs
  {
    method: "GET",
    path: "/api/v1/designs",
    auth: "none",
    summary: "List and search designs the caller may see.",
  },
  {
    method: "POST",
    path: "/api/v1/designs",
    auth: "viewer",
    summary: "Create a design from YAML.",
  },
  {
    method: "GET",
    path: "/api/v1/designs/{owner}/{slug}",
    auth: "none",
    summary: "One design with its owner, stats, permissions and head version.",
  },
  {
    method: "PATCH",
    path: "/api/v1/designs/{owner}/{slug}",
    auth: "owner",
    summary: "Change title, address, summary, README, visibility or tags.",
  },
  {
    method: "DELETE",
    path: "/api/v1/designs/{owner}/{slug}",
    auth: "owner",
    summary: "Delete a design; a published one leaves a tombstone.",
  },
  {
    method: "PUT",
    path: "/api/v1/designs/{owner}/{slug}/version",
    auth: "owner",
    summary: "Save a new version of the YAML. Requires the last-seen content hash.",
  },
  {
    method: "GET",
    path: "/api/v1/designs/{owner}/{slug}/versions",
    auth: "none",
    summary: "Version history: releases for a reader, every save for the writer.",
  },
  {
    method: "POST",
    path: "/api/v1/designs/{owner}/{slug}/publish",
    auth: "owner",
    summary: "Release the head as what readers see.",
  },
  {
    method: "POST",
    path: "/api/v1/designs/{owner}/{slug}/clone",
    auth: "viewer",
    summary: "Copy a design into the caller's account.",
  },
  {
    method: "GET",
    path: "/api/v1/designs/{owner}/{slug}/yaml",
    auth: "none",
    summary: "The design source as text/yaml.",
  },
  {
    method: "GET",
    path: "/api/v1/designs/{owner}/{slug}/layout",
    auth: "none",
    summary: "The layout sidecar: node positions and edge bows.",
  },
  {
    method: "GET",
    path: "/api/v1/designs/{owner}/{slug}/render",
    auth: "none",
    summary: "Server-side render: SVG or Mermaid.",
  },
  {
    method: "POST",
    path: "/api/v1/designs/{owner}/{slug}/events",
    auth: "none",
    summary: "Record an export event for the design's counters.",
  },
  // ---- linting and the catalogue
  {
    method: "POST",
    path: "/api/v1/lint",
    auth: "none",
    summary: "Structure and rules over a design text, without storing it.",
  },
  {
    method: "GET",
    path: "/api/v1/catalogue",
    auth: "none",
    summary: "Redirect to the current catalogue bundle.",
  },
  // ---- accounts
  { method: "GET", path: "/api/v1/me", auth: "viewer", summary: "The signed-in account." },
  {
    method: "PATCH",
    path: "/api/v1/me",
    auth: "viewer",
    summary: "Change the caller's display name or bio.",
  },
  {
    method: "GET",
    path: "/api/v1/users/{username}",
    auth: "none",
    summary: "A public profile and the designs the caller may see.",
  },
  // ---- administration
  {
    method: "GET",
    path: "/api/v1/admin/users",
    auth: "admin",
    summary: "Accounts and their roles.",
  },
  {
    method: "POST",
    path: "/api/v1/admin/grants",
    auth: "admin",
    summary: "Grant a role. Idempotent.",
  },
  {
    method: "DELETE",
    path: "/api/v1/admin/grants",
    auth: "admin",
    summary: "Revoke a role. The row stays, marked revoked.",
  },
  // ---- machine and operational surfaces outside /api/v1
  {
    method: "GET",
    path: "/api/health",
    auth: "none",
    summary: "Liveness and a database round trip.",
  },
  {
    method: "GET",
    path: "/api/metrics",
    auth: "token",
    summary: "The Prometheus scrape target, behind METRICS_TOKEN.",
  },
  {
    method: "GET",
    path: "/api/reference/{type}/{id}",
    auth: "none",
    summary: "The Markdown rendering behind /catalogue/.../<id>.md.",
  },
  {
    method: "GET",
    path: "/api/auth/github",
    auth: "none",
    summary: "Start the GitHub OAuth flow.",
  },
  {
    method: "GET",
    path: "/api/auth/github/callback",
    auth: "none",
    summary: "Finish it and open a session.",
  },
  { method: "POST", path: "/api/auth/logout", auth: "viewer", summary: "End the session." },
  {
    method: "POST",
    path: "/api/auth/mode",
    auth: "admin",
    summary: "Turn admin presence on or off for this session.",
  },
];

/** The rows of `/api/v1`, which is the part of the surface that is a product rather than plumbing. */
export const v1Routes = () => API_ROUTES.filter((r) => r.path.startsWith("/api/v1/"));

/** Everything else: health, metrics, the markdown rendering, the sign-in dance. */
export const otherRoutes = () => API_ROUTES.filter((r) => !r.path.startsWith("/api/v1/"));
