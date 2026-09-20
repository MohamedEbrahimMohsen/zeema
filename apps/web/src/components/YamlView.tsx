// The one way the site prints YAML: tinted by src/lib/yaml-highlight.ts, numbered down the
// left. The gutter is drawn, not written: `user-select: none` keeps it out of a selection, and
// the Copy button copies the source string it was handed rather than anything on screen.
//
// Server-rendered; only the Copy button is a client island.
import { CopyButton } from "@/components/CopyButton";
import { highlightYaml } from "@/lib/yaml-highlight";

type Props = {
  source: string;
  /** Show the Copy button. Off where the block is decoration rather than something to take. */
  copy?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export function YamlView({ source, copy = true, className = "", style }: Props) {
  // A document ends with a newline; that last empty line is the newline, not a line to number.
  const trailing = source.endsWith("\n");
  const body = trailing ? source.slice(0, -1) : source;
  const lines = highlightYaml(body);
  const width = `${String(lines.length).length}ch`;
  return (
    <div className="yaml-block">
      {copy ? (
        <div className="yaml-tools">
          <CopyButton text={source} />
        </div>
      ) : null}
      <pre className={`code yaml ${className}`.trim()} style={style}>
        {lines.map((spans, i) => (
          <span className="yaml-line" key={i}>
            <span className="yaml-no" style={{ width }} aria-hidden="true">
              {i + 1}
            </span>
            {spans.map((s, j) =>
              s.t ? (
                <span className={`syn-${s.t}`} key={j}>
                  {s.s}
                </span>
              ) : (
                s.s
              ),
            )}
            {i < lines.length - 1 ? "\n" : trailing ? "\n" : ""}
          </span>
        ))}
      </pre>
    </div>
  );
}
