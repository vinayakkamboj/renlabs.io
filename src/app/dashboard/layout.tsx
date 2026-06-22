import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/shell";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s — Ren Code",
  },
  description: "Ren Code workspace.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The admin console is a separate product at /admin with its own login and
  // chrome — it is intentionally NOT surfaced inside the customer dashboard.
  return <PlatformShell>{children}</PlatformShell>;
}
