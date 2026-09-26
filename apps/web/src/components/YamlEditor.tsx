"use client";

// The text editor for a design: live findings from the server's lint endpoint (the same answer
// the storage gate gives), save with the last-seen content hash, and a plain conflict path.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveFile } from "@/canvas/exportScene";
import { CopyButton } from "@/components/CopyButton";
import { Download } from "@/components/Glyphs";
import type { Finding } from "@/lib/lint";
import { FindingRow } from "./Findings";

type Props = {
  owner: string;
  slug: string;
  initialYaml: string;
  contentHash: string;
  title: string;
};

const STATUS: Record<string, [string, string]> = {
  clean: ["", ""],
  dirty: ["unsaved", "status-warn"],
  saving: ["saving…", ""],
  saved: ["saved", "status-ok"],
  conflict: ["conflict", "status-err"],
  error: ["error", "status-err"],
};

export function YamlEditor({ owner, slug, initialYaml, contentHash, title }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialYaml);
  const [hash, setHash] = useState(contentHash);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [valid, setValid] = useState(true);
  const [state, setState] = useState<"clean" | "dirty" | "saving" | "saved" | "conflict" | "error">(
    "clean",
  );
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const mine = ++seq.current;
    timer.current = setTimeout(async () => {
      const res = await fetch("/api/v1/lint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ yaml: text }),
      });
      if (mine !== seq.current) return;
      if (res.ok) {
        const body = await res.json();
        setFindings(body.findings);
        setValid(body.valid);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text]);

  const save = async () => {
    if (!valid) return;
    setState("saving");
    setMessage(null);
    const res = await fetch(`/api/v1/designs/${owner}/${slug}/version`, {
      method: "PUT",
      headers: { "content-type": "application/json", "if-match": `"${hash}"` },
      body: JSON.stringify({ yaml: text }),
    });
    if (res.status === 409) {
      setState("conflict");
      setMessage(
        "This design changed since you opened it. Reload to see the latest version, or copy your text and clone.",
      );
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setState("error");
      setMessage(body?.error?.message ?? `save failed (${res.status})`);
      return;
    }
    const body = await res.json();
    setHash(body.version.contentHash);
    setState("saved");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const blocking = findings.filter((f) => f.blocking);
  const rules = findings.filter((f) => !f.blocking);
  const [word, tone] = STATUS[state];

  const lines = text.split("\n").length;

  return (
    <div className="grid gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-3 min-w-0">
        <div className="editor-top">
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="meta mono design-crumb truncate">
              {owner}/{slug}
            </span>
            <span className="editor-title truncate">{title}</span>
          </div>
          <div className="pill editor-actions">
            {word ? <span className={`status ${tone} editor-status`}>{word}</span> : null}
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={save}
              disabled={!valid || state === "saving" || (text === initialYaml && state === "clean")}
              title={valid ? "Ctrl S" : "Fix structural errors before saving"}
            >
              Save <kbd>⌃S</kbd>
            </button>
            <button
              type="button"
              className="pill-btn"
              onClick={() => router.push(`/d/${owner}/${slug}`)}
            >
              Done
            </button>
          </div>
        </div>
        <div className="panel editor-card">
          <div className="editor-head">
            <span className="editor-file mono">{slug}.yaml</span>
            <span className="editor-lines mono">
              {lines} line{lines === 1 ? "" : "s"}
            </span>
            <span className="ml-auto flex items-center gap-0.5">
              <CopyButton text={text} className="btn-icon" />
              <button
                type="button"
                className="btn-icon"
                aria-label={`Download ${slug}.yaml`}
                title="Download"
                onClick={() => saveFile(`${slug}.yaml`, text, "application/yaml")}
              >
                <Download />
              </button>
            </span>
          </div>
          <textarea
            className="editor-text mono"
            spellCheck={false}
            aria-label={`${slug}.yaml`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setState("dirty");
            }}
          />
          {message ? <div className="editor-message status status-err">{message}</div> : null}
        </div>
      </div>
      <aside className="flex flex-col gap-4">
        <section className="panel card-section flex flex-col gap-2">
          <span className="card-title">Structure</span>
          {blocking.length === 0 ? (
            <p className="status status-ok">Structurally valid. Save is enabled.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {blocking.map((f, i) => (
                <FindingRow key={i} f={{ ...f, severity: "error" }} ruleName="structural" />
              ))}
            </div>
          )}
        </section>
        <section className="panel card-section flex flex-col gap-2">
          <span className="card-title">Rules</span>
          {rules.length === 0 ? (
            <p className="small muted">No rule fires.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {rules.map((f, i) => (
                <FindingRow key={i} f={f} />
              ))}
            </div>
          )}
        </section>
        <section className="panel preview-card editor-preview">
          <div className="preview-label label">Preview</div>
          <div className="preview-surface">
            <img
              src={`/api/v1/designs/${owner}/${slug}/render?theme=light&v=${hash}`}
              alt=""
              className="w-full"
            />
          </div>
          <p className="meta editor-preview-note">The picture updates after each save.</p>
        </section>
      </aside>
    </div>
  );
}
