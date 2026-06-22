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

const QUICK_GRANTS = [
  { label: "Starter", credits: 550 },
  { label: "Growth", credits: 1800 },
  { label: "Pro", credits: 7000 },
  { label: "Studio", credits: 24000 },
];

export function AdminUserManager({
  userId,
  balance,
  freeGenerations,
  role,
  isSuperAdmin,
}: {
  userId: string;
  balance: number;
  freeGenerations: number;
  role: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [free, setFree] = useState(String(freeGenerations));
  const [roleVal, setRoleVal] = useState(role);

  function grant(credits: number, n: string) {
    start(async () => {
      const res = await adminGrantCredits(userId, credits, n);
      if (res.ok) {
        toast.success(
          `${credits > 0 ? "Granted" : "Deducted"} ${Math.abs(credits)} credits`,
        );
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
      } else toast.error(res.error);
    });
  }

  function saveRole() {
    start(async () => {
      const res = await adminSetRole(
        userId,
        roleVal as "member" | "researcher" | "admin",
      );
      if (res.ok) {
        toast.success("Role updated");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {/* Grant credits */}
      <section className="rounded-2xl border border-carbon-line bg-carbon-raised p-5">
        <div className="flex items-center gap-2">
          <Coins className="size-4 text-brass" />
          <h2 className="text-[14px] font-medium text-dusk">Grant credits</h2>
        </div>
        <p className="mt-1 text-[12px] text-dusk-faint">
          Manually fulfill a plan when an online payment fails. Current balance:{" "}
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
            placeholder="Amount (use - to deduct)"
            className="h-9 w-44 rounded-lg border border-carbon-line bg-carbon px-3 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (e.g. manual Growth plan)"
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
          Comp extra free builds for this user.
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

      {/* Role (superadmin only) */}
      {isSuperAdmin && (
        <section className="rounded-2xl border border-carbon-line bg-carbon-raised p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brass" />
            <h2 className="text-[14px] font-medium text-dusk">Role</h2>
          </div>
          <p className="mt-1 text-[12px] text-dusk-faint">
            Grant admin access by setting the role to <code>admin</code>.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <select
              value={roleVal}
              onChange={(e) => setRoleVal(e.target.value)}
              className="h-9 rounded-lg border border-carbon-line bg-carbon px-3 text-[13px] text-dusk outline-none focus:border-carbon-line-strong"
            >
              <option value="member">member</option>
              <option value="researcher">researcher</option>
              <option value="admin">admin</option>
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
