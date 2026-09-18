"""Render a Zeema design as a standalone SVG, using the real component icons.

  python design_to_svg.py <design.yaml> [-o out.svg] [--direction TB|LR]

Everything in the picture comes from the data: nodes are boxes carrying the icon of their
component (icons/components/<provider>/<id>.svg) and coloured by the category of their kind,
groups are dashed containers around their members, edges are arrows, solid for sync and dashed
for async, labelled where the design gives a label. Layout is layered: rank by longest path
over the edges, then barycentre ordering inside each rank, then group members pulled together.
No layout information is read from the design, because the format holds none.
"""
import glob, os, re, sys
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]
NAME_PX, ID_PX = 7.6, 6.2          # rough advance width per character
BOX_H, PAD_X, GAP_X, GAP_Y = 78, 16, 34, 86
MAX_W = 1180                       # a rank wider than this wraps onto further rows
ICON, LABEL_PX = 24, 12
CATEGORY_HUE = {"messaging": "violet", "compute": "blue", "data": "amber", "edge": "teal",
                "external": "rose", "client": "purple", "ops": "green", "security": "red"}
PALETTE = {  # fill, stroke (light) | fill, stroke (dark)
    "blue": ("#eaf1fd", "#9cc0f0", "#1b2a3f", "#3f6698"), "teal": ("#e6f5f2", "#8fcfc2", "#152e2b", "#3c7d72"),
    "amber": ("#fbf1e0", "#dcb473", "#33280f", "#8a6a2b"), "violet": ("#f0edfc", "#b6a8ee", "#241f3d", "#5b4f9c"),
    "purple": ("#f6ecf9", "#cda3dc", "#2d1c34", "#7a4d8c"), "green": ("#e9f5ea", "#96c99b", "#162b18", "#417a47"),
    "rose": ("#fceceb", "#e5a7a1", "#33191a", "#8f4c48"), "red": ("#fbe9e9", "#e09b98", "#341a1a", "#8d4340"),
    "grey": ("#f0f0ef", "#c2c2bf", "#26262a", "#5a5a60"),
}

def load(p): return yaml.safe_load(Path(p).read_text(encoding="utf-8"))

def catalogue():
    comps = {}
    for f in glob.glob(str(ROOT / "components" / "*" / "*.yaml")):
        d = load(f); comps[d["id"]] = d
    kinds = {os.path.basename(f)[:-5]: load(f) for f in glob.glob(str(ROOT / "kinds" / "*.yaml"))}
    return comps, kinds

def icon_body(provider, cid):
    p = ROOT / "icons" / "components" / provider / (cid + ".svg")
    if not p.exists(): return ""
    s = p.read_text(encoding="utf-8")
    return re.sub(r"^.*?<svg[^>]*>|</svg>\s*$", "", s, flags=re.S)

def esc(s): return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

def rank_nodes(nodes, edges):
    ids = [n["id"] for n in nodes]
    out = {i: [] for i in ids}; indeg = {i: 0 for i in ids}
    seen = set()
    for e in edges:                                   # drop duplicate and reciprocal edges for ranking
        k = (e["from"], e["to"])
        if k in seen or (e["to"], e["from"]) in seen or e["from"] == e["to"]: continue
        seen.add(k); out[e["from"]].append(e["to"]); indeg[e["to"]] += 1
    rank = {i: 0 for i in ids}
    queue = [i for i in ids if indeg[i] == 0] or [ids[0]]
    order, deg = [], dict(indeg)
    while queue:
        n = queue.pop(0); order.append(n)
        for m in out[n]:
            deg[m] -= 1
            if deg[m] == 0: queue.append(m)
    for n in order:
        for m in out[n]: rank[m] = max(rank[m], rank[n] + 1)
    for i in ids:                                     # nodes inside a cycle the sort never reached
        if i not in order: rank[i] = max(rank.values(), default=0)
    return rank

def order_ranks(nodes, edges, rank, groups):
    by_rank = {}
    for n in nodes: by_rank.setdefault(rank[n["id"]], []).append(n["id"])
    nbr = {n["id"]: [] for n in nodes}
    for e in edges:
        nbr[e["from"]].append(e["to"]); nbr[e["to"]].append(e["from"])
    pos = {i: k for r in by_rank for k, i in enumerate(by_rank[r])}
    for _ in range(6):
        for r in sorted(by_rank):
            def bary(i):
                ns = [pos[x] for x in nbr[i] if x in pos and rank[x] != r]
                return sum(ns) / len(ns) if ns else pos[i]
            by_rank[r].sort(key=bary)
            for k, i in enumerate(by_rank[r]): pos[i] = k
    gof = {n["id"]: n.get("group") for n in nodes}
    for r in sorted(by_rank):                          # keep group members side by side
        blocks, seen = [], {}
        for i in by_rank[r]:
            g = gof[i]
            if g is not None and g in seen: blocks[seen[g]].append(i); continue
            if g is not None: seen[g] = len(blocks)
            blocks.append([i])
        by_rank[r] = [i for b in blocks for i in b]
    return by_rank

