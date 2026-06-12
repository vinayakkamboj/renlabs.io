"use client";

import { useEffect, useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

/** Sidebar account block for the internal platform. */
export function UserMenu() {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, [configured]);

  if (!configured) {
    return (
      <div className="flex items-center gap-2.5 px-2 py-[7px] font-mono text-[10.5px] uppercase tracking-[0.1em] text-dusk-faint">
        <UserRound className="size-4" />
        Auth off · demo
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-[7px]">
      <span className="flex min-w-0 items-center gap-2.5 text-[12.5px] text-dusk-muted">
        <UserRound className="size-4 shrink-0 text-dusk-faint" />
        <span className="truncate">{email ?? "…"}</span>
      </span>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="flex size-7 items-center justify-center rounded-md text-dusk-faint transition-colors duration-200 hover:bg-carbon-raised hover:text-dusk"
        >
          <LogOut className="size-3.5" />
        </button>
      </form>
    </div>
  );
}
