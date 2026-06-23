import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-[1.7rem] font-normal tracking-tight text-dusk">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-[64ch] text-[13.5px] leading-relaxed text-dusk-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  meta,
  className,
  children,
  padded = true,
}: {
  title?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised",
        className,
      )}
    >
      {title ? (
        <header className="flex items-center justify-between gap-4 border-b border-carbon-line px-5 py-3.5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-dusk-muted">
            {title}
          </h2>
          {meta}
        </header>
      ) : null}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}

const statusTones: Record<string, string> = {
  // projects
  active: "bg-signal-green/15 text-signal-green",
  building: "bg-signal-amber/15 text-signal-amber",
  draft: "bg-carbon-high text-dusk-muted",
  archived: "bg-carbon-high text-dusk-faint",
  // repositories
  indexed: "bg-signal-green/15 text-signal-green",
  indexing: "bg-signal-amber/15 text-signal-amber",
  queued: "bg-carbon-high text-dusk-muted",
  error: "bg-signal-red/15 text-signal-red",
  // pull requests
  open: "bg-signal-green/15 text-signal-green",
  merged: "bg-brass/15 text-brass",
  closed: "bg-signal-red/15 text-signal-red",
  // integrations
  connected: "bg-signal-green/15 text-signal-green",
  disconnected: "bg-carbon-high text-dusk-faint",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em]",
        statusTones[status] ?? "bg-carbon-high text-dusk-muted",
      )}
    >
      {status}
    </span>
  );
}

export function DataTable({
  headers,
  rows,
  align,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  align?: ("l" | "r")[];
}) {
  return (
    <div className="platform-scroll overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={h}
                className={cn(
                  "border-b border-carbon-line px-5 py-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-dusk-faint",
                  align?.[i] === "r" && "text-right",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="group border-b border-carbon-line/60 transition-colors duration-150 last:border-b-0 hover:bg-carbon-high/40"
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    "px-5 py-3.5 text-[13px] text-dusk",
                    align?.[ci] === "r" && "text-right",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * First-class empty state. A new account genuinely has no projects, repos, or
 * PRs — so we make that honest and inviting rather than faking metrics.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-carbon-line-strong bg-carbon-raised/50 px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-carbon-line bg-carbon-raised">
        <Icon className="size-5 text-brass" />
      </div>
      <h3 className="mt-6 font-serif text-[1.3rem] text-dusk">{title}</h3>
      <p className="mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-dusk-muted">
        {description}
      </p>
      {action ? (
        <Link
          href={action.href}
          className="mt-7 flex h-10 items-center rounded-lg bg-brass px-5 text-[13px] font-medium text-carbon transition-colors duration-200 hover:bg-brass-deep"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/** Compact metric tile for honest, real counts (e.g. "3 projects"). */
export function CountTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-carbon-line bg-carbon-raised p-5">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dusk-faint">
        {label}
      </p>
      <p className="tnum mt-2.5 font-serif text-[1.9rem] leading-none tracking-tight text-dusk">
        {value}
      </p>
      {hint ? <p className="mt-2.5 text-[12px] text-dusk-muted">{hint}</p> : null}
    </div>
  );
}
