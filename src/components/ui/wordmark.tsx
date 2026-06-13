import { cn } from "@/lib/utils";

/**
 * The Ren mark: an open circle — a reasoning loop, deliberately
 * left incomplete. Drawn, not generated.
 */
export function RenMark({ className }: { className?: string }) {
  /*
   * Geometry: center (16,16), radius 11.5, gap of 30° symmetric around
   * 3 o'clock (±15°). Dot sits exactly at the upper arc terminal with
   * radius = strokeWidth/2 — a flush, optical cap, not a floating blob.
   *
   * Lower start  : (27.11, 18.98) = 15° below 3 o'clock
   * Upper end/dot: (27.11, 13.02) = 15° above 3 o'clock
   */
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("size-6", className)}
    >
      <path
        d="M27.11 18.98A11.5 11.5 0 1 0 27.11 13.02"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="27.11" cy="13.02" r="1.2" fill="currentColor" />
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
        Ren
      </span>
    </span>
  );
}
