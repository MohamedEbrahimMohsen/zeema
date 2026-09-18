// Lint one or more design files: structure (blocking) then rules, through the shared engine.
// Output formats: human, json, sarif. Exit code policy lives in index.js.
import fs from "node:fs";
import path from "node:path";
import { normalize } from "@zeema/core/document";
import { runRules } from "@zeema/core/rules";
import { check } from "@zeema/core/structure";
import { parse } from "@zeema/core/yaml";

export const SEVERITY_RANK = { info: 1, warning: 2, error: 3 };

/** Expand files and directories into design files, sorted. */
export function collectDesigns(paths, cwd = process.cwd()) {
  const out = [];
  const visit = (p) => {
    const abs = path.resolve(cwd, p);
    if (!fs.existsSync(abs)) throw new Error(`no such file or directory: ${p}`);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      for (const d of fs
        .readdirSync(abs, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))) {
        const child = path.join(abs, d.name);
        if (d.isDirectory()) {
          if (d.name === "node_modules" || d.name.startsWith(".")) continue;
          visit(child);
        } else if (/^design(\.broken)?\.yaml$/.test(d.name) || /\.zeema\.yaml$/.test(d.name))
          out.push(child);
      }
    } else out.push(abs);
  };
  for (const p of paths) visit(p);
  return [...new Set(out)].sort();
}

// Best-effort line of a finding's subject inside the file, for editors and SARIF.
function lineOf(text, subject) {
  if (!subject || subject.ref === null || subject.ref === undefined) return 1;
  const lines = text.split(/\r?\n/);
  if (subject.type === "node" || subject.type === "group") {
    const re = new RegExp(
      `id:\\s*["']?${String(subject.ref).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?(\\s|,|\\}|$)`,
    );
    const i = lines.findIndex((l) => re.test(l));
    return i >= 0 ? i + 1 : 1;
  }
  if (subject.type === "edge") {
    let n = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*-\s.*\bfrom:/.test(lines[i]) || /^\s*-\s*$/.test(lines[i])) n++;
      if (n === subject.ref) return i + 1;
    }
  }
  return 1;
}

/**
 * Lint a set of files. Returns { files: [{ file, findings }], counts }.
 * A finding: { file, line, id, severity, message, blocking, subject }.
 */
export function lintFiles(files, catalogue, options = {}) {
  const disabled = options.disable ?? {};
  const results = [];
  for (const abs of files) {
    const file =
      path
        .relative(options.cwd ?? process.cwd(), abs)
        .split(path.sep)
        .join("/") || abs;
    const text = fs.readFileSync(abs, "utf8");
    const findings = [];
    let doc;
    try {
      doc = normalize(parse(text).doc).doc;
    } catch (e) {
      const m = /line (\d+)/.exec(e.message);
      findings.push({
        file,
        line: m ? Number(m[1]) : 1,
        id: "yaml",
        severity: "error",
        message: e.message,
        blocking: true,
        subject: { type: "design", ref: null },
      });
      results.push({ file, findings });
      continue;
    }
    for (const f of check(doc, catalogue, { file })) {
      findings.push({
        file,
        line: lineOf(text, f.subject),
        id: "structure",
        severity: "error",
        message: f.message.startsWith(`${file}: `) ? f.message.slice(file.length + 2) : f.message,
        blocking: true,
        subject: f.subject,
      });
    }
    if (!findings.some((f) => f.blocking)) {
      for (const h of runRules(doc, catalogue)) {
        if (disabled[h.id] && !h.error) continue;
        findings.push({
          file,
          line: lineOf(text, h.subject),
          id: h.id,
          severity: h.error ? "error" : h.severity,
          message: h.message,
          blocking: Boolean(h.error),
          subject: h.subject,
        });
      }
    }
    results.push({ file, findings });
  }
  const counts = { files: results.length, error: 0, warning: 0, info: 0, blocking: 0 };
  for (const r of results)
    for (const f of r.findings) {
      counts[f.severity] = (counts[f.severity] ?? 0) + 1;
      if (f.blocking) counts.blocking++;
    }
  return { files: results, counts };
}

/** True when the run should fail: any blocking finding, or any finding at or above failOn. */
export function shouldFail(result, failOn = "error") {
  if (result.counts.blocking > 0) return true;
  if (failOn === "never") return false;
  const min = SEVERITY_RANK[failOn] ?? SEVERITY_RANK.error;
  return result.files.some((r) => r.findings.some((f) => (SEVERITY_RANK[f.severity] ?? 0) >= min));
}

export function formatHuman(result) {
  const out = [];
  for (const r of result.files) {
    if (!r.findings.length) {
      out.push(`ok    ${r.file}`);
      continue;
    }
    out.push(r.file);
    for (const f of r.findings) {
      const sev = f.severity === "warning" ? "warn " : f.severity === "info" ? "info " : "error";
      out.push(`  ${sev}  ${f.id.padEnd(40)}  ${f.message}  (line ${f.line})`);
    }
  }
  const c = result.counts;
  out.push(
    `${c.files} file${c.files === 1 ? "" : "s"}: ${c.error} error${c.error === 1 ? "" : "s"}, ${c.warning} warning${c.warning === 1 ? "" : "s"}, ${c.info} info`,
  );
  return `${out.join("\n")}\n`;
}

export function formatJson(result) {
  return `${JSON.stringify({ version: 1, files: result.files, counts: result.counts }, null, 2)}\n`;
}

export function formatSarif(result, catalogue, version) {
  const level = (s) => (s === "error" ? "error" : s === "warning" ? "warning" : "note");
  const ruleIds = new Set();
  const results = [];
  for (const r of result.files)
    for (const f of r.findings) {
      ruleIds.add(f.id);
      results.push({
        ruleId: f.id,
        level: level(f.severity),
        message: { text: f.message },
        locations: [
          {
            physicalLocation: { artifactLocation: { uri: r.file }, region: { startLine: f.line } },
          },
        ],
      });
    }
  const rules = [...ruleIds].sort().map((id) => {
    const text = catalogue?.locale?.rules?.[id];
    return {
      id,
      shortDescription: { text: text?.name ?? id },
      fullDescription: { text: text?.description ?? "" },
    };
  });
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: { name: "zeema", version, informationUri: "https://github.com/zeema", rules },
        },
        results,
      },
    ],
  };
  return `${JSON.stringify(sarif, null, 2)}\n`;
}
