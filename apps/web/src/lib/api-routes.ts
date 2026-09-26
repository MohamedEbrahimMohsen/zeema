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
    path: "/api/v1/designs/{owner}/{slug}/discard-draft",
    auth: "owner",
    summary:
      "Throw the draft away: the release becomes the head again and the versions since it are deleted.",
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
    summary: "The layout sidecar: node positions, edge bows and ports.",
  },
  {
    method: "PATCH",
    path: "/api/v1/designs/{owner}/{slug}/layout",
    auth: "owner",
    summary: "Choose the list badge (or null for automatic): a layout-only save of the head.",
  },
  {
    method: "GET",
    path: "/api/v1/designs/{owner}/{slug}/render",
    auth: "none",
    summary: "Server-side render: SVG or Mermaid.",
  },
  {
    method: "GET",
    path: "/api/v1/designs/{owner}/{slug}/thumb",
    auth: "none",
    summary:
      "The list thumbnail: the drawing as SVG on the row card's colour. `version`, `v` (its thumb key: a matching key is cached for a year) and `theme` (light or dark).",
  },
  {
    method: "POST",
    path: "/api/v1/designs/{owner}/{slug}/events",
    auth: "none",
    summary:
      "Record a view for the design's counters, once per visitor an hour. Exports and clones are counted by the server.",
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
    summary: "A public profile, its stats and the designs the caller may see.",
  },
  {
    method: "PUT",
    path: "/api/v1/users/{username}/follow",
    auth: "viewer",
    summary: "Follow an account. Idempotent; 204. Limited to 60 follow changes an hour.",
  },
  {
    method: "DELETE",
    path: "/api/v1/users/{username}/follow",
    auth: "viewer",
    summary: "Stop following an account. Idempotent; 204.",
  },
  {
    method: "GET",
    path: "/api/v1/users/{username}/followers",
    auth: "none",
    summary: "Who follows an account, newest first, paginated. Public.",
  },
  {
    method: "GET",
    path: "/api/v1/users/{username}/following",
    auth: "none",
    summary: "Whom an account follows, newest first, paginated. Public.",
  },
  // ---- notifications
  {
    method: "GET",
    path: "/api/v1/notifications",
    auth: "viewer",
    summary: "The caller's notifications, newest first; unread=1 for unread only.",
  },
  {
    method: "POST",
    path: "/api/v1/notifications/read",
    auth: "viewer",
    summary: "Mark notifications read, by id or all at once; 204.",
  },
  {
    method: "GET",
    path: "/api/v1/notifications/unread-count",
    auth: "viewer",
    summary: "How many notifications are unread. Cheap enough to poll.",
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
  {
    method: "POST",
    path: "/api/auth/logout",
    auth: "viewer",
    summary: "End this session, or every session of the account with the form field scope=all.",
  },
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
