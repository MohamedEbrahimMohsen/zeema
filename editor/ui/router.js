// The address bar names the design, so a link to one is a link someone can send.
//
//   /editor/                                the design the editor picks on its own
//   /editor/chat-system                     that id, wherever it lives
//   /editor/imported/chat-system            that id in that tier, when two tiers share one
//   /editor/reference/doordash-delivery/broken   the deliberately broken variant
//
// Pure functions over the design index: no DOM, no history, so both directions can be tested
// without a browser. The page mounts at /editor/ and nothing here assumes anything else, which
// is why the mount point is an argument.

const BROKEN = "design.broken.yaml";

export function routeOf(entry, mount = "/editor/") {
  const broken = entry.path.endsWith(BROKEN) ? "/broken" : "";
  return `${mount}${entry.tier}/${entry.id}${broken}`;
}

// The shortest address that still names one design: an id on its own where it is unambiguous,
// and the tier in front of it where it is not.
export function shortRouteOf(entry, index, mount = "/editor/") {
  if (entry.path.endsWith(BROKEN)) return routeOf(entry, mount);
  const sameId = index.filter((e) => e.id === entry.id && !e.path.endsWith(BROKEN));
  return sameId.length === 1 ? `${mount}${entry.id}` : routeOf(entry, mount);
}

const TIERS = new Set(["reference", "imported", "authored"]);

// A path back to a design, or null for "no opinion", which is what the empty route means. An
// address that names nothing in the index is also null: a design can be deleted, and a stale
// link should open the editor rather than an error.
export function matchRoute(pathname, index, mount = "/editor/") {
  const rest = String(pathname || "").startsWith(mount) ? String(pathname).slice(mount.length) : "";
  const parts = rest.split("/").filter(Boolean);
  if (!parts.length || parts[0] === "index.html") return null;

  const wantsBroken = parts[parts.length - 1] === "broken";
  const named = wantsBroken ? parts.slice(0, -1) : parts;
  const [first, second] = named;
  const tier = TIERS.has(first) ? first : null;
  const id = tier ? second : first;
  if (!id) return null;

  const candidates = index.filter((e) => e.id === id && (!tier || e.tier === tier));
  if (!candidates.length) return null;
  const broken = candidates.find((e) => e.path.endsWith(BROKEN));
  const whole = candidates.find((e) => !e.path.endsWith(BROKEN));
  return (wantsBroken ? broken : whole) || whole || broken || null;
}
