// /llms.txt — the machine-readable index of the catalogue, per the llms.txt convention.
// A folder literally named `llms.txt` is a legal app-router segment, so this needs no rewrite.

import { siteOrigin } from "@/lib/reference";
import { renderLlmsTxt } from "@/lib/reference-markdown";

export async function GET(req: Request) {
  return new Response(renderLlmsTxt(siteOrigin(req)), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600",
    },
  });
}
