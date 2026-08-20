import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get auth token from localStorage via cookie (set by client)
  const authToken = request.cookies.get("auth-token")?.value || request.headers.get("authorization");

  // Define public routes that should NOT be accessible when logged in
  // Logged-in users may visit the landing page to pause onboarding.
  const isAuthPage = pathname.startsWith("/auth/login") || pathname.startsWith("/auth/signup");

  // Define protected routes that REQUIRE authentication
  const isProtectedRoute = pathname.startsWith("/dashboard");

  // 1. If user is logged in and tries to access an auth page, redirect away.
  // Signup must NOT go straight to /dashboard: setTokens sets the cookie while still on
  // /auth/signup, and middleware would race router.push("/auth/verify-email") → stuck Loading.
  // verify-email is the wizard entry; it replaces to the correct stage when already past OTP.
  if (authToken && isAuthPage) {
    // Wizard entry routes to the current signup stage (or dashboard when complete).
    return NextResponse.redirect(new URL("/auth/verify-email", request.url));
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
     * - demos (landing product screenshots in /public/demos)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|demos/|favicon.ico).*)",
  ],
};
