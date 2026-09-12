"""Install kind proposals.

  python install_kinds.py <proposals.yaml> [...]

Each proposal file maps kind id -> {category, name, description, comment, glyph, properties}.
For every kind that does not exist yet this writes kinds/<id>.yaml (adds `managed`
boolean false), the locale entry, the glyph into kindglyphs-extra.mjs and the row in
docs/catalogue-v1.md. Existing kinds are skipped. Run icons.mjs afterwards.
"""
import json, re, sys
from pathlib import Path
import yaml
import arkore_locale

ROOT = Path(__file__).resolve().parents[2]
TOOLS = Path(__file__).resolve().parent
GLYPHS = TOOLS / "kindglyphs-extra.mjs"
CAT = ROOT / "docs" / "catalogue-v1.md"
CATEGORIES = set(arkore_locale.CATEGORIES)

def q(s): return '"' + str(s).replace('"', "'") + '"'
def val(v):
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, int): return str(v)
    return q(v)

def install(files):
    glyphs = GLYPHS.read_text(encoding="utf-8"); cat = CAT.read_text(encoding="utf-8")
    locale = arkore_locale.load(); installed, skipped = [], []
    for f in files:
        for kid, spec in (yaml.safe_load(Path(f).read_text(encoding="utf-8")) or {}).items():
            kp = ROOT / "kinds" / (kid + ".yaml")
            if kp.exists(): skipped.append(kid); continue
            assert re.fullmatch(r"[a-z][a-z0-9-]*", kid), "bad kind id " + kid
            assert spec["category"] in CATEGORIES, "bad category for " + kid
            for key in ("name", "description", "comment", "glyph"): assert spec.get(key), "%s missing %s" % (kid, key)
            props = dict(spec.get("properties") or {})
            assert 3 <= len(props) <= 9, "%s: 3-8 properties expected" % kid
            if "managed" not in props: props["managed"] = {"type": "boolean", "default": False}
            lines = ["# yaml-language-server: $schema=../schema/kind.schema.json"]
            for c in str(spec["comment"]).strip().splitlines(): lines.append("# " + c)
            lines += ['schemaVersion: "1"', 'type: "kind"', "id: %s" % q(kid), "category: %s" % q(spec["category"]), "properties:"]
            for p, d in props.items():
                assert re.fullmatch(r"[a-z][a-zA-Z0-9]*", p), "bad property name " + p
                assert d["type"] in ("boolean", "integer", "string", "enum", "ref"), "%s.%s: bad type" % (kid, p)
                lines.append("  %s:" % p); lines.append("    type: %s" % q(d["type"]))
                if d.get("values"): lines.append("    values: [%s]" % ", ".join(q(v) for v in d["values"]))
                if "default" in d: lines.append("    default: %s" % val(d["default"]))
                if d.get("required"): lines.append("    required: true")
                if d.get("refKind"): lines.append("    refKind: %s" % q(d["refKind"]))
            kp.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
            locale.setdefault("kinds", {})[kid] = {"name": spec["name"], "description": spec["description"]}
            if json.dumps(kid) + ":" not in glyphs:
                g = str(spec["glyph"]).strip().replace("`", "")
                assert "stroke=" not in g and "fill=" not in g, "%s: glyph must not set stroke/fill" % kid
                glyphs = glyphs.replace("\n};", "\n%s:\n  `%s`,\n};" % (json.dumps(kid), g), 1)
            row = "| %s | %s | %s |\n" % (kid, spec["category"], ", ".join(props.keys()))
            if row not in cat:
                m = re.search(r"(## Kinds\n\n\| kind.*?\n(?:\|.*\n)+)", cat, re.S)
                cat = cat[:m.end()] + row + cat[m.end():]
            installed.append(kid)
    GLYPHS.write_text(glyphs, encoding="utf-8", newline="\n"); CAT.write_text(cat, encoding="utf-8", newline="\n")
    arkore_locale.write(locale)
    return installed, skipped

if __name__ == "__main__":
    if len(sys.argv) < 2: print(__doc__); sys.exit(2)
    i, s = install(sys.argv[1:]); print("installed:", i); print("skipped (exist):", s)
