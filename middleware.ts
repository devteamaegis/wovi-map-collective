import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

// Baseline security headers on every response. Defined inline because the edge
// middleware runtime can't import lib/security (it pulls in better-sqlite3).
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};
function secured(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
}

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
  "/api/health",
  "/_next",
  "/favicon",
];

export function middleware(req: NextRequest) {
  // Sign-in is opt-in — the auth gate only runs when WOVI_AUTH=on, but the
  // security headers apply in every mode.
  if (process.env.WOVI_AUTH !== "on") return secured(NextResponse.next());

  const { pathname } = req.nextUrl;
  // Segment-safe prefix match — "/login" must NOT exempt "/loginX" or
  // "/api/erp" exempt "/api/erpanything". Only an exact path or a real
  // path-segment child (`/prefix/...`) bypasses the gate.
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return secured(NextResponse.next());
  }
  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return secured(NextResponse.redirect(url));
  }
  return secured(NextResponse.next());
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
