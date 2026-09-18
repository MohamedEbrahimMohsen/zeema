"""locales/en.yaml maintenance.

  python zeema_locale.py add <snippet.yaml> [...]   merge entries, rewrite sorted
  python zeema_locale.py check                      report ids without entry / entries without file
  python zeema_locale.py prune                      drop entries whose id has no file

A snippet is either {kinds: {...}, components: {...}, rules: {...}} or a flat
{<id>: {name, description}} map, which is treated as components.
"""
import glob, os, sys
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]
EN = ROOT / "locales" / "en.yaml"
CATEGORIES = {"messaging": "Messaging", "compute": "Compute", "data": "Data", "edge": "Edge",
              "external": "External", "client": "Client", "ops": "Operations", "security": "Security"}

def q(s): return '"' + str(s).replace('"', "'") + '"'

def ids_on_disk(folder):
    return {os.path.basename(f)[:-5] for f in glob.glob(str(ROOT / folder / "**" / "*.yaml"), recursive=True)}

def load():
    return yaml.safe_load(EN.read_text(encoding="utf-8")) or {}

def write(doc):
    def block(title, d):
        lines = [title + ":"]
        for k in sorted(d):
            v = d[k] or {}
            lines.append("  %s:" % k)
            lines.append("    name: %s" % q(v.get("name", k)))
            if v.get("description"): lines.append("    description: %s" % q(v["description"]))
        return "\n".join(lines)
    cats = {k: {"name": v} for k, v in CATEGORIES.items()}
    out = ["# English display text, keyed by id. Kinds, components and rules never carry display",
           "# text themselves. Every id in kinds/, components/ and rules/ must have an entry here.",
           "# Regenerated from the catalogue; keep entries sorted by id.",
           block("categories", cats), "", block("kinds", doc.get("kinds", {})), "",
           block("components", doc.get("components", {})), "", block("rules", doc.get("rules", {})), ""]
    EN.write_text("\n".join(out), encoding="utf-8", newline="\n")

def merge(doc, snippet):
    if not snippet: return
    if any(k in snippet for k in ("kinds", "components", "rules")):
        for sec in ("kinds", "components", "rules"):
            doc.setdefault(sec, {}).update(snippet.get(sec) or {})
    else:
        doc.setdefault("components", {}).update(snippet)

def check(doc, verbose=True):
    problems = []
    for sec, folder in (("kinds", "kinds"), ("components", "components"), ("rules", "rules")):
        disk, have = ids_on_disk(folder), set(doc.get(sec, {}))
        for i in sorted(disk - have): problems.append("%s without locale: %s" % (sec[:-1], i))
        for i in sorted(have - disk): problems.append("locale entry without file: %s %s" % (sec[:-1], i))
    if verbose:
        for p in problems: print(" - " + p)
        print("locale: kinds %d components %d rules %d, problems %d" % (len(doc.get("kinds", {})), len(doc.get("components", {})), len(doc.get("rules", {})), len(problems)))
    return problems

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    doc = load()
    if cmd == "add":
        for f in sys.argv[2:]:
            merge(doc, yaml.safe_load(Path(f).read_text(encoding="utf-8")))
        write(doc); print("merged", sys.argv[2:]); check(doc)
    elif cmd == "prune":
        for sec, folder in (("kinds", "kinds"), ("components", "components"), ("rules", "rules")):
            disk = ids_on_disk(folder); doc[sec] = {k: v for k, v in doc.get(sec, {}).items() if k in disk}
        write(doc); check(doc)
    else:
        sys.exit(1 if check(doc) else 0)
