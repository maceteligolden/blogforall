import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authToken = request.cookies.get("auth-token")?.value;

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
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!authToken && isProtected) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
