// The markdown rendering of the catalogue reference.
//
// Addressing. Every entity page is also available at its own address with `.md` appended:
// /catalogue/components/kafka.md, /catalogue/kinds/queue.md, /catalogue/rules/queue-missing-dlq.md.
// The app router cannot serve that from the page segment itself: `page.tsx` and `route.ts` cannot
// share a segment, a page cannot set a content type, and a `[id].md` folder is not a thing. So the
// `.md` suffix is a `beforeFiles` rewrite in next.config.ts onto this handler, which keeps the
// public address exactly "the page plus .md" while leaving the pages untouched. `beforeFiles`
// matters: an ordinary rewrite runs after the filesystem routes, and `kafka.md` would be swallowed
// by the `[id]` page first.
//
// Rendering is per request rather than statically generated, which matches every other page on
// this site (the shared layout reads cookies, so nothing here is static anyway) and lets the
// absolute links follow the request's own origin. It reads no files: the catalogue and the
// verbatim YAML are both loaded once per process by src/lib/catalogue.ts.

import { componentDoc, kindDoc, ruleDoc, siteOrigin } from "@/lib/reference";
import { renderMarkdown } from "@/lib/reference-markdown";

const BUILDERS = {
  components: componentDoc,
  kinds: kindDoc,
  rules: ruleDoc,
} as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  // Plain text, and never an echo of what was asked for: the id is caller text.
  const notFound = () =>
    new Response("Not found\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  const build = Object.hasOwn(BUILDERS, type) ? BUILDERS[type as keyof typeof BUILDERS] : null;
  if (!build) return notFound();
  let key: string;
  try {
    key = decodeURIComponent(id);
  } catch {
    return notFound();
  }
  const doc = build(key);
  if (!doc) return notFound();
  return new Response(renderMarkdown(doc, siteOrigin(req)), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600",
    },
  });
}
