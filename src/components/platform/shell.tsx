"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowUpLeft,
  BarChart3,
  Boxes,
  Cpu,
  Database,
  FlaskConical,
  Gauge,
  LayoutGrid,
  Rocket,
  ScrollText,
  Search,
} from "lucide-react";
import { RenMark } from "@/components/ui/wordmark";
import { UserMenu } from "@/components/auth/user-menu";
import { cn } from "@/lib/utils";

const sections: {
  heading: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    heading: "Platform",
    items: [{ href: "/dashboard", label: "Overview", icon: LayoutGrid }],
  },
  {
    heading: "Research",
    items: [
      { href: "/dashboard/models", label: "Model registry", icon: Boxes },
      { href: "/dashboard/training", label: "Training runs", icon: Activity },
      { href: "/dashboard/experiments", label: "Experiments", icon: FlaskConical },
      { href: "/dashboard/datasets", label: "Datasets", icon: Database },
    ],
  },
  {
    heading: "Evaluation",
    items: [
      { href: "/dashboard/benchmarks", label: "Benchmark center", icon: BarChart3 },
      { href: "/dashboard/evaluations", label: "Evaluation reports", icon: ScrollText },
    ],
  },
  {
    heading: "Production",
    items: [
      { href: "/dashboard/analytics", label: "API analytics", icon: Gauge },
      { href: "/dashboard/deployments", label: "Deployments", icon: Rocket },
      { href: "/dashboard/compute", label: "GPU utilization", icon: Cpu },
    ],
  },
];

export function PlatformShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const current = sections
    .flatMap((s) => s.items)
    .find((i) =>
      i.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(i.href),
    );

  return (
    <div className="flex min-h-screen bg-carbon text-dusk">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-carbon-line bg-carbon lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-carbon-line px-5">
          <RenMark className="size-5 text-brass" />
          <span className="font-serif text-[1.05rem] font-medium tracking-tight">Ren</span>
          <span className="ml-1 rounded border border-carbon-line-strong px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-dusk-muted">
            Internal
          </span>
        </div>

        <nav className="platform-scroll flex-1 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.heading} className="mb-7">
              <p className="px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-dusk-faint">
                {section.heading}
              </p>
              <ul className="mt-2.5 space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-[13px] tracking-tight transition-colors duration-200",
                          active
                            ? "bg-carbon-high text-dusk"
                            : "text-dusk-muted hover:bg-carbon-raised hover:text-dusk",
                        )}
                      >
                        <item.icon
                          className={cn("size-4", active ? "text-brass" : "text-dusk-faint")}
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-carbon-line p-3">
          <UserMenu />
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-[13px] text-dusk-muted transition-colors duration-200 hover:bg-carbon-raised hover:text-dusk"
          >
            <ArrowUpLeft className="size-4 text-dusk-faint" />
            ren.ai
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-carbon-line bg-carbon/90 px-5 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3 font-mono text-[11.5px] text-dusk-muted">
            <Link href="/dashboard" className="text-dusk-faint transition-colors hover:text-dusk lg:hidden">
              <RenMark className="size-4 text-brass" />
            </Link>
            <span className="hidden text-dusk-faint sm:inline">research-platform</span>
            <span className="hidden text-dusk-faint sm:inline">/</span>
            <span className="text-dusk">{current?.label.toLowerCase() ?? "overview"}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-lg border border-carbon-line bg-carbon-raised px-3 py-1.5 text-dusk-faint sm:flex">
              <Search className="size-3.5" />
              <span className="text-[12px]">Search</span>
              <kbd className="ml-4 rounded border border-carbon-line-strong px-1.5 font-mono text-[10px]">
                ⌘K
              </kbd>
            </div>
            <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-muted">
              <span className="size-1.5 rounded-full bg-signal-green" />
              All systems
            </span>
          </div>
        </header>

        <main className="platform-scroll flex-1 px-5 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
