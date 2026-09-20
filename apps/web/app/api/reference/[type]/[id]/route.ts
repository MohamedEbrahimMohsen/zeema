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
  const build = BUILDERS[type as keyof typeof BUILDERS];
  if (!build) return new Response("Not found\n", { status: 404 });
  const doc = build(decodeURIComponent(id));
  if (!doc) return new Response(`No ${type.replace(/s$/, "")} with id "${id}".\n`, { status: 404 });
  return new Response(renderMarkdown(doc, siteOrigin(req)), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600",
    },
  });
}
