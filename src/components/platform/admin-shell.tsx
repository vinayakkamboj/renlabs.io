"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/usage", label: "Usage & revenue" },
];

export function AdminShell({
  children,
  adminEmail,
}: {
  children: React.ReactNode;
  adminEmail: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-carbon text-dusk">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-carbon-line bg-carbon/95 px-6 backdrop-blur-md">
        <Link href="/admin" className="mr-2 flex shrink-0 items-center gap-2">
          <ShieldCheck className="size-5 text-brass" />
          <span className="font-serif text-[1.05rem] font-medium tracking-tight">
            Ren Labs
          </span>
          <span className="rounded-full border border-signal-red/40 bg-signal-red/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-signal-red">
            Internal
          </span>
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

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden font-mono text-[11px] text-dusk-faint sm:inline">
            {adminEmail}
          </span>
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
