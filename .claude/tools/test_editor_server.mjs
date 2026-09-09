// The write channel, tested for real: start the server on a free port, then check what it will
// and will not write. This is the piece the whole editor depends on and the one that cannot be
// tested by importing a module, so it gets an integration test.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 8734;
const base = `http://localhost:${PORT}`;
let failed = 0;
const ok = (name, pass, detail = "") => { console.log(`${pass ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`); if (!pass) failed++; };

const server = spawn(process.execPath, [path.join(ROOT, "editor/serve.mjs"), String(PORT)], { stdio: "ignore" });
const stop = () => { try { server.kill(); } catch {} };
process.on("exit", stop);

const wait = async () => {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(base + "/api/designs"); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
};

const scratch = path.join(ROOT, "designs", "authored", "server-test-scratch");
try {
  ok("the server starts", await wait());

  const index = await (await fetch(base + "/api/designs")).json();
  ok("the live index lists every design", index.length >= 26, `${index.length} entries`);
  ok("only the authored tier is marked editable", index.every((e) => e.editable === (e.tier === "authored" && e.path.endsWith("design.yaml"))));
  ok("the repository's own designs are all read only", index.filter((e) => e.tier !== "authored").every((e) => e.editable === false));
  ok("every listed path exists", index.every((e) => fs.existsSync(path.join(ROOT, e.path))));

  const put = (p, body) => fetch(base + "/" + p, { method: "PUT", body });
  const refusals = [
    ["editor/ui/app.js", "outside designs/"],
    ["designs/reference/slack-messaging/design.yaml", "a reference design"],
    ["designs/reference/slack-messaging/design.broken.yaml", "a broken reference variant"],
    ["designs/reference/slack-messaging/design.layout.json", "a reference design's layout"],
    ["designs/imported/chat-system/design.yaml", "an imported design"],
    ["designs/imported/chat-system/notes.md", "a file that is not a design or a sidecar"],
    ["designs/authored/server-test-scratch/notes.md", "a file that is not a design or a sidecar"],
    ["designs/authored/Bad_Id/design.yaml", "an id that is not kebab-case"],
    ["designs/nonsense/x/design.yaml", "an unknown tier"],
  ];
  for (const [p, why] of refusals) {
    const r = await put(p, "x");
    ok(`refuses ${why}`, r.status === 403, `${r.status} ${(await r.text()).slice(0, 48)}`);
  }

  const design = `# yaml-language-server: $schema=../../../schema/design.schema.json\n` +
    `schemaVersion: "1"\ntype: "design"\nid: "server-test-scratch"\nnodes:\n` +
    `  - { id: "a", component: "container-service" }\nedges: []\n`;
  const created = await put("designs/authored/server-test-scratch/design.yaml", design);
  ok("creates an authored design, folder and all", created.status === 200 && fs.existsSync(path.join(scratch, "design.yaml")));
  const sidecar = await put("designs/authored/server-test-scratch/design.layout.json",
    JSON.stringify({ version: 2, nodes: { a: [10, 20] }, edges: { "a>b": 40 } }, null, 2) + "\n");
  ok("writes the layout sidecar", sidecar.status === 200 && fs.existsSync(path.join(scratch, "design.layout.json")));
  ok("the written design is byte identical to what was sent", fs.readFileSync(path.join(scratch, "design.yaml"), "utf8") === design);

  const after = await (await fetch(base + "/api/designs")).json();
  ok("a new design appears in the live index", after.some((e) => e.id === "server-test-scratch" && e.tier === "authored"));

  // A refused write leaves the file exactly as it was: nothing is half applied.
  const untouched = fs.readFileSync(path.join(ROOT, "designs/imported/chat-system/design.yaml"), "utf8");
  await put("designs/imported/chat-system/design.yaml", "wrecked");
  ok("a refused write changes nothing on disk",
    fs.readFileSync(path.join(ROOT, "designs/imported/chat-system/design.yaml"), "utf8") === untouched);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
  stop();
}

console.log(`\n${failed ? failed + " FAILING" : "server checks passed"}`);
process.exit(failed ? 1 : 0);
