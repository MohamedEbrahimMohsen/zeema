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

  // The counter is the point of the event, not the download: a failed POST never stops a file
  // from being saved.
  const logExport = (format: "svg" | "png") => {
    void fetch(`${base}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "export", format }),
    }).catch(() => {});
  };

  const downloadSvg = () => {
    logExport("svg");
    window.open(`${base}/render?download=1`, "_blank");
  };

  const downloadPng = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await rasterise(svg, { mime: "image/png", scale: 2, background: "#ffffff" });
      logExport("png");
      saveFile(`${slug}.png`, blob, "image/png");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel doc-section">
      <div className="doc-head">Design</div>
      <div className="doc-actions">
        <a
          className="btn-icon"
          href={`/d/${owner}/${slug}/canvas`}
          aria-label={canWrite ? "Open in canvas" : "View in canvas"}
          title={canWrite ? "Open in canvas" : "View in canvas"}
        >
          <Canvas />
        </a>
        <button
          type="button"
          className="btn-icon"
          onClick={downloadSvg}
          aria-label={`Download ${slug}.svg`}
          title="Download SVG"
        >
          <Download />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => void downloadPng()}
          disabled={busy}
          aria-label={`Download ${slug}.png`}
          title={busy ? "Drawing the PNG…" : "Download PNG"}
        >
          <Picture />
        </button>
        <CopyButton text={svg} label="Copy the SVG" className="btn-icon" />
        <button
          type="button"
          className="btn-icon"
          onClick={() => setActual(!actual)}
          aria-label={actual ? "Fit the drawing to the page" : "Show the drawing at actual size"}
          title={actual ? "Fit" : "Actual size"}
        >
          {actual ? <Fit /> : <Actual />}
        </button>
      </div>
      <div className={`doc-body svg-preview${actual ? " preview-actual" : ""}`}>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: SVG produced by the engine from escaped data */}
        <div dangerouslySetInnerHTML={{ __html: preview }} />
      </div>
      {error ? <span className="status status-err small">{error}</span> : null}
    </section>
  );
}
