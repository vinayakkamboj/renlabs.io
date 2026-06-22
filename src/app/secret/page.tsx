import type { Metadata } from "next";
import { FunScene } from "@/components/site/fun-scene";

export const metadata: Metadata = {
  title: "shhh",
  robots: { index: false, follow: false },
};

export default function SecretPage() {
  return (
    <FunScene
      sticker="shhh"
      tone="bronze"
      tilt={-5}
      eyebrow="Classified"
      title="You found the secret page."
      body="There's nothing here. Officially, you were never here either. Act natural, walk away slowly, and tell no one."
      cta="I saw nothing"
    />
  );
}
