import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authToken = request.cookies.get("auth-token")?.value;

  // #region agent log
  fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d03c4e" },
    body: JSON.stringify({
      sessionId: "d03c4e",
      runId: "netlify-404",
      hypothesisId: "H2",
      location: "admin-frontend/middleware.ts:7",
      message: "Middleware reached",
      data: { pathname, hasAuthToken: !!authToken },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const isLoginPage = pathname === "/login";
  const isProtected =
    pathname === "/" ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/blogs") ||
    pathname.startsWith("/token-usage") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/change-password") ||
    pathname.startsWith("/admins");

  if (authToken && isLoginPage) {
    // #region agent log
    fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d03c4e" },
      body: JSON.stringify({
        sessionId: "d03c4e",
        runId: "netlify-404",
        hypothesisId: "H3",
        location: "admin-frontend/middleware.ts:21",
        message: "Redirecting login to root due auth cookie",
        data: { pathname },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!authToken && isProtected) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    // #region agent log
    fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d03c4e" },
      body: JSON.stringify({
        sessionId: "d03c4e",
        runId: "netlify-404",
        hypothesisId: "H3",
        location: "admin-frontend/middleware.ts:39",
        message: "Redirecting protected route to login",
        data: { pathname, redirect: loginUrl.pathname + loginUrl.search },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
