"use client";

// The owner's choice of the mark their design wears in the browse list. A small card in the
// menu's own style, like the tint popover on the canvas: the current choice, a search box,
// "Automatic", then the provider marks and the group marks (brands and concepts).
//
// `BadgeChooser` is the card alone; where a pick goes is its caller's business (`onChoose`).
// The design page opens `BadgePicker` from its `⋯` menu, which saves at once through
// PATCH …/layout, a layout-only save of the head (the server decides whether it folds into the
// draft or starts one). The canvas owns its layout sidecar and autosaves it, so there a pick
// only sets the sidecar's `badge` and rides the canvas's own save.
//
// The marks arrive from the server (brand.ts reads and sanitises the icon files), so this never
// fetches an icon and only the owner's page carries them.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BadgeChoice } from "@/lib/brand";

export type BadgeMenuData = {
  /** The stored choice, or null for automatic. */
  current: string | null;
  /** What automatic picks for this design today, or null when it picks none. */
  auto: { markup: string; name: string } | null;
  providers: BadgeChoice[];
  boundaries: BadgeChoice[];
};

export function Mark({ markup }: { markup: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: mark from icons/, stripped of scripts and handlers in brand.ts
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/** The design page's picker: a pick is saved at once as a layout-only save of the head. */
export function BadgePicker({
  owner,
  slug,
  data,
  onClose,
}: {
  owner: string;
  slug: string;
  data: BadgeMenuData;
  onClose: (refocus: boolean) => void;
}) {
  const router = useRouter();
  const choose = async (ref: string | null) => {
    const res = await fetch(`/api/v1/designs/${owner}/${slug}/layout`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ badge: ref }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error?.message ?? `${res.status}`);
    // The save may have started a draft: the page's notice and chips follow.
    router.refresh();
    return (body.badge ?? null) as string | null;
  };
  return <BadgeChooser data={data} onChoose={choose} onClose={onClose} />;
}

/**
 * The card. `onChoose` persists a pick (null: automatic) and answers with the stored choice;
 * a thrown error is shown in the card. `inline` lays it in the flow of its container instead of
 * hanging it under a menu button.
 */
export function BadgeChooser({
  data,
  onChoose,
  onClose,
  inline = false,
}: {
  data: BadgeMenuData;
  onChoose: (ref: string | null) => Promise<string | null> | string | null;
  onClose: (refocus: boolean) => void;
  inline?: boolean;
}) {
  const [current, setCurrent] = useState<string | null>(data.current);
  // A caller that holds the choice itself (the canvas) may change it under the card: follow.
  useEffect(() => setCurrent(data.current), [data.current]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const dismiss = useRef(onClose);
  dismiss.current = onClose;

  // Focus goes to the search box; a press outside or Escape closes the card.
  useEffect(() => {
    search.current?.focus();
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) dismiss.current(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const all = useMemo(() => [...data.providers, ...data.boundaries], [data]);
  const chosen = current ? all.find((c) => c.ref === current) : undefined;
  const needle = q.trim().toLowerCase();
  const match = (c: BadgeChoice) =>
    !needle || c.name.toLowerCase().includes(needle) || c.ref.includes(needle);
  const providers = data.providers.filter(match);
  const boundaries = data.boundaries.filter(match);
  const showAuto = !needle || "automatic".includes(needle);

  const pick = async (ref: string | null) => {
    if (busy || ref === current) return;
    setBusy(true);
    setError(null);
    try {
      setCurrent(await onChoose(ref));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cell = (c: BadgeChoice) => (
    <button
      key={c.ref}
      type="button"
      className="badge-cell"
      aria-label={c.name}
      aria-pressed={current === c.ref}
      title={c.name}
      disabled={busy}
      onClick={() => void pick(c.ref)}
    >
      <Mark markup={c.markup} />
    </button>
  );

  return (
    <div
      ref={root}
      className={`menu badge-pop${inline ? " badge-pop-inline" : ""}`}
      role="dialog"
      aria-label="List badge"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          e.preventDefault();
          onClose(true);
        }
      }}
    >
      <div className="badge-current">
        <span className="badge-heading">Current</span>
        <span className="badge-now">
          {chosen ? (
            <>
              <span className="badge-mark">
                <Mark markup={chosen.markup} />
              </span>
              {chosen.name}
            </>
          ) : (
            <>
              {data.auto ? (
                <span className="badge-mark">
                  <Mark markup={data.auto.markup} />
                </span>
              ) : null}
              Automatic
            </>
          )}
        </span>
        {busy ? <span className="badge-status">saving…</span> : null}
      </div>
      <input
        ref={search}
        type="search"
        className="input badge-search"
        placeholder="Search marks"
        aria-label="Search marks"
        spellCheck={false}
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {showAuto ? (
        <button
          type="button"
          className={`menu-item badge-auto${current === null ? " is-current" : ""}`}
          aria-pressed={current === null}
          disabled={busy}
          onClick={() => void pick(null)}
        >
          <span className="badge-mark">
            {data.auto ? <Mark markup={data.auto.markup} /> : null}
          </span>
          <span>Automatic</span>
          <span className="badge-hint">{data.auto ? data.auto.name : "none"}</span>
        </button>
      ) : null}
      {providers.length ? (
        <>
          <div className="badge-heading">Providers</div>
          <div className="badge-grid">{providers.map(cell)}</div>
        </>
      ) : null}
      {boundaries.length ? (
        <>
          <div className="badge-heading">Brands and concepts</div>
          <div className="badge-grid badge-grid-scroll">{boundaries.map(cell)}</div>
        </>
      ) : null}
      {!showAuto && !providers.length && !boundaries.length ? (
        <div className="badge-empty">No mark matches.</div>
      ) : null}
      {error ? <span className="status status-err small">{error}</span> : null}
    </div>
  );
}
