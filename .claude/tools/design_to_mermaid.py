"""Render a Zeema design as a Mermaid flowchart (for the fidelity check and the import folder).

  python design_to_mermaid.py <design.yaml> [-o diagram.md] [--direction TD|LR]

Groups become nested subgraphs, nodes show their label (or id) and component id, sync edges
are solid, async edges dotted. Writes Markdown with a ```mermaid fence, or prints it.
"""
import sys
from pathlib import Path
import yaml

def mid(s): return "n_" + "".join(ch if ch.isalnum() else "_" for ch in s)

def esc(s): return str(s).replace('"', "'").replace("<", "&lt;").replace(">", "&gt;")

def render(doc, direction="TD"):
    groups = doc.get("groups") or []; nodes = doc["nodes"]; edges = doc["edges"]
    children = {}
    for g in groups: children.setdefault(g.get("parent"), []).append(g)
    members = {}
    for n in nodes: members.setdefault(n.get("group"), []).append(n)
    out = ["flowchart " + direction]
    def node_line(n, ind):
        text = esc(n.get("label") or n["id"])
        out.append('%s%s["%s<br/><i>%s</i>"]' % (ind, mid(n["id"]), text, esc(n["component"])))
    def emit_group(g, depth):
        ind = "  " * depth
        out.append('%ssubgraph %s["%s (%s)"]' % (ind, mid("g_" + g["id"]), esc(g.get("label") or g["id"]), esc(g["kind"])))
        for n in members.get(g["id"], []): node_line(n, ind + "  ")
        for c in children.get(g["id"], []): emit_group(c, depth + 1)
        out.append(ind + "end")
    for n in members.get(None, []): node_line(n, "  ")
    for g in children.get(None, []): emit_group(g, 1)
    for e in edges:
        text = e.get("label") or ""
        meta = e["protocol"] + (", " + e["delivery"] if e.get("delivery") else "")
        lab = esc((text + " [" + meta + "]") if text else meta)
        arrow = "-->" if e["mode"] == "sync" else "-.->"
        out.append("  %s %s|\"%s\"| %s" % (mid(e["from"]), arrow, lab, mid(e["to"])))
    return "\n".join(out)

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(2)
    src = Path(a[0]); out = Path(a[a.index("-o") + 1]) if "-o" in a else None
    direction = a[a.index("--direction") + 1] if "--direction" in a else "TD"
    doc = yaml.safe_load(src.read_text(encoding="utf-8"))
    body = render(doc, direction)
    md = "# %s\n\nRendered from `%s` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.\n\n```mermaid\n%s\n```\n" % (doc["id"], src.name, body)
    if out: out.write_text(md, encoding="utf-8", newline="\n"); print("wrote", out)
    else: print(md)
