"""Fidelity check for an imported design: designs/imported/<name>/.

  python check_fidelity.py designs/imported/<name>

Reads <name>/design.yaml (the Arkore design) and <name>/mapping.yaml (what the source shows and
where each item went) and fails unless the two describe the same picture:

  - source counts (nodes, edges, groups) equal the mapping lists and the design lists
  - every mapped node / group / edge exists in the design, and every design node / group / edge is mapped
  - every design node carries `label` equal to the source name in the mapping
  - every component id exists in components/
  - `unmapped` is empty
  - a node mapped with confidence "assumed" is reported as a warning (never a silent guess)

mapping.yaml shape:
  source: { file: "source/<original file>", format: "image|drawio|mermaid|plantuml|excalidraw|markdown|terraform|bicep|arm|cloudformation|pulumi|other",
            counts: { nodes: N, edges: N, groups: N } }
  nodes:  [ { source: "Box text as drawn", node: "node-id", component: "component-id", confidence: "exact|close|assumed", note: "" } ]
  groups: [ { source: "Boundary text as drawn", group: "group-id", kind: "region|...", note: "" } ]
  edges:  [ { source: "A -> B (as drawn)", from: "node-id", to: "node-id", note: "" } ]
  ignored: [ { source: "Legend", reason: "not a system element" } ]   # not counted, not checked
  unmapped: []
  gaps: [ "free text, one per thing the format could not express" ]
"""
import glob, os, sys
from collections import Counter
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]

def main(folder):
    folder = Path(folder).resolve(); name = folder.name
    design_path, mapping_path = folder / "design.yaml", folder / "mapping.yaml"
    problems, warnings = [], []
    for p in (design_path, mapping_path):
        if not p.exists(): print("missing", p); return 1
    design = yaml.safe_load(design_path.read_text(encoding="utf-8"))
    mapping = yaml.safe_load(mapping_path.read_text(encoding="utf-8")) or {}
    comps = {os.path.basename(f)[:-5] for f in glob.glob(str(ROOT / "components" / "*" / "*.yaml"))}
    if design.get("id") != name: problems.append("design id %r != folder name %r" % (design.get("id"), name))
    src = mapping.get("source") or {}
    if not (folder / str(src.get("file", ""))).exists(): problems.append("source file not found: %s" % src.get("file"))
    counts = src.get("counts") or {}
    m_nodes, m_groups, m_edges = mapping.get("nodes") or [], mapping.get("groups") or [], mapping.get("edges") or []
    d_nodes, d_groups, d_edges = design.get("nodes") or [], design.get("groups") or [], design.get("edges") or []
    for what, c, m, d in (("nodes", counts.get("nodes"), m_nodes, d_nodes), ("groups", counts.get("groups"), m_groups, d_groups), ("edges", counts.get("edges"), m_edges, d_edges)):
        if c is None: problems.append("source.counts.%s missing (count the source by hand)" % what)
        elif not (c == len(m) == len(d)): problems.append("%s: source says %s, mapping has %d, design has %d" % (what, c, len(m), len(d)))
    d_node_ids = {n["id"]: n for n in d_nodes}; m_node_ids = {}
    for m in m_nodes:
        nid = m.get("node")
        if nid in m_node_ids: problems.append("node %s mapped twice" % nid)
        m_node_ids[nid] = m
        if nid not in d_node_ids: problems.append("mapped node %s not in design" % nid); continue
        n = d_node_ids[nid]
        if n.get("component") != m.get("component"): problems.append("node %s: mapping says component %s, design says %s" % (nid, m.get("component"), n.get("component")))
        if m.get("component") not in comps: problems.append("node %s: component %s does not exist" % (nid, m.get("component")))
        if not n.get("label"): problems.append("node %s has no label (source name must be kept)" % nid)
        elif n["label"] != m.get("source"): problems.append("node %s: label %r != source %r" % (nid, n["label"], m.get("source")))
        if m.get("confidence") == "assumed": warnings.append("node %s (%r) is an assumed mapping: %s" % (nid, m.get("source"), m.get("note") or "no note"))
        elif m.get("confidence") not in ("exact", "close"): problems.append("node %s: confidence must be exact|close|assumed" % nid)
    for nid in d_node_ids:
        if nid not in m_node_ids: problems.append("design node %s is not in the mapping (invented node?)" % nid)
    d_group_ids = {g["id"]: g for g in d_groups}; m_group_ids = set()
    for m in m_groups:
        gid = m.get("group"); m_group_ids.add(gid)
        if gid not in d_group_ids: problems.append("mapped group %s not in design" % gid); continue
        g = d_group_ids[gid]
        if g.get("kind") != m.get("kind"): problems.append("group %s: mapping kind %s != design kind %s" % (gid, m.get("kind"), g.get("kind")))
        if g.get("label") and g["label"] != m.get("source"): problems.append("group %s: label %r != source %r" % (gid, g["label"], m.get("source")))
    for gid in d_group_ids:
        if gid not in m_group_ids: problems.append("design group %s is not in the mapping" % gid)
    m_pairs = Counter((e.get("from"), e.get("to")) for e in m_edges); d_pairs = Counter((e.get("from"), e.get("to")) for e in d_edges)
    for pair, k in (m_pairs - d_pairs).items(): problems.append("mapped edge %s -> %s missing in design (x%d)" % (pair[0], pair[1], k))
    for pair, k in (d_pairs - m_pairs).items(): problems.append("design edge %s -> %s is not in the mapping (invented edge?) (x%d)" % (pair[0], pair[1], k))
    if mapping.get("unmapped"): problems.append("unmapped items remain: %s" % mapping["unmapped"])
    for w in warnings: print("WARN " + w)
    for p in problems: print("FAIL " + p)
    print("fidelity %s: nodes %d groups %d edges %d, gaps %d, warnings %d, problems %d" % ("OK" if not problems else "FAILED", len(d_nodes), len(d_groups), len(d_edges), len(mapping.get("gaps") or []), len(warnings), len(problems)))
    return 1 if problems else 0

if __name__ == "__main__":
    if len(sys.argv) < 2: print(__doc__); sys.exit(2)
    sys.exit(main(sys.argv[1]))
