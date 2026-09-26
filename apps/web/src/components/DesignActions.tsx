"use client";

// What can be done with a design, grouped by intent. The preview card's header carries only the
// way in (open or view in the canvas) and, for everyone but the owner, Clone; the owner's
// housekeeping (clone, visibility, delete) sits behind the `⋯` at the pill's end; Publish is a
// notice above the card, shown only while there is something to publish. All of them call the
// same commands, defined once here.
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useMenuKeys } from "./menu-keys";

export type DesignActionsProps = {
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

type Command = "clone" | "publish" | "visibility" | "delete";

export function useDesignCommands({
  owner,
  slug,
  visibility,
  plannedSlug,
}: Pick<DesignActionsProps, "owner" | "slug" | "visibility" | "plannedSlug">) {
  const router = useRouter();
  const [busy, setBusy] = useState<Command | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/v1/designs/${owner}/${slug}`;

  const call = async (label: Command, fn: () => Promise<Response>) => {
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
  return { busy, error, moving, clone, publish, toggleVisibility, remove };
}

/** The header pill's text group: the way into the canvas, then Clone for anyone but the owner. */
export function DesignActions(props: DesignActionsProps) {
  const { owner, slug, canWrite, canClone, signedIn } = props;
  const { busy, error, clone } = useDesignCommands(props);
  return (
    <div className="design-actions">
      <a className="btn btn-sm btn-primary no-underline" href={`/d/${owner}/${slug}/canvas`}>
        {canWrite ? "Open in canvas" : "View in canvas"}
      </a>
      {canWrite ? null : canClone ? (
        <button type="button" className="btn btn-sm" onClick={clone} disabled={busy !== null}>
          {busy === "clone" ? "cloning…" : "Clone"}
        </button>
      ) : !signedIn ? (
        <a className="btn btn-sm no-underline" href={`/signin?next=/d/${owner}/${slug}`}>
          Sign in to clone
        </a>
      ) : null}
      {error ? <span className="status status-err">{error}</span> : null}
    </div>
  );
}

/** Whether the owner's `⋯` menu has anything in it. */
export const hasDesignMenu = (p: DesignActionsProps) => p.canWrite && (p.canClone || !p.isCurated);

/** The owner's overflow menu, at the far end of the header pill. */
export function DesignMenu(props: DesignActionsProps) {
  const { canClone, isCurated, visibility } = props;
  const { busy, error, clone, toggleVisibility, remove } = useDesignCommands(props);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);
  const onMenuKey = useMenuKeys({ open, close, root, menu });
  // The menu closes first, so a confirmation never sits on top of an open menu.
  const run = (fn: () => Promise<void>) => () => {
    setOpen(false);
    void fn();
  };

  return (
    <div ref={root} className="preview-more">
      {error ? <span className="status status-err">{error}</span> : null}
      <button
        ref={button}
        type="button"
        className="pill-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        title="More actions"
        disabled={busy !== null}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>
      {open ? (
        <div
          ref={menu}
          className="menu"
          role="menu"
          aria-label="More actions"
          onKeyDown={onMenuKey}
        >
          {canClone ? (
            <button type="button" role="menuitem" className="menu-item" onClick={run(clone)}>
              Clone
            </button>
          ) : null}
          {!isCurated ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={run(toggleVisibility)}
              >
                {visibility === "public" ? "Make private" : "Make public"}
              </button>
              <div className="menu-sep" />
              <button
                type="button"
                role="menuitem"
                className="menu-item is-danger"
                onClick={run(remove)}
              >
                Delete design
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
