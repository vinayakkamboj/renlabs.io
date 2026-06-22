import type { Metadata } from "next";
import { FunScene } from "@/components/site/fun-scene";

export const metadata: Metadata = {
  title: "brb",
  robots: { index: false, follow: false },
};

export default function BrbPage() {
  return (
    <FunScene
      sticker="mug"
      tilt={5}
      eyebrow="Status: away"
      title="Back in a bit."
      body="Stepped out for coffee. The servers are humming, the cat is napping, and Astra is allegedly 'just refactoring one thing.' Sure."
      cta="I'll be at home"
    />
  );
}
