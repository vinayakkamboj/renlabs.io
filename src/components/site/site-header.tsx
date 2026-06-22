"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LogOut, LayoutGrid } from "lucide-react";
import { Wordmark } from "@/components/ui/wordmark";
import { Button } from "@/components/ui/button";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/code", label: "Products" },
  { href: "/pricing", label: "Pricing" },
  { href: "/research", label: "Research" },
  { href: "/docs", label: "Documentation" },
  { href: "/api", label: "API" },
];

function UserButton({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = email[0]?.toUpperCase() ?? "U";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-line-strong bg-paper-raised px-3 py-1.5 text-[13px] font-medium tracking-tight text-ink transition-all duration-200 hover:border-stone hover:bg-paper-deep"
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-bronze text-[10px] font-bold text-paper">
          {initial}
        </span>
        <span className="max-w-[14ch] truncate hidden sm:inline">{email}</span>
        <ChevronDown
          className={cn(
            "size-3 text-graphite-soft transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-52 origin-top-right overflow-hidden rounded-2xl border border-line bg-paper shadow-float"
          >
            <div className="border-b border-line px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-graphite-soft">
                Signed in as
              </p>
              <p className="mt-0.5 truncate text-[13px] font-medium text-ink">
                {email}
              </p>
            </div>
            <div className="p-1.5">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] text-ink transition-colors hover:bg-paper-deep"
              >
                <LayoutGrid className="size-4 text-graphite-soft" />
                Dashboard
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] text-graphite transition-colors hover:bg-paper-deep hover:text-ink"
                >
                  <LogOut className="size-4 text-graphite-soft" />
                  Sign out
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // Real auth state — reads session on mount and listens for changes.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthChecked(true);
      return;
    }
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setAuthChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "border-b border-line/80 bg-paper/90 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 md:px-10">
        <Link
          href="/"
          aria-label="Ren Labs — back to home"
          title="Back to home"
          className="text-ink transition-opacity hover:opacity-70"
        >
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href.split("/").slice(0, 2).join("/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-[13.5px] font-medium tracking-tight transition-colors duration-300",
                  active ? "text-ink" : "text-graphite hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop auth controls — hidden until auth state is known */}
        <div className={cn("hidden items-center gap-3 md:flex", !authChecked && "opacity-0")}>
          {userEmail ? (
            <UserButton email={userEmail} />
          ) : (
            <>
              <Button href="/login" variant="ghost" size="sm">
                Sign in
              </Button>
              <Button href="/dashboard" variant="primary" size="sm">
                Start building
              </Button>
            </>
          )}
        </div>

        <button
          className="flex size-10 items-center justify-center text-ink md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          <span className="relative block h-3 w-5">
            <span
              className={cn(
                "absolute left-0 top-0 h-px w-full bg-current transition-all duration-300",
                open && "top-1.5 rotate-45",
              )}
            />
            <span
              className={cn(
                "absolute left-0 top-3 h-px w-full bg-current transition-all duration-300",
                open && "top-1.5 -rotate-45",
              )}
            />
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            className="overflow-hidden border-b border-line bg-paper md:hidden"
            aria-label="Mobile"
          >
            <div className="flex flex-col gap-1 px-6 pb-6 pt-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="py-2.5 font-serif text-2xl text-ink"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-4 flex gap-3">
                {userEmail ? (
                  <form action="/auth/signout" method="post">
                    <Button type="submit" size="md" variant="outline">
                      Sign out
                    </Button>
                  </form>
                ) : (
                  <>
                    <Button href="/dashboard" size="md">
                      Start building
                    </Button>
                    <Button href="/login" variant="outline" size="md">
                      Sign in
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
