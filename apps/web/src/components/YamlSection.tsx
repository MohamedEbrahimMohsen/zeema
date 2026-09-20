// The YAML on a design page: a panel that opens, with its own small toolbar. The actions live
// beside the source they act on rather than in the page header, and they stay reachable while
// the block is collapsed — the toolbar is a sibling of the <summary>, not a child of it, so a
// click on Copy does not also fold the section away.
//
// Server-rendered; CopyButton is the only client island.
import { CopyButton } from "@/components/CopyButton";
import { YamlView } from "@/components/YamlView";

const Raw = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);

const Download = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M4 20h16" />
  </svg>
);

const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M15 6.5 17.5 9" />
  </svg>
);

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
    <section className="panel yaml-section">
      <details className="yaml-details">
        <summary className="yaml-summary">
          YAML <span className="count mono">{yaml.split("\n").length} lines</span>
        </summary>
        <div className="yaml-body">
          <YamlView source={yaml} copy={false} />
        </div>
      </details>
      <div className="yaml-actions">
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
