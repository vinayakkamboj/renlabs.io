import { cn } from "@/lib/utils";

type Tone = "bronze" | "ink" | "paper";

const TONES: Record<Tone, { bg: string; text: string; ring: string }> = {
  bronze: { bg: "bg-bronze", text: "text-paper", ring: "border-paper/40" },
  ink: { bg: "bg-ink", text: "text-paper", ring: "border-paper/30" },
  paper: { bg: "bg-paper-raised", text: "text-ink", ring: "border-ink/15" },
};

/**
 * A peel-and-stick sticker badge — thick paper edge, soft drop shadow, and a
 * playful tilt. Used on the 404 and the hidden fun routes.
 */
export function Sticker({
  label,
  tone = "bronze",
  tilt = -7,
  className,
}: {
  label: string;
  tone?: Tone;
  tilt?: number;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      className={cn("inline-grid place-items-center", className)}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div
        className={cn(
          "grid size-44 place-items-center rounded-full border-[6px] border-paper",
          t.bg,
        )}
        style={{
          boxShadow:
            "0 1px 2px rgb(27 26 23 / 0.10), 0 18px 40px rgb(27 26 23 / 0.22)",
        }}
      >
        <div
          className={cn(
            "grid size-[86%] place-items-center rounded-full border border-dashed",
            t.ring,
          )}
        >
          <span
            className={cn(
              "select-none px-2 text-center font-serif text-[2.3rem] italic leading-none tracking-tight",
              t.text,
            )}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
