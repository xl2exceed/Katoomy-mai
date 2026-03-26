// file: middleware.ts

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // ✅ Forward pathname as a REQUEST header so server components can read it
  // (must be on the request, not the response, for `headers()` to pick it up)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Skip auth check on login pages
  if (
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/mobile/login")
  ) {
    return supabaseResponse;
  }

  // Protect all other /admin routes
  if (pathname.startsWith("/admin") && !user) {
    const url = request.nextUrl.clone();
    // Mobile routes go to mobile login, desktop routes go to desktop login
    url.pathname = pathname.startsWith("/admin/mobile")
      ? "/admin/mobile/login"
      : "/admin/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
