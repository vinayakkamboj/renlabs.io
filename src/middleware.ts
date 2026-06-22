import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh + access control.
 *
 * With Supabase configured: /dashboard requires a signed-in user, and /login
 * bounces signed-in users to the dashboard. Without keys, auth is disabled
 * and everything stays publicly reachable (demo mode).
 */
export async function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "")
    .split(":")[0]
    .toLowerCase()
    .replace(/^www\./, ""); // tolerate www.admin.renlabs.io → admin.renlabs.io
  const nextUrl = request.nextUrl;

  // Host-based routing: admin.renlabs.io (or any admin.* host) serves the
  // /admin tree. Links inside the panel already use /admin/* paths, so this
  // mainly maps the subdomain root and bare paths onto the admin routes.
  if (host.startsWith("admin.")) {
    if (!nextUrl.pathname.startsWith("/admin")) {
      const rewritten = nextUrl.clone();
      rewritten.pathname =
        nextUrl.pathname === "/" ? "/admin" : `/admin${nextUrl.pathname}`;
      return NextResponse.rewrite(rewritten);
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

  // Only do the session work for paths that actually gate on auth.
  const path = nextUrl.pathname;
  const needsAuth =
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path === "/login";
  if (!needsAuth) return NextResponse.next();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not run code between createServerClient and auth.getUser() —
  // it can cause random logouts via stale cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && (path.startsWith("/dashboard") || path.startsWith("/admin"))) {
    const redirect = nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = "";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  if (user && path === "/login") {
    const redirect = nextUrl.clone();
    redirect.pathname = "/dashboard";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return supabaseResponse;
}

export const config = {
  // Run on everything except Next internals and static assets, so the admin
  // host rewrite reaches the subdomain root. Auth work is still scoped above.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
  ],
};
