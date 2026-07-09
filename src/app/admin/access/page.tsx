import type { Metadata } from "next";
import { UserCheck } from "lucide-react";
import { listAccessRequests } from "@/lib/actions/access";
import { AccessRequestActions } from "@/components/platform/admin-access-actions";

export const metadata: Metadata = { title: "Access" };
export const dynamic = "force-dynamic";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const STATUS_TONE: Record<string, string> = {
  pending: "bg-signal-amber/15 text-signal-amber",
  approved: "bg-signal-green/15 text-signal-green",
  denied: "bg-signal-red/15 text-signal-red",
};

/**
 * Trial access requests — the beta gatekeeping console. Approving a request
 * grants product access instantly (the middleware + APIs read the same row).
 */
export default async function AdminAccessPage() {
  const requests = await listAccessRequests();
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[1.5rem] leading-tight text-dusk">Access requests</h1>
        <p className="mt-1 text-[13px] text-dusk-muted">
          Private-beta trial requests. Approving grants full product access
          immediately; denying keeps the account on /restricted.
        </p>
      </div>

      {/* Pending */}
      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-dusk-faint">
          Pending · {pending.length}
        </h2>
        {pending.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-carbon-line bg-carbon-raised p-5">
            <UserCheck className="size-5 text-dusk-faint" />
            <p className="text-[13px] text-dusk-muted">
              No pending requests — everyone&apos;s been reviewed.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-carbon-line bg-carbon-raised p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-dusk">{r.email}</p>
                  {r.note && (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-dusk-muted">
                      &ldquo;{r.note}&rdquo;
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[10.5px] text-dusk-faint">
                    requested {relativeTime(r.createdAt)}
                  </p>
                </div>
                <AccessRequestActions requestId={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Decided */}
      {decided.length > 0 && (
        <section>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-dusk-faint">
            Decided · {decided.length}
          </h2>
          <ul className="space-y-2">
            {decided.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-carbon-line bg-carbon p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-dusk">{r.email}</p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-dusk-faint">
                    {r.decidedBy ? `by ${r.decidedBy}` : ""}
                    {r.decidedAt ? ` · ${relativeTime(r.decidedAt)}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${STATUS_TONE[r.status]}`}
                >
                  {r.status}
                </span>
                <AccessRequestActions requestId={r.id} decided={r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
