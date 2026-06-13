"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsNav } from "@/lib/data/docs";
import { cn } from "@/lib/utils";

export function DocSidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="space-y-8">
      {docsNav.map((group) => (
        <div key={group.group}>
          <p className="px-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-graphite-soft">
            {group.group}
          </p>
          <ul className="mt-3 space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-1.5 text-[13.5px] tracking-tight transition-colors duration-200",
                      active
                        ? "bg-bronze-wash font-medium text-bronze-deep"
                        : "text-graphite hover:bg-paper-deep hover:text-ink",
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