def render(design, direction="TB"):
    comps, kinds = catalogue()
    nodes, edges, groups = design["nodes"], design["edges"], design.get("groups") or []
    rank = rank_nodes(nodes, edges)
    for g in groups:                                   # a group is drawn as one frame, so its
        members = [n["id"] for n in nodes if n.get("group") == g["id"]]   # members share a rank
        if members:
            r = max(rank[i] for i in members)
            for i in members: rank[i] = r
    by_rank = order_ranks(nodes, edges, rank, groups)
    node = {n["id"]: n for n in nodes}
    text = {n["id"]: (n.get("label") or n["id"]) for n in nodes}
    box = {}
    for n in nodes:
        w = max(len(text[n["id"]]) * NAME_PX, len(n["component"]) * ID_PX) + 2 * PAD_X
        box[n["id"]] = [0, 0, max(126, round(w)), BOX_H]
    gmembers = {g["id"]: [n["id"] for n in nodes if n.get("group") == g["id"]] for g in groups}
    gchild = {g["id"]: [h["id"] for h in groups if h.get("parent") == g["id"]] for g in groups}
    # place: ranks stack along the flow axis, nodes spread across it
    rows = []
    for r in sorted(by_rank):
        chunk, w = [], 0
        for i in by_rank[r]:                           # wrap a rank that would run off the page
            add = box[i][2] + (GAP_X if chunk else 0)
            if chunk and w + add > MAX_W: rows.append(chunk); chunk, w = [], 0; add = box[i][2]
            chunk.append(i); w += add
        if chunk: rows.append(chunk)
    widths = [sum(box[i][2] for i in ids) + GAP_X * (len(ids) - 1) for ids in rows]
    canvas_w = max(widths) + 120
    y = 46
    for ids, width in zip(rows, widths):
        x = (canvas_w - width) / 2
        for i in ids:
            box[i][0], box[i][1] = round(x), y
            x += box[i][2] + GAP_X
        y += BOX_H + GAP_Y
    canvas_h = y - GAP_Y + 46
    # group frames: bounding box of members and of child groups
    frame, done = {}, set()
    def frame_of(gid):
        if gid in done: return frame.get(gid)
        done.add(gid)
        xs = [box[i] for i in gmembers.get(gid, [])]
        rs = [frame_of(c) for c in gchild.get(gid, [])]
        rs = [r for r in rs if r] + [[b[0], b[1], b[2], b[3]] for b in xs]
        if not rs: return None
        x0 = min(r[0] for r in rs) - 16; y0 = min(r[1] for r in rs) - 32
        x1 = max(r[0] + r[2] for r in rs) + 16; y1 = max(r[1] + r[3] for r in rs) + 16
        frame[gid] = [x0, y0, x1 - x0, y1 - y0]
        return frame[gid]
    for g in groups: frame_of(g["id"])
    # edges: centre to centre, clipped at the border, reciprocal pairs offset
    def clip(b, x, y, cx, cy):
        dx, dy = x - cx, y - cy
        if dx == 0 and dy == 0: return cx, cy
        sx = (b[2] / 2) / abs(dx) if dx else 1e9
        sy = (b[3] / 2) / abs(dy) if dy else 1e9
        s = min(sx, sy)
        return cx + dx * s, cy + dy * s
    def hits(x1, y1, x2, y2, r):
        rx0, ry0, rx1, ry1 = r[0] - 6, r[1] - 6, r[0] + r[2] + 6, r[1] + r[3] + 6
        t0, t1 = 0.0, 1.0
        dx, dy = x2 - x1, y2 - y1
        for p, q in ((-dx, x1 - rx0), (dx, rx1 - x1), (-dy, y1 - ry0), (dy, ry1 - y1)):
            if p == 0:
                if q < 0: return False
                continue
            t = q / p
            if p < 0:
                if t > t1: return False
                t0 = max(t0, t)
            else:
                if t < t0: return False
                t1 = min(t1, t)
        return t0 <= t1

    pairs = {}
    for e in edges: pairs.setdefault(frozenset((e["from"], e["to"])), []).append(e)
    lines = []
    for key, group in pairs.items():
        for k, e in enumerate(group):
            a, b = box[e["from"]], box[e["to"]]
            ax, ay = a[0] + a[2] / 2, a[1] + a[3] / 2
            bx, by = b[0] + b[2] / 2, b[1] + b[3] / 2
            off = 0 if len(group) == 1 else (k - (len(group) - 1) / 2) * 16
            dx, dy = bx - ax, by - ay
            ln = (dx * dx + dy * dy) ** 0.5 or 1
            ox, oy = -dy / ln * off, dx / ln * off
            ax, ay, bx, by = ax + ox, ay + oy, bx + ox, by + oy
            x1, y1 = clip(a, bx, by, ax, ay)
            x2, y2 = clip(b, ax, ay, bx, by)
            bend = None
            for other, ob in box.items():
                if other in (e["from"], e["to"]) or not hits(x1, y1, x2, y2, ob): continue
                mx, my = (x1 + x2) / 2, (y1 + y2) / 2
                ocx, ocy = ob[0] + ob[2] / 2, ob[1] + ob[3] / 2
                dx, dy = x2 - x1, y2 - y1
                ln = (dx * dx + dy * dy) ** 0.5 or 1
                px, py = -dy / ln, dx / ln
                side = 1 if (px * (mx - ocx) + py * (my - ocy)) >= 0 else -1
                reach = (ob[2] / 2 + 46) * side
                bend = (mx + px * reach, my + py * reach)
                break
            lines.append((x1, y1, x2, y2, e, bend))
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">'
           % (canvas_w, canvas_h, canvas_w, canvas_h),
           '<title>%s</title>' % esc(design["id"]),
           '<style>:root{--ink:#1b1b19;--muted:#6b6b66;--line:#8a8a85;--frame:#b4b4ae;--bg:#ffffff}'
           '@media (prefers-color-scheme: dark){:root{--ink:#ececea;--muted:#a1a19c;--line:#7e7e88;--frame:#55555c;--bg:#17171a}'
           + "".join(".f-%s{fill:%s;stroke:%s}" % (k, v[2], v[3]) for k, v in PALETTE.items()) + "}"
           + "".join(".f-%s{fill:%s;stroke:%s}" % (k, v[0], v[1]) for k, v in PALETTE.items())
           + '.n{font-size:14px;font-weight:500;fill:var(--ink)}.c{font-size:12px;fill:var(--muted)}'
           '.g{font-size:12px;fill:var(--muted)}.e{font-size:12px;fill:var(--muted);paint-order:stroke;'
           'stroke:var(--bg);stroke-width:3px}.ic{color:var(--ink)}</style>',
           '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">'
           '<path d="M1 1L9 5L1 9" fill="none" stroke="var(--line)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>',
           '<rect width="%d" height="%d" fill="var(--bg)"/>' % (canvas_w, canvas_h)]
    for g in groups:
        f = frame.get(g["id"])
        if not f: continue
        out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="10" fill="none" stroke="var(--frame)" stroke-width="1" stroke-dasharray="5 4"/>' % tuple(f))
        out.append('<text class="g" x="%.1f" y="%.1f">%s</text>' % (f[0] + 12, f[1] + 19, esc(g.get("label") or "%s (%s)" % (g["id"], g["kind"]))))
    for x1, y1, x2, y2, e, bend in lines:
        dash = ' stroke-dasharray="6 4"' if e.get("mode") == "async" else ""
        if bend:
            out.append('<path d="M%.1f %.1f Q%.1f %.1f %.1f %.1f" fill="none" stroke="var(--line)" stroke-width="1.2"%s marker-end="url(#a)"/>' % (x1, y1, bend[0], bend[1], x2, y2, dash))
            lx, ly = (x1 + 2 * bend[0] + x2) / 4, (y1 + 2 * bend[1] + y2) / 4
        else:
            out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="var(--line)" stroke-width="1.2"%s marker-end="url(#a)"/>' % (x1, y1, x2, y2, dash))
            lx, ly = (x1 + x2) / 2, (y1 + y2) / 2
        lab = e.get("label") or e.get("protocol")
        if lab:
            out.append('<text class="e" x="%.1f" y="%.1f" text-anchor="middle">%s</text>' % (lx, ly - 4, esc(lab)))
    for n in nodes:
        b = box[n["id"]]; c = comps.get(n["component"], {})
        hue = CATEGORY_HUE.get(kinds.get(c.get("kind"), {}).get("category"), "grey")
        cx = b[0] + b[2] / 2
        out.append('<rect class="f-%s" x="%d" y="%d" width="%d" height="%d" rx="8" stroke-width="1"/>' % (hue, b[0], b[1], b[2], b[3]))
        body = icon_body(c.get("provider", "default"), n["component"])
        if body: out.append('<g class="ic" transform="translate(%.1f %d)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">%s</g>' % (cx - ICON / 2, b[1] + 11, body))
        out.append('<text class="n" x="%.1f" y="%d" text-anchor="middle">%s</text>' % (cx, b[1] + 52, esc(text[n["id"]])))
        out.append('<text class="c" x="%.1f" y="%d" text-anchor="middle">%s</text>' % (cx, b[1] + 68, esc(n["component"])))
    out.append("</svg>")
    return "\n".join(out) + "\n"

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(2)
    src = Path(a[0])
    out = Path(a[a.index("-o") + 1]) if "-o" in a else src.with_suffix(".svg")
    svg = render(load(src), a[a.index("--direction") + 1] if "--direction" in a else "TB")
    out.write_text(svg, encoding="utf-8", newline="\n")
    print("wrote %s (%d bytes)" % (out, len(svg)))
