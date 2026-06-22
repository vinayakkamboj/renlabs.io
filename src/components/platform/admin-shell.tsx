"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";
import { cn } from "@/lib/utils";
import type { AdminRole } from "@/lib/auth/roles";
import { canAccessFullPanel, ROLE_LABELS } from "@/lib/auth/roles";

/**
 * Nav items and the minimum role required to see each one.
 *   support  → Overview, Users (credit operations)
 *   admin+   → also Projects, Payments, Audit
 */
const NAV = [
  { href: "/admin",          label: "Overview", exact: true,  fullOnly: false },
  { href: "/admin/users",    label: "Users",    exact: false, fullOnly: false },
  { href: "/admin/projects", label: "Projects", exact: false, fullOnly: true  },
  { href: "/admin/payments", label: "Payments", exact: false, fullOnly: true  },
  { href: "/admin/audit",    label: "Audit",    exact: false, fullOnly: true  },
];

export function AdminShell({
  children,
  adminEmail,
  adminRole,
  isSuperAdmin = false,
}: {
  children: React.ReactNode;
  adminEmail: string;
  adminRole: AdminRole;
  isSuperAdmin?: boolean;
}) {
  const pathname = usePathname();
  const hasFullAccess = canAccessFullPanel(adminRole);

  const visibleNav = NAV.filter((item) => !item.fullOnly || hasFullAccess);

  return (
    <div className="min-h-screen bg-carbon text-dusk">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-carbon-line bg-carbon/95 px-6 backdrop-blur-md">
        <Link href="/admin" className="mr-2 flex shrink-0 items-center gap-2">
          <ShieldCheck className="size-5 text-brass" />
          <span className="font-serif text-[1.05rem] font-medium tracking-tight">
            Ren Labs
          </span>
          <span className="rounded-full border border-signal-red/40 bg-signal-red/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-signal-red">
            {ROLE_LABELS[adminRole]}
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {visibleNav.map(({ href, label, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[13px] transition-colors duration-150",
                  active
                    ? "bg-carbon-raised text-dusk"
                    : "text-dusk-muted hover:bg-carbon-raised hover:text-dusk",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden font-mono text-[11px] text-dusk-faint sm:inline">
            {adminEmail}
          </span>
          {isSuperAdmin && (
            <span className="hidden rounded-full bg-brass/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-brass sm:inline">
              Superadmin
            </span>
          )}
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] text-dusk-muted transition-colors hover:bg-carbon-raised hover:text-dusk"
          >
            <ArrowLeft className="size-3.5" />
            Exit
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="platform-scroll mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
