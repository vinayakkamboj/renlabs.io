import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isUserAllowed } from "@/lib/auth/access";

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

  // Host-based routing for the admin subdomain (admin.renlabs.io).
  //  - bare host        → admin overview
  //  - Ren Code app paths → bounce into the admin area (avoid a broken/mixed UI)
  //  - /admin/*, /login, /auth pass through untouched
  if (host.startsWith("admin.")) {
    const p = nextUrl.pathname;
    if (p === "/") {
      return NextResponse.rewrite(new URL("/admin", request.url));
    }
    if (
      p === "/dashboard" ||
      p.startsWith("/dashboard/") ||
      p === "/console" ||
      p.startsWith("/console/")
    ) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

  // Only do the session work for paths that actually gate on auth.
  const path = nextUrl.pathname;
  const isProductPath =
    path.startsWith("/dashboard") || path.startsWith("/workspace");
  const needsAuth =
    isProductPath ||
    path.startsWith("/admin") ||
    path === "/login" ||
    path === "/restricted";
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

  // /admin handles its own (dedicated) sign-in screen, so don't bounce it to the
  // user login. Only the Ren Code product surfaces redirect unauthenticated users.
  if (!user && isProductPath) {
    const redirect = nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = "";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  // Private beta: allowed = static allowlist OR an admin-approved trial
  // request. Signed-in users without access land on /restricted, where they
  // can request a trial. (The compute APIs enforce the same rule server-side;
  // this redirect is the friendly half.)
  const gateRelevant =
    !!user && (isProductPath || path === "/restricted" || path === "/login");
  const allowed = gateRelevant
    ? await isUserAllowed(supabase, user!.id, user!.email)
    : false;

  if (user && isProductPath && !allowed) {
    const redirect = nextUrl.clone();
    redirect.pathname = "/restricted";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  // Allowed users have no business on /restricted — send them in.
  if (path === "/restricted" && user && allowed) {
    const redirect = nextUrl.clone();
    redirect.pathname = "/dashboard";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  if (user && path === "/login" && !allowed && !host.startsWith("admin.")) {
    const redirect = nextUrl.clone();
    redirect.pathname = "/restricted";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  if (user && path === "/login") {
    const redirect = nextUrl.clone();
    redirect.pathname = host.startsWith("admin.") ? "/admin" : "/dashboard";
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
