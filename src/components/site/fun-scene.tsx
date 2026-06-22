import { Button } from "@/components/ui/button";
import { Sticker, type StickerVariant } from "@/components/ui/sticker";

/** Shared layout for the hidden, playful routes. */
export function FunScene({
  sticker,
  tilt = -7,
  eyebrow,
  title,
  body,
  cta = "Take me home",
}: {
  sticker: StickerVariant;
  tilt?: number;
  eyebrow: string;
  title: string;
  body: string;
  cta?: string;
}) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-paper px-6 py-20 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(27 26 23 / 0.06) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 60% 55% at 50% 42%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 55% at 50% 42%, black, transparent)",
        }}
      />
      <div className="relative">
        <Sticker variant={sticker} tilt={tilt} className="mb-12" />
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-graphite-soft">
          {eyebrow}
        </p>
        <h1 className="mx-auto mt-4 max-w-[24ch] font-serif text-display font-normal tracking-tight text-ink text-balance">
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-[46ch] text-lede text-graphite text-pretty">
          {body}
        </p>
        <div className="mt-9">
          <Button href="/" size="lg">
            {cta}
          </Button>
        </div>
      </div>
    </main>
  );
}
