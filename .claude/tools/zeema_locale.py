"""locales/en.yaml maintenance.

  python zeema_locale.py add <snippet.yaml> [...]   merge entries, rewrite sorted
  python zeema_locale.py add --replace <snippet>    ... and allow ids that already have an entry
  python zeema_locale.py check                      report ids without entry / entries without file
  python zeema_locale.py prune                      drop entries whose id has no file

`add` refuses an id that already has an entry and writes nothing: the file is rewritten whole,
so an overwritten hand-written description would not show up as a line you could read in review.
Pass --replace when overwriting is what you mean.

A snippet is either {kinds: {...}, components: {...}, rules: {...}} or a flat
{<id>: {name, description}} map, which is treated as components.
"""
import glob, os, sys
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]
EN = ROOT / "locales" / "en.yaml"
CATEGORIES = {"messaging": "Messaging", "compute": "Compute", "data": "Data", "edge": "Edge",
              "external": "External", "client": "Client", "ops": "Operations", "security": "Security",
              "custom": "Custom"}

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
            for extra in ("description", "rationale"):
                if v.get(extra): lines.append("    %s: %s" % (extra, q(v[extra])))
        return "\n".join(lines)
    cats = {k: {"name": v} for k, v in CATEGORIES.items()}
    out = ["# English display text, keyed by id. Kinds, components and rules never carry display",
           "# text themselves. Every id in kinds/, components/ and rules/ must have an entry here.",
           "# Regenerated from the catalogue; keep entries sorted by id.",
           block("categories", cats), "", block("kinds", doc.get("kinds", {})), "",
           block("components", doc.get("components", {})), "", block("rules", doc.get("rules", {})), ""]
    EN.write_text("\n".join(out), encoding="utf-8", newline="\n")

def sections(snippet):
    """The snippet as {section: {id: entry}}. A flat map is components."""
    if not snippet: return {}
    if any(k in snippet for k in ("kinds", "components", "rules")):
        return {sec: (snippet.get(sec) or {}) for sec in ("kinds", "components", "rules")}
    return {"components": snippet}

def clashes(doc, snippet):
    """Ids in the snippet that already have an entry, as 'section id' strings."""
    out = []
    for sec, entries in sections(snippet).items():
        for i in sorted(entries):
            if i in doc.get(sec, {}): out.append("%s %s" % (sec[:-1], i))
    return out

def merge(doc, snippet):
    for sec, entries in sections(snippet).items():
        doc.setdefault(sec, {}).update(entries)

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
        args = sys.argv[2:]
        replace = "--replace" in args
        files = [a for a in args if a != "--replace"]
        loaded = [(f, yaml.safe_load(Path(f).read_text(encoding="utf-8"))) for f in files]
        if not replace:
            found = [(f, c) for f, snip in loaded for c in clashes(doc, snip)]
            if found:
                print("refusing to overwrite %d existing locale entr%s:"
                      % (len(found), "y" if len(found) == 1 else "ies"))
                for f, c in found: print("  %s  (from %s)" % (c, f))
                print("nothing written. Edit locales/en.yaml by hand, or pass --replace.")
                sys.exit(1)
        for _, snip in loaded:
            merge(doc, snip)
        write(doc); print("merged", files); check(doc)
    elif cmd == "prune":
        for sec, folder in (("kinds", "kinds"), ("components", "components"), ("rules", "rules")):
            disk = ids_on_disk(folder); doc[sec] = {k: v for k, v in doc.get(sec, {}).items() if k in disk}
        write(doc); check(doc)
    else:
        sys.exit(1 if check(doc) else 0)
