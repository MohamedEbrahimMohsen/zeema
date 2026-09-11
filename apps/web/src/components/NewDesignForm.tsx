"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STARTER = `schemaVersion: "1"
type: "design"
id: "my-system"
requirements:
  messaging: { replay: true }
nodes:
  - { id: "api", component: "aws-api-gateway" }
  - { id: "events", component: "sns" }
edges:
  - { from: "api", to: "events", protocol: "sns", mode: "async", delivery: "at-least-once" }
`;

export function NewDesignForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [yaml, setYaml] = useState(STARTER);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/designs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, summary, visibility, yaml }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const f = body?.error?.findings as Array<{ message: string }> | undefined;
      setError(
        f?.length
          ? f.map((x) => x.message).join("; ")
          : (body?.error?.message ?? `failed (${res.status})`),
      );
      return;
    }
    router.push(`${body.design.address}/edit`);
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="panel p-5 flex flex-col gap-4">
        <div className="field">
          <label htmlFor="nd-title">title</label>
          <input
            id="nd-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            placeholder="Order processing"
          />
          <span className="hint">string · required</span>
        </div>
        <div className="field">
          <label htmlFor="nd-summary">summary</label>
          <input
            id="nd-summary"
            className="input"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={280}
            placeholder="One sentence for the browse card."
          />
          <span className="hint">string · one sentence, full stop</span>
        </div>
        <div className="field">
          <label htmlFor="nd-yaml">design</label>
          <textarea
            id="nd-yaml"
            className="input mono min-h-[40vh]"
            spellCheck={false}
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
          />
          <span className="hint">yaml · every node names a catalogue component</span>
        </div>
      </div>
      <aside className="flex flex-col gap-4">
        <div className="panel p-4 flex flex-col gap-2">
          <span className="label">Visibility</span>
          <label className="choice">
            <input
              type="radio"
              name="vis"
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
            />
            Private
            <span className="muted">only you</span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="vis"
              checked={visibility === "public"}
              onChange={() => setVisibility("public")}
            />
            Public
            <span className="muted">anyone can read, clone, export</span>
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !title}>
          {busy ? "creating…" : "Create and open the editor"}
        </button>
        {error ? <p className="status status-err">{error}</p> : null}
        <p className="meta">
          A design must be structurally valid to be created: every component must exist in the
          catalogue and every edge must join two nodes.
        </p>
      </aside>
    </form>
  );
}
