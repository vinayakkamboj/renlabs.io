import { cn } from "@/lib/utils";

/**
 * The Ren mark: an open circle — a reasoning loop, deliberately
 * left incomplete. Drawn, not generated.
 */
export function RenMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("size-6", className)}
    >
      <path
        d="M27.5 12.4A12 12 0 1 0 28 16"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="28" cy="9.4" r="1.9" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <RenMark className={markClassName} />
      <span className="font-serif text-[1.35rem] font-medium tracking-tight">
        Ren Labs
      </span>
    </span>
  );
}
