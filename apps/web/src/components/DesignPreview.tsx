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
import { Actual, Canvas, Download, Fit, Picture } from "@/components/Glyphs";

type Props = {
  owner: string;
  slug: string;
  canWrite: boolean;
  /** The engine's SVG for the version on screen, styles included. */
  svg: string;
};

export function DesignPreview({ owner, slug, canWrite, svg }: Props) {
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
      <div className="preview-label label">Design</div>
      <div className="pill preview-actions">
        <a
          className="pill-btn"
          href={`/d/${owner}/${slug}/canvas`}
          aria-label={canWrite ? "Open in canvas" : "View in canvas"}
          title={canWrite ? "Open in canvas" : "View in canvas"}
        >
          <Canvas />
        </a>
        <button
          type="button"
          className="pill-btn"
          onClick={downloadSvg}
          aria-label={`Download ${slug}.svg`}
          title="Download SVG"
        >
          <Download />
        </button>
        <button
          type="button"
          className="pill-btn"
          onClick={() => void downloadPng()}
          disabled={busy}
          aria-label={`Download ${slug}.png`}
          title={busy ? "Drawing the PNG…" : "Download PNG"}
        >
          <Picture />
        </button>
        <CopyButton text={svg} label="Copy the SVG" className="pill-btn" />
        <button
          type="button"
          className="pill-btn"
          onClick={() => setActual(!actual)}
          aria-label={actual ? "Fit the drawing to the page" : "Show the drawing at actual size"}
          title={actual ? "Fit" : "Actual size"}
        >
          {actual ? <Fit /> : <Actual />}
        </button>
      </div>
      <div className={`preview-surface svg-preview${actual ? " preview-actual" : ""}`}>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: SVG produced by the engine from escaped data */}
        <div dangerouslySetInnerHTML={{ __html: preview }} />
      </div>
      {error ? <span className="preview-error status status-err small">{error}</span> : null}
    </section>
  );
}
