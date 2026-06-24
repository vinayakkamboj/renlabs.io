"use client";

/**
 * Circular profile menu for the workspace top bar (right side). Shows the user's
 * avatar (or initial), and opens a dropdown with account shortcuts: settings,
 * billing, and sign out.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CreditCard, LogOut, Settings, UserRound } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface Profile {
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>({ email: null, name: null, avatarUrl: null });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setProfile({
        email: u.email ?? null,
        name: (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? null,
        avatarUrl: (u.user_metadata?.avatar_url as string) ?? null,
      });
    });
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial =
    profile.name?.trim()?.[0]?.toUpperCase() ??
    profile.email?.trim()?.[0]?.toUpperCase() ??
    "?";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-carbon-line bg-carbon-raised text-[12px] font-semibold text-brass transition-colors hover:border-brass/50"
      >
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-60 overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised shadow-2xl">
          <div className="border-b border-carbon-line px-4 py-3">
            <p className="truncate text-[12.5px] font-medium text-dusk">
              {profile.name ?? "Signed in"}
            </p>
            <p className="truncate text-[11.5px] text-dusk-faint">{profile.email ?? "—"}</p>
          </div>
          <nav className="py-1.5">
            <MenuItem href="/dashboard/settings" icon={<Settings className="size-3.5" />}>
              Settings
            </MenuItem>
            <MenuItem href="/dashboard/billing" icon={<CreditCard className="size-3.5" />}>
              Billing &amp; credits
            </MenuItem>
            <MenuItem href="/dashboard" icon={<UserRound className="size-3.5" />}>
              Dashboard
            </MenuItem>
          </nav>
          <form action="/auth/signout" method="post" className="border-t border-carbon-line py-1.5">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-4 py-2 text-[12.5px] text-dusk-muted transition-colors hover:bg-carbon-high hover:text-signal-red"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-4 py-2 text-[12.5px] text-dusk-muted transition-colors hover:bg-carbon-high hover:text-dusk"
    >
      {icon}
      {children}
    </Link>
  );
}
