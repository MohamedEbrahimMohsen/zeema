// Server-side validation through the shared engine. Storage never accepts a design the
// structural check rejects; rule findings are reported, never blocking.
import { normalize } from "@arkore/core/document";
import { runRules } from "@arkore/core/rules";
import { check } from "@arkore/core/structure";
import { parse } from "@arkore/core/yaml";
import type { Catalogue } from "./catalogue";

export type Finding = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  blocking: boolean;
  subject: { type: string; ref: string | number | null };
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

export function analyse(
  yamlText: string,
  cat: Catalogue,
): { doc: Design | null; findings: Finding[] } {
  let doc: Design;
  try {
    doc = normalize(parse(yamlText).doc).doc as Design;
  } catch (e) {
    return {
      doc: null,
      findings: [
        {
          id: "yaml",
          severity: "error",
          message: (e as Error).message,
          blocking: true,
          subject: { type: "design", ref: null },
        },
      ],
    };
  }
  const findings: Finding[] = [];
  for (const f of check(doc, cat) as Array<{ message: string; subject: Finding["subject"] }>) {
    findings.push({
      id: "structure",
      severity: "error",
      message: f.message.replace(/^[^:]+: /, ""),
      blocking: true,
      subject: f.subject,
    });
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
