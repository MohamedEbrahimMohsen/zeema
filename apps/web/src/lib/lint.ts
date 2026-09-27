// Server-side validation through the shared engine. Storage never accepts a design the
// structural check rejects; rule findings are reported, never blocking.
import { normalize } from "@zeema/core/document";
import { runRules } from "@zeema/core/rules";
import { check } from "@zeema/core/structure";
import { lineAt, parse } from "@zeema/core/yaml";
import type { Catalogue } from "./catalogue";

export type Finding = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  blocking: boolean;
  subject: { type: string; ref: string | number | null };
  /** The 1-based line in the text the finding is about, when one can be named. */
  line?: number;
};

export type Design = {
  schemaVersion: string;
  type: string;
  id: string;
  requirements?: Record<string, Record<string, unknown>>;
  groups?: Array<{ id: string; kind: string; label?: string; parent?: string }>;
  nodes: Array<{
    id: string;
    component: string;
    label?: string;
    group?: string;
    props?: Record<string, unknown>;
    nfr?: Record<string, unknown>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    protocol: string;
    mode: "sync" | "async";
    delivery?: string;
    label?: string;
    [k: string]: unknown;
  }>;
};

/**
 * Where in the text a finding points: the schema check's JSON pointer when it has one, otherwise
 * the item its subject names (found by id in the document as written, which keeps its order).
 */
function pathOf(raw: unknown, subject: Finding["subject"], pointer?: string): (string | number)[] {
  if (pointer)
    return pointer
      .split("/")
      .slice(1)
      .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
      .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const indexOf = (key: string, id: unknown) =>
    Array.isArray(r[key])
      ? (r[key] as unknown[]).findIndex(
          (x) => x && typeof x === "object" && (x as { id?: unknown }).id === id,
        )
      : -1;
  if (subject.type === "edge" && typeof subject.ref === "number") return ["edges", subject.ref];
  for (const [type, key] of [
    ["node", "nodes"],
    ["group", "groups"],
  ] as const) {
    if (subject.type !== type || subject.ref === null) continue;
    const i = indexOf(key, subject.ref);
    return i >= 0 ? [key, i] : [key];
  }
  return [];
}

export function analyse(
  yamlText: string,
  cat: Catalogue,
): { doc: Design | null; findings: Finding[] } {
  let doc: Design;
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(yamlText);
    doc = normalize(parsed.doc).doc as Design;
  } catch (e) {
    const message = (e as Error).message;
    const at = /at line (\d+)$/.exec(message);
    const finding: Finding = {
      id: "yaml",
      severity: "error",
      message,
      blocking: true,
      subject: { type: "design", ref: null },
    };
    if (at) finding.line = Number(at[1]);
    return { doc: null, findings: [finding] };
  }
  const findings: Finding[] = [];
  for (const f of check(doc, cat) as Array<{
    message: string;
    subject: Finding["subject"];
    pointer?: string;
  }>) {
    const finding: Finding = {
      id: "structure",
      severity: "error",
      message: f.message.replace(/^[^:]+: /, ""),
      blocking: true,
      subject: f.subject,
    };
    const line = lineAt(parsed.cst, pathOf(parsed.doc, f.subject, f.pointer));
    if (line) finding.line = line;
    findings.push(finding);
  }
  if (!findings.length) {
    for (const h of runRules(doc, cat) as Array<{
      id: string;
      severity: Finding["severity"];
      message: string;
      subject: Finding["subject"];
      error?: boolean;
    }>) {
      findings.push({
        id: h.id,
        severity: h.error ? "error" : h.severity,
        message: h.message,
        blocking: Boolean(h.error),
        subject: h.subject,
      });
    }
  }
  return { doc, findings };
}

export const isStructurallyValid = (yamlText: string, cat: Catalogue) =>
  !analyse(yamlText, cat).findings.some((f) => f.blocking);
