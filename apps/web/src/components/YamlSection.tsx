// The YAML on a design page: a panel that opens, with its own small toolbar. The actions live
// beside the source they act on rather than in the page header, and they stay reachable while
// the block is collapsed — the toolbar is a sibling of the <summary>, not a child of it, so a
// click on Copy does not also fold the section away.
//
// Server-rendered; CopyButton and ImportLayoutButton are the client islands.
import { CopyButton } from "@/components/CopyButton";
import { Download, Pencil, Raw } from "@/components/Glyphs";
import { ImportLayoutButton } from "@/components/ImportLayoutButton";
import { YamlView } from "@/components/YamlView";

type Props = {
  owner: string;
  slug: string;
  yaml: string;
  canWrite: boolean;
  /** The version the page is showing, when it is not the current one. */
  version?: string;
};

export function YamlSection({ owner, slug, yaml, canWrite, version }: Props) {
  const base = `/api/v1/designs/${owner}/${slug}`;
  const q = version ? `?version=${version}` : "";
  const raw = `${base}/yaml${q}`;
  const download = `${raw}${q ? "&" : "?"}download=1`;
  // The layout and the pair: the two files a design leaves the site as (design.yaml beside
  // design.layout.json), and come back in through New design ▾ Import YAML.
  const layout = `${base}/layout${q}${q ? "&" : "?"}download=1`;
  const zip = `${base}/zip${q}`;
  return (
    <section className="panel doc-section">
      <details className="doc-details">
        <summary className="doc-head">
          YAML <span className="count mono">{yaml.split("\n").length} lines</span>
        </summary>
        <div className="doc-body">
          <YamlView source={yaml} copy={false} />
        </div>
      </details>
      <div className="doc-actions">
        <CopyButton text={yaml} className="btn-icon" />
        <a
          className="btn-icon"
          href={raw}
          target="_blank"
          rel="noreferrer"
          aria-label="Open the raw YAML in a new tab"
          title="Open raw"
        >
          <Raw />
        </a>
        <a
          className="btn-icon"
          href={download}
          aria-label={`Download ${slug}.yaml`}
          title="Download YAML"
        >
          <Download />
        </a>
        <a
          className="btn-icon btn-icon-text"
          href={layout}
          aria-label={`Download layout (JSON): ${slug}.layout.json`}
          title="Download layout (JSON)"
        >
          <Download />
          <span>Layout</span>
        </a>
        {/* Importing applies on the canvas, which edits the current version only. */}
        {version ? null : <ImportLayoutButton owner={owner} slug={slug} />}
        <a
          className="btn-icon btn-icon-text"
          href={zip}
          aria-label={`Download both (.zip): ${slug}.zip`}
          title="Download both (.zip): design.yaml and design.layout.json"
        >
          <Download />
          <span>Both .zip</span>
        </a>
        {canWrite ? (
          <a
            className="btn-icon btn-icon-text"
            href={`/d/${owner}/${slug}/edit`}
            aria-label="Edit the YAML"
            title="Edit"
          >
            <Pencil />
            <span>Edit</span>
          </a>
        ) : null}
      </div>
    </section>
  );
}
