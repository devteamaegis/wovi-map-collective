import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

// Cheap cookie-presence gate at the edge — actual session validation happens in
// server components via currentUser(). Public paths bypass the login redirect:
// token-authenticated APIs, the magic-link approval page, login/setup, assets.
const PUBLIC_PREFIXES = [
  "/login",
  "/setup",
  "/approve", // magic-link approval landing (its own token auth)
  "/api/integrations", // Bearer-token auth
  "/api/erp", // Bearer-token auth (machine-to-machine ERP connectors)
  "/api/cron", // cron-secret auth
  "/api/approvals", // signed-token auth
  "/api/health",
  "/_next",
  "/favicon",
];

export function middleware(req: NextRequest) {
  // Sign-in is opt-in — the gate only runs when WOVI_AUTH=on.
  if (process.env.WOVI_AUTH !== "on") return NextResponse.next();

  const { pathname } = req.nextUrl;
  // Segment-safe prefix match — "/login" must NOT exempt "/loginX" or
  // "/api/erp" exempt "/api/erpanything". Only an exact path or a real
  // path-segment child (`/prefix/...`) bypasses the gate.
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
