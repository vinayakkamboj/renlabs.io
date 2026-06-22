import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/shell";
import { getAdminUser } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s — Ren Code",
  },
  description: "Ren Code workspace.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Admins get an "Admin" entry in the nav that links to the separate panel.
  const admin = await getAdminUser();
  return <PlatformShell isAdmin={!!admin}>{children}</PlatformShell>;
}
