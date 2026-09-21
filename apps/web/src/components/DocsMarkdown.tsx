// The documentation's Markdown renderer.
//
// It is the site's Markdown component with four additions the docs need and a README does not:
// headings carry an anchor, fenced blocks become real code blocks (YAML through YamlView, the
// rest through CodeBlock), links inside the site stay inside the site, and tables sit in a
// scroll container so a wide one never widens the page.
//
// Raw HTML stays off, exactly as it is for a README: react-markdown builds elements from the
// syntax tree and rehype-raw is deliberately absent, so nothing in a content file can inject
// markup.
import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/CodeBlock";
import { Anchor } from "@/components/Glyphs";
import { YamlView } from "@/components/YamlView";
import { headingId } from "@/lib/docs";

/** The text of a heading, flattened out of whatever inline markup it was written with. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  const el = node as { props?: { children?: ReactNode } };
  return el.props ? textOf(el.props.children) : "";
}

function Heading({ level, children }: { level: 2 | 3; children: ReactNode }) {
  const id = headingId(textOf(children));
  const inner = (
    <>
      {children}
      <a className="head-anchor" href={`#${id}`} aria-label="Link to this section">
        <Anchor />
      </a>
    </>
  );
  return level === 2 ? (
    <h2 id={id} className="doc-h">
      {inner}
    </h2>
  ) : (
    <h3 id={id} className="doc-h">
      {inner}
    </h3>
  );
}

/** A fenced block. The info string is the language; `yaml` goes to the gutter renderer. */
function Fence({ className, children }: { className?: string; children: ReactNode }) {
  const lang = /language-([a-z0-9]+)/.exec(className ?? "")?.[1] ?? "text";
  const source = textOf(children).replace(/\n$/, "");
  if (lang === "yaml" || lang === "yml")
    return (
      <div className="code-block">
        <div className="code-bar">
          <span className="code-lang">yaml</span>
        </div>
        <YamlView source={source} />
      </div>
    );
  return <CodeBlock source={source} lang={lang} />;
}

const components: Components = {
  // The page draws its own <h1> from the front matter, so a body heading never outranks it.
  h1: ({ node: _n, children }) => <Heading level={2}>{children}</Heading>,
  h2: ({ node: _n, children }) => <Heading level={2}>{children}</Heading>,
  h3: ({ node: _n, children }) => <Heading level={3}>{children}</Heading>,
  h4: ({ node: _n, children, ...p }) => <h4 {...p}>{children}</h4>,
  a: ({ node: _n, children, href, ...p }) => {
    const target = href ?? "";
    if (target.startsWith("/") || target.startsWith("#"))
      return (
        <Link {...p} href={target}>
          {children}
        </Link>
      );
    return (
      <a {...p} href={target} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  table: ({ node: _n, children, ...p }) => (
    <div className="doc-table-wrap">
      <table {...p}>{children}</table>
    </div>
  ),
  // `pre > code` is the fenced block. The block is drawn from the <pre> rather than from the
  // <code> inside it, so this override replaces the wrapper instead of returning its children —
  // CodeBlock and YamlView draw their own <pre>.
  pre: ({ node: _n, children }) => {
    const child = (Array.isArray(children) ? children[0] : children) as {
      props?: { className?: string; children?: ReactNode };
    };
    return <Fence className={child?.props?.className}>{child?.props?.children ?? children}</Fence>;
  },
  code: ({ node: _n, className, children, ...p }) => (
    <code {...p} className={className}>
      {children}
    </code>
  ),
  img: ({ node: _n, alt, ...p }) => <img {...p} alt={alt ?? ""} loading="lazy" />,
};

export function DocsMarkdown({ children }: { children: string }) {
  return (
    <div className="md doc-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
