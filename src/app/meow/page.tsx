import type { Metadata } from "next";
import { FunScene } from "@/components/site/fun-scene";

export const metadata: Metadata = {
  title: "meow",
  robots: { index: false, follow: false },
};

export default function MeowPage() {
  return (
    <FunScene
      sticker="cat"
      tilt={-6}
      eyebrow="Mascot detected"
      title="meow."
      body="This is the official Ren Labs cat. It does not pay rent, it does not write tests, but morale is up 40% since it arrived. Pet it (with your eyes)."
      cta="goodbye, friend"
    />
  );
}
