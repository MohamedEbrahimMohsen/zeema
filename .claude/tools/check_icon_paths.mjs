// Every path in the icon set must tokenise into commands with legal coordinate counts. The
// rounding step that shortens a brand mark can drop the separator between two numbers, which
// turns two coordinates into one and makes the path invalid; a browser then refuses to draw it.
// Arc flags are single characters and may be written with no separator, so arcs are scanned
// argument by argument rather than by counting numbers.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scan } from "./pathcheck.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(path.join(d, e.name))
        : e.name.endsWith(".svg")
          ? [path.join(d, e.name)]
          : [],
    );

let bad = 0,
  checked = 0;
for (const file of walk(path.join(ROOT, "icons"))) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/\sd="([^"]+)"/g)) {
    checked++;
    for (const why of scan(m[1])) {
      bad++;
      console.log("BAD", path.relative(ROOT, file).split(path.sep).join("/"), "|", why);
    }
  }
}
console.log(`${checked} paths checked, ${bad} malformed`);
process.exit(bad ? 1 : 0);
