"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coins, Gift, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  adminGrantCredits,
  adminSetFreeGenerations,
  adminSetRole,
} from "@/lib/actions/admin";
import type { AssignableRole } from "@/lib/auth/roles";
import { ASSIGNABLE_ROLES } from "@/lib/auth/roles";

const QUICK_GRANTS = [
  { label: "Starter",  credits: 550   },
  { label: "Growth",   credits: 1800  },
  { label: "Pro",      credits: 7000  },
  { label: "Studio",   credits: 24000 },
];

export function AdminUserManager({
  userId,
  balance,
  freeGenerations,
  userRole,
  canGrant,
  isSuperAdmin,
}: {
  userId: string;
  balance: number;
  freeGenerations: number;
  /** The target user's current role (member, researcher, support, admin, …). */
  userRole: string;
  /** Whether the acting admin can grant / deduct credits. */
  canGrant: boolean;
  /** Whether the acting admin can assign roles to others (superadmin only). */
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [free, setFree] = useState(String(freeGenerations));
  const [roleVal, setRoleVal] = useState<AssignableRole>(
    ASSIGNABLE_ROLES.includes(userRole as AssignableRole)
      ? (userRole as AssignableRole)
      : "member",
  );

  function grant(credits: number, n: string) {
    start(async () => {
      const res = await adminGrantCredits(userId, credits, n);
      if (res.ok) {
        toast.success(`${credits > 0 ? "Granted" : "Deducted"} ${Math.abs(credits)} credits`);
        setAmount("");
        setNote("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function saveFree() {
    const n = parseInt(free, 10);
    if (Number.isNaN(n)) return toast.error("Enter a number");
    start(async () => {
      const res = await adminSetFreeGenerations(userId, n);
      if (res.ok) {
        toast.success("Free generations updated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function saveRole() {
    start(async () => {
      const res = await adminSetRole(userId, roleVal);
      if (res.ok) {
        toast.success("Role updated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">

      {/* Grant credits — visible to support+ */}
      {canGrant ? (
        <>
          <section className="rounded-2xl border border-carbon-line bg-carbon-raised p-5">
            <div className="flex items-center gap-2">
              <Coins className="size-4 text-brass" />
              <h2 className="text-[14px] font-medium text-dusk">Grant credits</h2>
            </div>
            <p className="mt-1 text-[12px] text-dusk-faint">
              Manually top up or deduct. Current balance:{" "}
              <span className="font-mono text-brass">{balance.toLocaleString()}</span>.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_GRANTS.map((g) => (
                <button
                  key={g.label}
                  disabled={pending}
                  onClick={() => grant(g.credits, `${g.label} plan (manual)`)}
                  className="flex items-center gap-1.5 rounded-lg border border-carbon-line bg-carbon px-3 py-1.5 text-[12px] text-dusk-muted transition-colors hover:border-brass/50 hover:text-dusk disabled:opacity-40"
                >
                  {g.label}
                  <span className="font-mono text-[11px] text-brass">
                    +{g.credits.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount (use − to deduct)"
                className="h-9 w-44 rounded-lg border border-carbon-line bg-carbon px-3 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note  e.g. manual Growth plan"
                className="h-9 min-w-[200px] flex-1 rounded-lg border border-carbon-line bg-carbon px-3 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
              />
              <button
                disabled={pending || !amount}
                onClick={() => grant(parseInt(amount, 10) || 0, note)}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-brass px-4 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Apply"}
              </button>
            </div>
          </section>

          {/* Free generations */}
          <section className="rounded-2xl border border-carbon-line bg-carbon-raised p-5">
            <div className="flex items-center gap-2">
              <Gift className="size-4 text-brass" />
              <h2 className="text-[14px] font-medium text-dusk">Free generations</h2>
            </div>
            <p className="mt-1 text-[12px] text-dusk-faint">
              Comp extra free builds. Current:{" "}
              <span className="font-mono text-brass">{freeGenerations}</span>.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                value={free}
                onChange={(e) => setFree(e.target.value)}
                className="h-9 w-28 rounded-lg border border-carbon-line bg-carbon px-3 text-[13px] text-dusk outline-none focus:border-carbon-line-strong"
              />
              <button
                disabled={pending}
                onClick={saveFree}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-carbon-line bg-carbon px-4 text-[12.5px] text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-carbon-line bg-carbon-raised px-5 py-4">
          <p className="text-[12.5px] text-dusk-faint">
            Your role doesn&apos;t allow credit operations. Ask a superadmin to upgrade
            your role to <span className="font-mono text-dusk">support</span> or higher.
          </p>
        </div>
      )}

      {/* Role assignment — superadmin only */}
      {isSuperAdmin && (
        <section className="rounded-2xl border border-carbon-line bg-carbon-raised p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brass" />
            <h2 className="text-[14px] font-medium text-dusk">Role</h2>
          </div>
          <p className="mt-1 text-[12px] text-dusk-faint">
            Set this user&apos;s role.{" "}
            <span className="text-dusk">support</span> → credit ops only.{" "}
            <span className="text-dusk">admin</span> → full panel.{" "}
            Only superadmins can change roles.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <select
              value={roleVal}
              onChange={(e) => setRoleVal(e.target.value as AssignableRole)}
              className="h-9 rounded-lg border border-carbon-line bg-carbon px-3 text-[13px] text-dusk outline-none focus:border-carbon-line-strong"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              disabled={pending}
              onClick={saveRole}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-carbon-line bg-carbon px-4 text-[12.5px] text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk disabled:opacity-40"
            >
              Update role
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
