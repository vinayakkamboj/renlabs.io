import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/platform/admin-shell";
import { getAdminUser } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — Ren Labs Admin" },
  description: "Ren Labs internal admin.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await getAdminUser();

  // Authenticated non-admins get a clear denial (not a redirect — a redirect to
  // /dashboard would loop on the admin subdomain). Unauthenticated users are
  // already sent to /login by the middleware.
  if (!admin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-carbon px-6 text-center text-dusk">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal-red">
          Access denied
        </p>
        <h1 className="mt-4 font-serif text-[1.6rem] text-dusk">
          This area is for Ren Labs admins
        </h1>
        <p className="mt-2 max-w-[42ch] text-[13.5px] text-dusk-muted">
          Your account doesn&apos;t have admin access. If you believe this is a
          mistake, contact the platform owner.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 flex h-9 items-center rounded-lg bg-brass px-4 text-[13px] font-medium text-carbon transition-colors hover:bg-brass-deep"
        >
          Back to Ren Code
        </Link>
      </div>
    );
  }

  return (
    <AdminShell adminEmail={admin.email} isSuperAdmin={admin.isSuperAdmin}>
      {children}
    </AdminShell>
  );
}
