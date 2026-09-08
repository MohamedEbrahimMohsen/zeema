// F1 parser conformance and F2 round trip for editor/core/yaml.js
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { parse, serialize } from "../../editor/core/yaml.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const files = [];
for (const tier of ["reference", "imported"]) {
  const dir = path.join(ROOT, "designs", tier);
  if (!fs.existsSync(dir)) continue;
  for (const d of fs.readdirSync(dir)) for (const f of ["design.yaml", "design.broken.yaml"]) {
    const p = path.join(dir, d, f);
    if (fs.existsSync(p)) files.push(p);
  }
}
let fail = 0;
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  let doc, cst;
  try { ({ doc, cst } = parse(text)); } catch (e) { console.log("PARSE THREW", rel(f), e.message); fail++; continue; }
  const ref = YAML.parse(text);
  if (JSON.stringify(doc) !== JSON.stringify(ref)) {
    fail++; console.log("F1 mismatch", rel(f));
    for (const k of new Set([...Object.keys(ref), ...Object.keys(doc)])) {
      if (JSON.stringify(doc[k]) !== JSON.stringify(ref[k])) {
        const a = JSON.stringify(doc[k]), b = JSON.stringify(ref[k]);
        let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
        console.log("   key", k, "\n     got", a.slice(Math.max(0, i - 60), i + 90), "\n     exp", b.slice(Math.max(0, i - 60), i + 90));
        break;
      }
    }
    continue;
  }
  const out = serialize(cst, doc);
  if (out !== text) {
    fail++; console.log("F2 byte mismatch", rel(f));
    const a = out.split("\n"), b = text.split("\n");
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) {
      console.log("   line", i + 1, "\n     got", JSON.stringify(a[i]), "\n     exp", JSON.stringify(b[i])); break;
    }
    continue;
  }
  const again = parse(out);
  if (JSON.stringify(again.doc) !== JSON.stringify(doc)) { fail++; console.log("F2 reparse mismatch", rel(f)); }
}
console.log(`${files.length} designs, ${fail} failing`);
process.exit(fail ? 1 : 0);
