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
  /** The head is ahead of the release: offer Publish. */
  unpublished: boolean;
  /** Never released yet (a private draft). */
  neverPublished: boolean;
  /** The address publishing will move this design to, when that differs from where it sits. */
  plannedSlug: string;
};

export function DesignActions({
  owner,
  slug,
  canWrite,
  canClone,
  signedIn,
  visibility,
  isCurated,
  unpublished,
  neverPublished,
  plannedSlug,
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
  // Publishing an unnamed draft also moves it to an address made from its title, so the owner is
  // told which address that is before they agree to it rather than discovering it afterwards.
  const moving = plannedSlug !== slug;
  const publish = async () => {
    if (moving && !confirm(`Publish this design at /d/${owner}/${plannedSlug}?`)) return;
    const res = await call("publish", () => fetch(`${base}/publish`, { method: "POST" }));
    if (!res) return;
    const body = await res.json().catch(() => null);
    const next = body?.design?.slug;
    if (next && next !== slug) router.replace(`/d/${owner}/${next}`);
    router.refresh();
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
    if (res) router.push("/?owner=me");
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        className={`btn btn-sm ${canWrite ? "btn-primary" : ""} no-underline`}
        href={`/d/${owner}/${slug}/canvas`}
      >
        {canWrite ? "Open in canvas" : "View in canvas"}
      </a>
      {/* Editing the YAML lives with the YAML, and exporting the picture lives with the
          picture: both in their own section's toolbar rather than up here. */}
      {canWrite && unpublished ? (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={publish}
          disabled={busy !== null}
          title={`${
            neverPublished
              ? "Release this version; it shows to others once the design is public"
              : "Release the current draft; readers see the previous release until then"
          }${moving ? `. This draft moves to /d/${owner}/${plannedSlug}` : ""}`}
        >
          {busy === "publish" ? "publishing…" : "Publish"}
        </button>
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
