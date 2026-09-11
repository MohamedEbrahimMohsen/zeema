// arkore init: a starter design, a config file, editor schema mapping and a CI workflow.
import fs from "node:fs";
import path from "node:path";

const STARTER = `# yaml-language-server: $schema=https://arkore.dev/schema/design.schema.json
schemaVersion: "1"
type: "design"
id: "checkout"
requirements:
  messaging: { replay: true }
nodes:
  - { id: "api", component: "aws-api-gateway" }
  - { id: "events", component: "sns" }
edges:
  - { from: "api", to: "events", protocol: "sns", mode: "async", delivery: "at-least-once" }
`;

const CONFIG = `{
  "designs": ["architecture"],
  "failOn": "error",
  "disable": {}
}
`;

const WORKFLOW = `name: arkore
on:
  pull_request:
  push:
    branches: [main]
jobs:
  lint:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx --yes @arkore/cli lint --format sarif --out arkore.sarif || true
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: arkore.sarif
      - run: npx --yes @arkore/cli lint
`;

export function initProject(dir) {
  const written = [];
  const put = (rel, text) => {
    const abs = path.join(dir, rel);
    if (fs.existsSync(abs)) return;
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text, "utf8");
    written.push(rel);
  };
  put("architecture/checkout.arkore.yaml", STARTER);
  put("arkore.config.json", CONFIG);
  put(".github/workflows/arkore.yml", WORKFLOW);
  const vs = path.join(dir, ".vscode", "settings.json");
  let settings = {};
  if (fs.existsSync(vs)) {
    try {
      settings = JSON.parse(fs.readFileSync(vs, "utf8"));
    } catch {
      settings = {};
    }
  }
  settings["yaml.schemas"] = {
    ...(settings["yaml.schemas"] ?? {}),
    "https://arkore.dev/schema/design.schema.json": ["**/*.arkore.yaml", "**/design.yaml"],
  };
  fs.mkdirSync(path.dirname(vs), { recursive: true });
  fs.writeFileSync(vs, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  written.push(".vscode/settings.json");
  return written;
}
