"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { RenMark } from "@/components/ui/wordmark";
import { UserMenu } from "@/components/auth/user-menu";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/dashboard", label: "Projects", exact: true },
  { href: "/dashboard/chat", label: "Chat" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/integrations", label: "Integrations" },
];

export function PlatformShell({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-carbon text-dusk">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-carbon-line bg-carbon/95 px-6 backdrop-blur-md">
        <Link href="/dashboard" className="mr-2 flex shrink-0 items-center gap-2">
          <RenMark className="size-5 text-brass" />
          <span className="font-serif text-[1.05rem] font-medium tracking-tight">Ren Labs</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {navLinks.map(({ href, label, exact }) => {
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

        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-lg border border-signal-red/30 bg-signal-red/[0.06] px-3 py-1.5 text-[12.5px] text-signal-red/90 transition-colors hover:bg-signal-red/10"
            >
              <ShieldCheck className="size-3.5" />
              Admin
            </Link>
          )}
          <Link
            href="/console"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] text-dusk-muted transition-colors hover:bg-carbon-raised hover:text-dusk sm:flex"
          >
            API console
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="platform-scroll mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
