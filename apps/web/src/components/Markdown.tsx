// The one Markdown renderer on the site. react-markdown builds React elements straight from the
// syntax tree, so there is never a string of HTML to trust: raw HTML in the source is not parsed
// into elements and rehype-raw is deliberately absent, which is what keeps a <script> someone
// pasted into a README inert.
//
// It renders in a server component, and the same component is used inside the client-side README
// editor for its live preview.
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// The page's own <h1> is the design title, so the document starts a level down and everything
// else shifts with it; a README may not outrank the thing it describes.
// `node` is the syntax-tree node react-markdown hands every override; it is not an attribute,
// so each of these drops it rather than spreading it onto the element.
const components: Components = {
  h1: ({ node: _n, children, ...p }) => <h2 {...p}>{children}</h2>,
  h2: ({ node: _n, children, ...p }) => <h3 {...p}>{children}</h3>,
  h3: ({ node: _n, children, ...p }) => <h4 {...p}>{children}</h4>,
  h4: ({ node: _n, children, ...p }) => <h5 {...p}>{children}</h5>,
  h5: ({ node: _n, children, ...p }) => <h6 {...p}>{children}</h6>,
  h6: ({ node: _n, children, ...p }) => <h6 {...p}>{children}</h6>,
  // Someone else's README links somewhere else: a new tab, no referrer passed on, and no
  // endorsement handed to whatever it points at.
  a: ({ node: _n, children, href, ...p }) => (
    <a {...p} href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
  img: ({ node: _n, alt, ...p }) => <img {...p} alt={alt ?? ""} loading="lazy" />,
};

export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
