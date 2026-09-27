"use client";

// The picture, in the same panel shape as About and YAML, with the export actions in its own
// toolbar rather than in the page header: the thing you download sits beside the thing you are
// looking at, and both come from one SVG, so they cannot drift.
//
// The SVG is rendered on the server and passed in whole. The preview strips the engine's own
// <style> so the drawing follows the page theme (globals.css restates those class rules under
// `.svg-preview`), while the copy and the PNG use the SVG as it came, styles and all, so a file
// that leaves the page stands on its own. The engine draws with system fonts and inline icon
// paths, so the raster carries no external reference and matches what is on screen.
import { useState } from "react";
import { rasterise, saveFile } from "@/canvas/exportScene";
import { CopyButton } from "@/components/CopyButton";
import {
  DesignActions,
  type DesignActionsProps,
  DesignMenu,
  hasDesignMenu,
} from "@/components/DesignActions";
import { Actual, Canvas, Download, Fit, Picture } from "@/components/Glyphs";

// The copy glyph, shown disabled while there is nothing to copy (CopyButton always copies).
const CopyGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <rect x="8" y="3" width="8" height="4" rx="1" />
    <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
  </svg>
);

type Props = {
  owner: string;
  slug: string;
  /** The design's actions: the way in and Clone first in the header pill, the owner's `⋯` last. */
  actions?: DesignActionsProps;
  /** The engine's SVG for the version on screen, styles included. */
  svg: string;
  /** Nothing drawn yet (no components): the card shows an empty state instead of the picture. */
  empty?: boolean;
};

const NOTHING = "Nothing drawn yet";

export function DesignPreview({ owner, slug, actions, svg, empty = false }: Props) {
  const [actual, setActual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/v1/designs/${owner}/${slug}`;
  const preview = svg.replace(/<style>[\s\S]*?<\/style>/, "");

  // Exports are counted by the server where it renders them: the SVG download is that render
  // itself, and the PNG, drawn here from the same picture, asks the server for the SVG it is
  // made from. A failed request never stops a file from being saved.
  const downloadSvg = () => {
    window.open(`${base}/render?download=svg`, "_blank");
  };

  const downloadPng = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await rasterise(svg, { mime: "image/png", scale: 2, background: "#ffffff" });
      void fetch(`${base}/render?download=png`).catch(() => {});
      saveFile(`${slug}.png`, blob, "image/png");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel preview-card">
      {/* One header row: the name on the left, one pill on the right holding the design's text
          actions, the picture's own icon buttons, and for the owner the `⋯` menu. On a phone the
          icons wrap to a second line inside the pill and the `⋯` stays at the end of the first.
          DOM order is focus order: label, text actions, icons, menu. */}
      <div className="preview-head">
        <div className="preview-label label">Design</div>
        <div className="pill preview-actions">
          {actions ? (
            <>
              <DesignActions {...actions} />
              <span className="pill-sep" aria-hidden="true" />
            </>
          ) : null}
          <div className="preview-icons">
            <button
              type="button"
              className="pill-btn"
              onClick={downloadSvg}
              disabled={empty}
              aria-label={`Download ${slug}.svg`}
              title={empty ? `${NOTHING}: nothing to download` : "Download SVG"}
            >
              <Download />
            </button>
            <button
              type="button"
              className="pill-btn"
              onClick={() => void downloadPng()}
              disabled={busy || empty}
              aria-label={`Download ${slug}.png`}
              title={
                empty
                  ? `${NOTHING}: nothing to download`
                  : busy
                    ? "Drawing the PNG…"
                    : "Download PNG"
              }
            >
              <Picture />
            </button>
            {empty ? (
              <button
                type="button"
                className="pill-btn"
                disabled
                aria-label="Copy the SVG"
                title={`${NOTHING}: nothing to copy`}
              >
                <CopyGlyph />
              </button>
            ) : (
              <CopyButton text={svg} label="Copy the SVG" className="pill-btn" />
            )}
            <button
              type="button"
              className="pill-btn"
              onClick={() => setActual(!actual)}
              disabled={empty}
              aria-label={
                actual ? "Fit the drawing to the page" : "Show the drawing at actual size"
              }
              title={empty ? `${NOTHING}: nothing to size` : actual ? "Fit" : "Actual size"}
            >
              {actual ? <Fit /> : <Actual />}
            </button>
          </div>
          {actions && hasDesignMenu(actions) ? <DesignMenu {...actions} /> : null}
        </div>
      </div>
      {empty ? (
        <div className="preview-surface preview-empty">
          <span className="preview-empty-icon" aria-hidden="true">
            <Canvas />
          </span>
          <strong className="preview-empty-title">{NOTHING}</strong>
          <p className="preview-empty-text">
            {actions?.canWrite
              ? "Add components in the canvas and they will be drawn here."
              : "The owner hasn't added any components."}
          </p>
          {actions?.canWrite ? (
            <a className="btn btn-sm btn-primary no-underline" href={`/d/${owner}/${slug}/canvas`}>
              Open in canvas
            </a>
          ) : null}
        </div>
      ) : (
        <div className={`preview-surface svg-preview${actual ? " preview-actual" : ""}`}>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: SVG produced by the engine from escaped data */}
          <div dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
      )}
      {error ? <span className="preview-error status status-err small">{error}</span> : null}
    </section>
  );
}
