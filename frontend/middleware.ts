import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Use Node.js runtime instead of edge runtime to avoid import assertion issues
export const runtime = "nodejs";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get auth token from localStorage via cookie (set by client)
  const authToken = request.cookies.get("auth-token")?.value || request.headers.get("authorization");

  // Define public routes that should NOT be accessible when logged in
  const isAuthPage =
    pathname === "/" ||
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/signup");

  // Define protected routes that REQUIRE authentication
  const isProtectedRoute = pathname.startsWith("/dashboard");

  // 1. If user is logged in and tries to access an auth page, redirect to dashboard
  if (authToken && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 2. If user is NOT logged in and tries to access a protected route, redirect to login
  if (!authToken && isProtectedRoute) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

