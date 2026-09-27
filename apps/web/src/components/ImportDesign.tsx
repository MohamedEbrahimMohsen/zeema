"use client";

// Import a design that left the site as files. The YAML is required, the layout is optional, and
// either may be chosen, dropped or pasted; the zip the site packs them into fills both. Nothing is
// checked here that the server does not check again: the page posts to the same create path as
// New design, so structural findings block (422, listed with their lines) and rule findings never
// do. The zip is opened here, with the same code that wrote it (lib/zip.ts).
import { parse } from "@zeema/core/yaml";
import { useRouter } from "next/navigation";
import { type DragEvent, useRef, useState } from "react";
import { newDraftSlug } from "@/lib/slug";
import { looksLikeZip, UnsupportedZip, unzipStore } from "@/lib/zip";
import { FindingRow } from "./Findings";

// The request body is capped at 1 MiB (lib/api.ts), so a file larger than that cannot be sent.
// The server's own limits (the design text, the sidecar) are tighter and answer on their own.
const MAX_FILE = 1024 * 1024;

type ServerFinding = {
  id: string;
  severity: string;
  message: string;
  subject?: { type: string; ref: unknown };
  line?: number;
};

const humanise = (id: string) => {
  const words = id.replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
};

/** The title a design would get from its own `id`, or the generic one. */
function defaultTitle(yaml: string) {
  try {
    const id = (parse(yaml).doc as { id?: unknown } | null)?.id;
    if (typeof id === "string" && humanise(id)) return humanise(id).slice(0, 120);
  } catch {}
  return "Imported design";
}

const isYamlName = (n: string) => /\.ya?ml$/i.test(n);
const isLayoutName = (n: string) => /\.json$/i.test(n);
const base = (n: string) => n.slice(n.lastIndexOf("/") + 1);

