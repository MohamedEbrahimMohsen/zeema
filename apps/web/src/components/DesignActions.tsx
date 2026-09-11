"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  owner: string;
  slug: string;
  canWrite: boolean;
  canClone: boolean;
  signedIn: boolean;
  visibility: "public" | "private";
  isCurated: boolean;
};

export function DesignActions({
  owner,
  slug,
  canWrite,
  canClone,
  signedIn,
  visibility,
  isCurated,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/v1/designs/${owner}/${slug}`;

  const call = async (label: string, fn: () => Promise<Response>) => {
    setBusy(label);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `${res.status}`);
      }
      return res;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const clone = async () => {
    const res = await call("clone", () => fetch(`${base}/clone`, { method: "POST" }));
    if (res) {
      const body = await res.json();
      router.push(body.design.address);
    }
  };
  const toggleVisibility = async () => {
    const next = visibility === "public" ? "private" : "public";
    if (
      next === "public" &&
      !confirm("Make this design public? Anyone will be able to read, clone and export it.")
    )
      return;
    const res = await call("visibility", () =>
      fetch(base, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      }),
    );
    if (res) router.refresh();
  };
  const remove = async () => {
    if (!confirm("Delete this design? It disappears from every listing immediately.")) return;
    const res = await call("delete", () => fetch(base, { method: "DELETE" }));
    if (res) router.push("/browse?owner=me");
  };
  const exportSvg = async () => {
    fetch(`${base}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "export", format: "svg" }),
    }).catch(() => {});
    window.open(`${base}/render?download=1`, "_blank");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        className={`btn btn-sm ${canWrite ? "btn-primary" : ""} no-underline`}
        href={`/d/${owner}/${slug}/canvas`}
      >
        {canWrite ? "Open in canvas" : "View in canvas"}
      </a>
      {canWrite ? (
        <a className="btn btn-sm no-underline" href={`/d/${owner}/${slug}/edit`}>
          Edit YAML
        </a>
      ) : null}
      {canClone ? (
        <button type="button" className="btn btn-sm" onClick={clone} disabled={busy !== null}>
          {busy === "clone" ? "cloning…" : "Clone"}
        </button>
      ) : !signedIn ? (
        <a className="btn btn-sm no-underline" href={`/signin?next=/d/${owner}/${slug}`}>
          Sign in to clone
        </a>
      ) : null}
      <button type="button" className="btn btn-sm" onClick={exportSvg}>
        Export SVG
      </button>
      <a className="btn btn-sm no-underline" href={`${base}/yaml`} target="_blank" rel="noreferrer">
        YAML
      </a>
      {canWrite && !isCurated ? (
        <>
          <button
            type="button"
            className="btn btn-sm"
            onClick={toggleVisibility}
            disabled={busy !== null}
          >
            {visibility === "public" ? "Make private" : "Make public"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={remove}
            disabled={busy !== null}
          >
            Delete
          </button>
        </>
      ) : null}
      {error ? <span className="status status-err">{error}</span> : null}
    </div>
  );
}
