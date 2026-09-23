// Runs in front of every request (Next 16 "proxy", formerly middleware). Two jobs:
//
// 1. Pages get a Content-Security-Policy with a fresh nonce. Next reads the nonce back out of
//    the request's CSP header and stamps it on every script it emits, and the root layout puts
//    it on the theme boot script, so no inline script without it can run. The static headers
//    (nosniff, frame denial, referrer, permissions) come from next.config.ts for every path.
// 2. State-changing API requests must come from our own pages: `crossSiteRefusal` compares
//    `Origin` (or `Sec-Fetch-Site`) with APP_ORIGIN and answers 403 otherwise.
import { type NextRequest, NextResponse } from "next/server";
import { appOrigin, crossSiteRefusal } from "@/lib/http-guards";

export function contentSecurityPolicy(nonce: string, dev = process.env.NODE_ENV === "development") {
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced Next runtime load its own chunks; 'self' is the fallback
    // for browsers without CSP3. React needs eval only for dev-mode error overlays.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are how the canvas positions and colours things. Styles only:
    // scripts never get 'unsafe-inline'.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // data: and blob: are the PNG export (an SVG drawn into a canvas) and inline icons.
    "img-src 'self' data: blob: https://avatars.githubusercontent.com",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://github.com",
  ].join("; ");
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    // Our own origins: the configured public one, and the host this request was addressed to
    // (a browser sets Host itself, so a page elsewhere cannot make it match its own Origin).
    const host = req.headers.get("host");
    const refused = crossSiteRefusal(req.method, req.headers, [
      appOrigin(),
      req.nextUrl.origin,
      host ? `http://${host}` : null,
      host ? `https://${host}` : null,
    ]);
    if (refused)
      return NextResponse.json({ error: { code: 403, message: refused } }, { status: 403 });
    return withTransportSecurity(NextResponse.next());
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return withTransportSecurity(res);
}

// HSTS only when the site is served over https (APP_ORIGIN says so). A reverse proxy that
// terminates TLS may set it too; the values agree.
function withTransportSecurity(res: NextResponse) {
  if (appOrigin()?.startsWith("https:"))
    res.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return res;
}

export const config = {
  matcher: [
    // Every API request, prefetch headers or not: the write check must not be skippable.
    "/api/:path*",
    {
      // Pages: everything but the API and the build's static files, which carry no HTML.
      source: "/((?!api/|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