export function ImportDesign() {
  const router = useRouter();
  const [yaml, setYaml] = useState("");
  const [layout, setLayout] = useState("");
  const [yamlFrom, setYamlFrom] = useState<string | null>(null);
  const [layoutFrom, setLayoutFrom] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<ServerFinding[]>([]);
  const [over, setOver] = useState<"yaml" | "layout" | null>(null);
  const yamlText = useRef<HTMLTextAreaElement>(null);

  const reset = () => {
    setError(null);
    setFindings([]);
  };

  /** A zip fills both boxes; a lone file fills the box it belongs to. */
  const take = async (file: File, target: "yaml" | "layout") => {
    reset();
    if (file.size > MAX_FILE) {
      setError(`${file.name} is larger than 1 MiB, which is more than a design can be.`);
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (looksLikeZip(bytes)) {
      try {
        const entries = unzipStore(bytes);
        const designs = entries.filter((e) => isYamlName(e.name));
        const y =
          designs.find((e) => base(e.name) === "design.yaml") ??
          designs.find((e) => !/\.broken\./.test(e.name)) ??
          designs[0];
        const l =
          entries.find((e) => base(e.name) === "design.layout.json") ??
          entries.find((e) => /\.layout\.json$/i.test(e.name));
        if (!y) {
          setError(`${file.name} holds no .yaml file.`);
          return;
        }
        const dec = new TextDecoder();
        setYaml(dec.decode(y.data));
        setYamlFrom(`${file.name} › ${y.name}`);
        setLayout(l ? dec.decode(l.data) : "");
        setLayoutFrom(l ? `${file.name} › ${l.name}` : null);
      } catch (e) {
        setError(
          e instanceof UnsupportedZip
            ? `${file.name}: ${e.message}. Only the zip this site downloads can be read here.`
            : `${file.name} could not be read.`,
        );
      }
      return;
    }
    const text = new TextDecoder().decode(bytes);
    const as = isYamlName(file.name) ? "yaml" : isLayoutName(file.name) ? "layout" : target;
    if (as === "yaml") {
      setYaml(text);
      setYamlFrom(file.name);
    } else {
      setLayout(text);
      setLayoutFrom(file.name);
    }
  };

  const dropProps = (target: "yaml" | "layout") => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setOver(target);
    },
    onDragLeave: () => setOver((o) => (o === target ? null : o)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setOver(null);
      const files = [...e.dataTransfer.files];
      // Two files dropped together (design.yaml and its layout) each go where they belong.
      for (const f of files.slice(0, 2)) void take(f, target);
    },
  });

  const goToLine = (line: number) => {
    const ta = yamlText.current;
    if (!ta) return;
    const lines = ta.value.split("\n");
    const at = Math.min(Math.max(line, 1), lines.length);
    const start = lines.slice(0, at - 1).reduce((n, l) => n + l.length + 1, 0);
    ta.focus();
    ta.setSelectionRange(start, start + lines[at - 1].length);
    // Bring the line into view: the textarea scrolls to the selection only in some browsers.
    const lh = Number.parseFloat(getComputedStyle(ta).lineHeight) || 20;
    ta.scrollTop = Math.max(0, (at - 3) * lh);
  };

  const submit = async () => {
    reset();
    if (!yaml.trim()) {
      setError("The design YAML is required.");
      return;
    }
    let sidecar: unknown;
    if (layout.trim()) {
      try {
        sidecar = JSON.parse(layout);
      } catch (e) {
        setError(`The layout is not valid JSON: ${(e as Error).message}`);
        return;
      }
      if (!sidecar || typeof sidecar !== "object" || Array.isArray(sidecar)) {
        setError("The layout must be a JSON object, as design.layout.json is.");
        return;
      }
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/designs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || defaultTitle(yaml),
          slug: newDraftSlug(),
          visibility: "private",
          yaml,
          layout: sidecar,
          message: "imported",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? `import failed (${res.status})`);
        setFindings(Array.isArray(body?.error?.findings) ? body.error.findings : []);
        return;
      }
      router.push(`${body.design.address}/canvas`);
    } catch (e) {
      setError(`import failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const yamlLines = yaml ? yaml.split("\n").length : 0;

  return (
    <div className="flex flex-col gap-4 import-page" style={{ maxWidth: 880 }}>
      <div className="flex flex-col gap-1">
        <h1 className="display design-title">Import a design</h1>
        <p className="muted small">
          Bring back a design that left as files: <span className="mono">design.yaml</span>, and
          optionally the <span className="mono">design.layout.json</span> beside it, or the{" "}
          <span className="mono">.zip</span> the design page downloads. It becomes a private draft.
        </p>
      </div>

      <section
        className={`panel card-section flex flex-col gap-2 import-drop${over === "yaml" ? " is-over" : ""}`}
        {...dropProps("yaml")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="card-title">Design YAML</span>
          <span className="tag">required</span>
          {yamlFrom ? <span className="meta mono truncate">{yamlFrom}</span> : null}
          <label className="btn btn-sm ml-auto import-pick">
            Choose file…
            <input
              type="file"
              accept=".yaml,.yml,.zip,application/zip,text/yaml"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void take(f, "yaml");
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <textarea
          ref={yamlText}
          className="input mono import-text"
          spellCheck={false}
          rows={14}
          aria-label="Design YAML"
          placeholder={
            'Paste design.yaml here, or drop the file (or the .zip) on this card.\n\nschemaVersion: "1"\ntype: "design"\nid: "my-design"\nnodes: []\nedges: []'
          }
          value={yaml}
          onChange={(e) => {
            setYaml(e.target.value);
            setYamlFrom(null);
          }}
        />
        <span className="meta">
          {yamlLines ? `${yamlLines} line${yamlLines === 1 ? "" : "s"}` : "Nothing yet."}
        </span>
      </section>

      <section
        className={`panel card-section flex flex-col gap-2 import-drop${over === "layout" ? " is-over" : ""}`}
        {...dropProps("layout")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="card-title">Layout JSON</span>
          <span className="tag">optional</span>
          {layoutFrom ? <span className="meta mono truncate">{layoutFrom}</span> : null}
          <label className="btn btn-sm ml-auto import-pick">
            Choose file…
            <input
              type="file"
              accept=".json,application/json,.zip,application/zip"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void take(f, "layout");
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <textarea
          className="input mono import-text import-text-sm"
          spellCheck={false}
          rows={6}
          aria-label="Layout JSON"
          placeholder="Paste design.layout.json here, or drop it on this card. Without it the design is laid out automatically."
          value={layout}
          onChange={(e) => {
            setLayout(e.target.value);
            setLayoutFrom(null);
          }}
        />
        <span className="meta">
          Positions, bows, ports, group colours, notes and the list badge. Entries naming something
          the YAML does not hold are dropped.
        </span>
      </section>

      <section className="panel card-section flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 import-title">
          <span className="card-title">Title</span>
          <input
            className="input"
            maxLength={120}
            value={title}
            placeholder={yaml ? defaultTitle(yaml) : "Imported design"}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !yaml.trim()}
          onClick={() => void submit()}
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </section>

      {error ? (
        <section className="panel card-section flex flex-col gap-2" role="alert">
          <p className="status status-err">{error}</p>
          {findings.length ? (
            <div className="flex flex-col gap-2">
              {findings.map((f, i) => (
                <div key={i} className="import-finding">
                  <FindingRow
                    f={{ ...f, severity: "error" }}
                    ruleName={f.line ? `line ${f.line}` : f.id === "yaml" ? "yaml" : "structural"}
                  />
                  {f.line ? (
                    <button
                      type="button"
                      className="pill-btn import-goto"
                      onClick={() => goToLine(f.line!)}
                    >
                      Go to line {f.line}
                    </button>
                  ) : null}
                </div>
              ))}
              <p className="meta">
                Fix the text above and import again. Rule findings never block.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
