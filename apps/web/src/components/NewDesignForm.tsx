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
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="panel p-4">
        <label className="block text-sm">
          <span className="muted">Title</span>
          <input
            className="input mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            placeholder="Order processing"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="muted">Summary</span>
          <input
            className="input mt-1"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={280}
            placeholder="One line for the browse card"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="muted">Design YAML</span>
          <textarea
            className="input mono mt-1 min-h-[40vh]"
            spellCheck={false}
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
          />
        </label>
      </div>
      <aside className="space-y-3">
        <div className="panel p-4 text-sm">
          <div className="font-medium">Visibility</div>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="radio"
              name="vis"
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
            />{" "}
            Private (only you)
          </label>
          <label className="mt-1 flex items-center gap-2">
            <input
              type="radio"
              name="vis"
              checked={visibility === "public"}
              onChange={() => setVisibility("public")}
            />{" "}
            Public (anyone can read, clone, export)
          </label>
        </div>
        <button
          type="submit"
          className="btn btn-primary w-full justify-center"
          disabled={busy || !title}
        >
          {busy ? "Creating…" : "Create and open the editor"}
        </button>
        {error ? <p className="sev-error text-sm">{error}</p> : null}
        <p className="muted text-xs">
          A design must be structurally valid to be created: every component must exist in the
          catalogue and every edge must join two nodes.
        </p>
      </aside>
    </form>
  );
}
