// A design as files: `design.yaml` and `design.layout.json`, the names a repository design folder
// uses (docs/final-plan.md §D2), so an unzipped download is a folder the CLI reads as it is.
// The YAML leaves byte for byte as stored; the layout leaves through `sidecarFile`, cut down to
// the ids the YAML holds. Pure: no database, no request.
import { normalize } from "@zeema/core/document";
import { edgeKeys } from "@zeema/core/geometry";
import { parse } from "@zeema/core/yaml";
import {
  type LayoutSidecar,
  moduleRefs,
  pruneSidecar,
  readSidecar,
  type SidecarTargets,
  sidecarFile,
} from "./layout-sidecar";
import { zipStore } from "./zip";

export const DESIGN_FILE = "design.yaml";
export const LAYOUT_FILE = "design.layout.json";

type Doc = { nodes?: unknown[]; groups?: unknown[]; edges?: unknown[] };
const idsOf = (list: unknown[] | undefined) =>
  (list ?? []).flatMap((x) =>
    x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string"
      ? [(x as { id: string }).id]
      : [],
  );

/** The ids a sidecar may key on, from a parsed (normalised) design. */
export function targetsOfDoc(doc: Doc): SidecarTargets {
  return {
    nodes: idsOf(doc.nodes),
    groups: idsOf(doc.groups),
    edges: edgeKeys(doc) as string[],
    modules: moduleRefs(doc.nodes),
  };
}

/** The same from a design text, or null when the text does not parse. */
export function targetsOfYaml(yaml: string): SidecarTargets | null {
  try {
    return targetsOfDoc(normalize(parse(yaml).doc).doc as Doc);
  } catch {
    return null;
  }
}

/** A stored sidecar (or none) as it is written beside `yaml`: `design.layout.json`'s bytes. */
export function layoutFile(yaml: string, layout: unknown): string {
  const s: LayoutSidecar = readSidecar(layout);
  const targets = targetsOfYaml(yaml);
  return sidecarFile(targets ? pruneSidecar(s, targets) : s);
}

/** Both files in one stored zip, stamped with the version's time so the bytes are stable. */
export function designZip(yaml: string, layout: unknown, at: Date = new Date(0)): Uint8Array {
  return zipStore(
    [
      { name: DESIGN_FILE, data: yaml },
      { name: LAYOUT_FILE, data: layoutFile(yaml, layout) },
    ],
    at,
  );
}
