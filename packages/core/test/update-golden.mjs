// Regenerate the layout half of golden.json: for every design it lists, parse, normalise, lay
// out, and replace `positions` and `sizes`. `structural` and `rules` are left as they are.
// Run only for an intended layout change, and say why in the commit:
//
//   node packages/core/test/update-golden.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalize } from "../src/document.js";
import { layout } from "../src/layout.js";
import { parse } from "../src/yaml.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");
const file = path.join(here, "golden.json");
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));
const golden = JSON.parse(fs.readFileSync(file, "utf8"));

let changed = 0;
for (const rel of Object.keys(golden)) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) {
    console.warn(`missing, left as is: ${rel}`);
    continue;
  }
  const doc = normalize(parse(fs.readFileSync(src, "utf8")).doc).doc;
  const lay = layout(doc, catalogue);
  const before = JSON.stringify([golden[rel].positions, golden[rel].sizes]);
  golden[rel].positions = lay.positions;
  golden[rel].sizes = lay.sizes;
  if (JSON.stringify([lay.positions, lay.sizes]) !== before) changed++;
}
fs.writeFileSync(file, JSON.stringify(golden, null, 1));
console.log(`${changed} of ${Object.keys(golden).length} designs changed layout`);
