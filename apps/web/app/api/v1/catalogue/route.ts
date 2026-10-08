import { NextResponse } from "next/server";
import { redirectTo } from "@/lib/http-guards";

// The catalogue is a static, versioned bundle served from /catalogue/*.json; this address is the
// stable name for it.
export function GET(req: Request) {
  return NextResponse.redirect(redirectTo(req, "/catalogue/catalogue.json"), { status: 307 });
}
