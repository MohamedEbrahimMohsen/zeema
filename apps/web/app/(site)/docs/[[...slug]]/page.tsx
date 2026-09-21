// Every documentation page, from one route.
//
// `/docs` is the introduction and `/docs/<slug>` is everything else; the content lives in
// `apps/web/content/docs/` and `src/lib/docs.ts` is the only thing that reads it. The page is a
// server component: the prose, the syntax highlighting and the generated catalogue tables are all
// rendered here and only the sidebar, its filter and the heading rail cross into the browser.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout } from "@/components/Callout";
import { DocsChrome } from "@/components/DocsChrome";
import { DocsGenerated } from "@/components/DocsGenerated";
import { DocsMarkdown } from "@/components/DocsMarkdown";
import { DocsToc } from "@/components/DocsToc";
import { ArrowLeft, ArrowRight } from "@/components/Glyphs";
import {
  allDocs,
  docBreadcrumb,
  docNeighbours,
  docPage,
  docSearchIndex,
  docsNav,
  splitBlocks,
} from "@/lib/docs";

type Props = { params: Promise<{ slug?: string[] }> };

const hrefFor = (slug?: string[]) => (slug?.length ? `/docs/${slug.join("/")}` : "/docs");

/** The addresses the router may pre-render. The shared layout reads cookies, so nothing on this
 *  site is actually static; this exists so a typo in a content file fails the build. */
export function generateStaticParams() {
  return allDocs().map((p) => ({
    slug: p.href === "/docs" ? [] : p.href.slice("/docs/".length).split("/"),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = docPage(hrefFor((await params).slug));
  if (!page) return { title: "Not found · Zeema docs" };
  return {
    title: `${page.title} · Zeema docs`,
    description: page.description || undefined,
  };
}

export default async function DocsPage({ params }: Props) {
  const href = hrefFor((await params).slug);
  const page = docPage(href);
  if (!page) notFound();
  const { prev, next } = docNeighbours(href);
  const blocks = splitBlocks(page.body);

  return (
    <DocsChrome
      nav={docsNav()}
      index={docSearchIndex()}
      current={href}
      crumbs={docBreadcrumb(page)}
      // The shell places the rail among its own children, so this element lands in a list it did
      // not create; the key is what keeps React from asking for one.
      rail={<DocsToc key="toc" headings={page.headings} />}
    >
      <article id="doc-content" className="doc-article">
        <header className="doc-title">
          <h1 className="display">{page.title}</h1>
          {page.description ? <p className="doc-lede">{page.description}</p> : null}
        </header>

        {blocks.map((block, i) => (
          // One wrapper per block, keyed by position: a page is re-read whole, never patched
          // block by block, so where a block sits is what identifies it.
          <div className="doc-block" key={`${block.kind}-${i}`}>
            {block.kind === "markdown" ? (
              <DocsMarkdown>{block.text}</DocsMarkdown>
            ) : block.kind === "callout" ? (
              <Callout tone={block.tone}>{block.text}</Callout>
            ) : (
              <DocsGenerated name={block.name} />
            )}
          </div>
        ))}

        {prev || next ? (
          <nav className="doc-pager" aria-label="Page navigation">
            {prev ? (
              <Link className="doc-pager-link" href={prev.href}>
                <span className="label">
                  <ArrowLeft />
                  Previous
                </span>
                <span className="doc-pager-title">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link className="doc-pager-link is-next" href={next.href}>
                <span className="label">
                  Next
                  <ArrowRight />
                </span>
                <span className="doc-pager-title">{next.title}</span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </article>
    </DocsChrome>
  );
}
