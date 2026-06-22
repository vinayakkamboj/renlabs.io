import type { Metadata } from "next";
import { FunScene } from "@/components/site/fun-scene";

export const metadata: Metadata = {
  title: "lmfao",
  robots: { index: false, follow: false },
};

export default function LmfaoPage() {
  return (
    <FunScene
      sticker="cat"
      tilt={-9}
      eyebrow="Certified moment"
      title="lmfao."
      body="You actually typed that into the URL bar. Honestly? Iconic. The cat respects the commitment. Nothing else to see here — go be great."
      cta="ok ok, home"
    />
  );
}
