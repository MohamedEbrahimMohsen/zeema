"use client";

// The text editor for a design: live findings from the server's lint endpoint (the same answer
// the storage gate gives), save with the last-seen content hash, and a plain conflict path.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Finding } from "@/lib/lint";

type Props = {
  owner: string;
  slug: string;
  initialYaml: string;
  contentHash: string;
  title: string;
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

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="panel flex flex-col">
        <div
          className="flex items-center gap-3 border-b px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="font-medium">{title}</span>
          <span className="muted">
            {state === "dirty"
              ? "unsaved"
              : state === "saving"
                ? "saving…"
                : state === "saved"
                  ? "saved"
                  : state === "conflict"
                    ? "conflict"
                    : state === "error"
                      ? "error"
                      : ""}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={!valid || state === "saving" || (text === initialYaml && state === "clean")}
              title={valid ? "Ctrl+S" : "Fix structural errors before saving"}
            >
              Save
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => router.push(`/d/${owner}/${slug}`)}
            >
              Done
            </button>
          </div>
        </div>
        <textarea
          className="mono min-h-[70vh] w-full resize-y bg-transparent p-3 text-sm leading-5 outline-none"
          spellCheck={false}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setState("dirty");
          }}
        />
        {message ? (
          <div
            className="sev-error border-t px-3 py-2 text-sm"
            style={{ borderColor: "var(--line)" }}
          >
            {message}
          </div>
        ) : null}
      </div>
      <aside className="space-y-4">
        <section className="panel p-4">
          <h2 className="font-medium">Structure</h2>
          {blocking.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ok)" }}>
              Structurally valid. Save is enabled.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {blocking.map((f, i) => (
                <li key={i} className="sev-error">
                  {f.message}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel p-4">
          <h2 className="font-medium">Rules</h2>
          {rules.length === 0 ? (
            <p className="muted text-sm">No rule fires.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {rules.map((f, i) => (
                <li key={i}>
                  <span className={`sev-${f.severity} mono text-xs`}>{f.id}</span>
                  <div>{f.message}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel p-4 text-sm">
          <h2 className="font-medium">Preview</h2>
          <p className="muted">The picture updates after each save.</p>
          <img
            src={`/api/v1/designs/${owner}/${slug}/render?theme=light&v=${hash}`}
            alt=""
            className="mt-2 w-full rounded border"
            style={{ borderColor: "var(--line)" }}
          />
        </section>
      </aside>
    </div>
  );
}
