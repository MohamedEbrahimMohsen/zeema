import { NextResponse } from "next/server";

// The catalogue is a static, versioned bundle served from /catalogue/*.json; this address is the
// stable name for it.
export function GET(req: Request) {
  return NextResponse.redirect(new URL("/catalogue/catalogue.json", req.url), { status: 307 });
}
