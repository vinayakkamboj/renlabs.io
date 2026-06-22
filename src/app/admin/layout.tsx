import type { Metadata } from "next";
import { AdminShell } from "@/components/platform/admin-shell";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — Ren Labs Admin" },
  description: "Ren Labs internal admin.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Gate the entire admin surface — non-admins are redirected to /dashboard.
  const admin = await requireAdmin();
  return (
    <AdminShell adminEmail={admin.email} isSuperAdmin={admin.isSuperAdmin}>
      {children}
    </AdminShell>
  );
}
