import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// First line of defence only: sends people with no valid login cookie to the
// login page before any page code runs. It does NOT check roles or the database.
// Real permission checks happen in permissions.js, inside pages, API routes
// and server actions.
export const proxy = auth((request) => {
  if (!request.auth) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/coordinator/:path*",
    "/teacher/:path*",
    "/sections/:path*",
    "/marks/:path*",
    "/notifications/:path*",
    "/repository/:path*",
  ],
};