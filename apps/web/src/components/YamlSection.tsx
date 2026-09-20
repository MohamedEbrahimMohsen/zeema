// The YAML on a design page: a panel that opens, with its own small toolbar. The actions live
// beside the source they act on rather than in the page header, and they stay reachable while
// the block is collapsed — the toolbar is a sibling of the <summary>, not a child of it, so a
// click on Copy does not also fold the section away.
//
// Server-rendered; CopyButton is the only client island.
import { CopyButton } from "@/components/CopyButton";
import { Download, Pencil, Raw } from "@/components/Glyphs";
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
  const raw = `/api/v1/designs/${owner}/${slug}/yaml${version ? `?version=${version}` : ""}`;
  const download = `${raw}${version ? "&" : "?"}download=1`;
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
          title="Download"
        >
          <Download />
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
