// A code sample in the documentation: the language in the top-left corner, a copy button in the
// top-right, the source tinted by src/lib/code-highlight.ts.
//
// YAML never comes here — `YamlView` already prints it with a line-number gutter, and the docs
// renderer sends `yaml` fences there instead. This is the block for everything else, and it wears
// the same frame so a page of mixed languages reads as one thing.
//
// Server-rendered; only the copy button is a client island.
import { CopyButton } from "@/components/CopyButton";
import { highlightCode, LANG_LABEL } from "@/lib/code-highlight";

export function CodeBlock({
  source,
  lang = "text",
  copy = true,
}: {
  source: string;
  lang?: string;
  copy?: boolean;
}) {
  const trailing = source.endsWith("\n");
  const body = trailing ? source.slice(0, -1) : source;
  const lines = highlightCode(lang, body);
  return (
    <div className="code-block">
      <div className="code-bar">
        <span className="code-lang">{LANG_LABEL[lang] ?? lang}</span>
        {copy ? (
          <CopyButton
            text={source}
            label={`Copy ${LANG_LABEL[lang] ?? lang}`}
            className="btn-icon"
          />
        ) : null}
      </div>
      <pre className="code">
        {lines.map((spans, i) => (
          <span className="code-line" key={i}>
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
