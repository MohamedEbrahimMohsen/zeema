"""Catalogue lookup for the Zeema skills.

  python catalogue.py find <words...>        components / inventory rows matching the words (name, id, description)
  python catalogue.py component <id>         print the component file and its effective property set
  python catalogue.py kind <id>              kind properties and its components grouped by provider
  python catalogue.py kinds                  every kind with category and component count
  python catalogue.py providers <kind>       which providers have a component of this kind (gap check)
  python catalogue.py inventory <words...>   inventory rows only (includes skip rows and their reasons)

Exit code 0 when something matched, 1 when nothing matched.
"""
import glob, os, re, sys
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]
PROVIDERS = ["azure", "aws", "default", "gcp", "cloudflare", "oci", "ibm", "alibabacloud", "digitalocean", "openstack", "outscale", "k8s"]

def locale(): return yaml.safe_load((ROOT / "locales" / "en.yaml").read_text(encoding="utf-8"))

def components():
    out = {}
    for f in glob.glob(str(ROOT / "components" / "*" / "*.yaml")):
        d = yaml.safe_load(open(f, encoding="utf-8")); out[d["id"]] = d
    return out

def kinds():
    return {os.path.basename(f)[:-5]: yaml.safe_load(open(f, encoding="utf-8")) for f in glob.glob(str(ROOT / "kinds" / "*.yaml"))}

def inventory_rows():
    rows = []
    for f in sorted(glob.glob(str(ROOT / "docs" / "inventory" / "*.md"))):
        prov, family = os.path.basename(f)[:-3], ""
        for line in open(f, encoding="utf-8"):
            if line.startswith("## "): family = line[3:].strip(); continue
            if not line.startswith("|") or line.startswith("| resource") or line.startswith("|---"): continue
            cells = [c.strip().replace("—", "-") for c in line.strip().strip("|").split("|")]
            if len(cells) < 4: continue
            rows.append({"provider": prov, "family": family, "resource": cells[0], "id": cells[1], "kind": cells[2], "status": cells[3], "source": cells[4] if len(cells) > 4 else ""})
    return rows

STOP = {"account", "accounts", "service", "services", "azure", "aws", "amazon", "google", "gcp", "cloud", "oci", "oracle", "microsoft", "cloudflare", "ibm", "alibaba", "digitalocean", "openstack", "outscale", "kubernetes", "k8s", "the", "a", "an", "of", "for"}
def tokens(s):
    t = [t for t in re.split(r"[^a-z0-9]+", s.lower()) if t]
    return [x for x in t if x not in STOP] or t

def score(words, name, ident, desc):
    n, i, d = name.lower(), ident.lower(), desc.lower()
    phrase = " ".join(words)
    if phrase == n or phrase.replace(" ", "-") == i: return 100
    if phrase in n or phrase.replace(" ", "-") in i: return 80
    hit_n = sum(1 for w in words if w in n or w in i)
    hit_d = sum(1 for w in words if w in d)
    if hit_n == len(words): return 60
    if hit_n + hit_d == len(words): return 40
    if hit_n: return 20 * hit_n / len(words)
    return 0

def cmd_find(words, limit=20):
    words = tokens(" ".join(words)); loc = locale(); comps = components(); hits = []
    for cid, c in comps.items():
        e = loc["components"].get(cid, {}); s = score(words, e.get("name", cid), cid, e.get("description", ""))
        if s: hits.append((s, "component", c["provider"], cid, c["kind"], e.get("name", cid)))
    have = {h[3] for h in hits}
    for r in inventory_rows():
        if r["id"] in have: continue
        s = score(words, r["resource"], r["id"], r["family"])
        if s: hits.append((s, "inventory", r["provider"], r["id"] or "-", r["kind"] or "-", "%s [%s]" % (r["resource"], r["status"])))
    hits.sort(key=lambda h: (-h[0], h[2], h[3]))
    for s, src, prov, cid, kind, name in hits[:limit]:
        print("%3d %-9s %-10s %-45s %-24s %s" % (s, src, prov, cid, kind, name))
    return bool(hits)

def cmd_inventory(words):
    words = tokens(" ".join(words)); hits = []
    for r in inventory_rows():
        s = score(words, r["resource"], r["id"], r["family"] + " " + r["status"])
        if s: hits.append((s, r))
    hits.sort(key=lambda h: -h[0])
    for s, r in hits[:30]:
        print("%3d %-10s %-40s id=%-40s kind=%-22s %s  (%s)" % (s, r["provider"], r["resource"], r["id"], r["kind"], r["status"], r["family"]))
    return bool(hits)

def cmd_component(cid):
    files = glob.glob(str(ROOT / "components" / "*" / (cid + ".yaml")))
    if not files: print("no component", cid); return False
    print(open(files[0], encoding="utf-8").read())
    c = yaml.safe_load(open(files[0], encoding="utf-8")); k = kinds()[c["kind"]]
    print("# effective properties (kind + component; default from component then kind):")
    for p, d in {**k["properties"], **(c.get("properties") or {})}.items():
        dv = (c.get("defaults") or {}).get(p, d.get("default"))
        print("#   %-28s %-8s %s%s%s" % (p, d["type"], "values=%s " % d["values"] if d.get("values") else "", "default=%s" % dv if dv is not None else "", " required" if d.get("required") else ""))
    return True

def cmd_kind(kid):
    ks = kinds()
    if kid not in ks: print("no kind", kid); return False
    k = ks[kid]; print("kind %s (%s)" % (kid, k["category"]))
    for p, d in k["properties"].items():
        print("  %-28s %-8s %s%s%s" % (p, d["type"], "values=%s " % d["values"] if d.get("values") else "", "default=%s" % d.get("default") if "default" in d else "", " required" if d.get("required") else ""))
    by = {}
    for cid, c in components().items():
        if c["kind"] == kid: by.setdefault(c["provider"], []).append(cid)
    for prov in PROVIDERS:
        if by.get(prov): print("  %-10s %s" % (prov, ", ".join(sorted(by[prov]))))
    return True

def cmd_kinds():
    ks = kinds(); count = {}
    for c in components().values(): count[c["kind"]] = count.get(c["kind"], 0) + 1
    for kid in sorted(ks): print("%-26s %-10s %3d components" % (kid, ks[kid]["category"], count.get(kid, 0)))
    return True

def cmd_providers(kid):
    by = {p: [] for p in PROVIDERS}
    for cid, c in components().items():
        if c["kind"] == kid: by[c["provider"]].append(cid)
    for p in PROVIDERS: print("%-10s %s" % (p, ", ".join(sorted(by[p])) or "(none)"))
    return any(by.values())

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(2)
    cmd, rest = a[0], a[1:]
    ok = {"find": lambda: cmd_find(rest), "component": lambda: cmd_component(rest[0]), "kind": lambda: cmd_kind(rest[0]),
          "kinds": cmd_kinds, "providers": lambda: cmd_providers(rest[0]), "inventory": lambda: cmd_inventory(rest)}.get(cmd)
    if not ok: print(__doc__); sys.exit(2)
    sys.exit(0 if ok() else 1)
