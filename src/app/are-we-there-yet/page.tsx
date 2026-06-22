import type { Metadata } from "next";
import { FunScene } from "@/components/site/fun-scene";

export const metadata: Metadata = {
  title: "Are we there yet?",
  robots: { index: false, follow: false },
};

export default function AreWeThereYetPage() {
  return (
    <FunScene
      sticker="rocket"
      tilt={4}
      eyebrow="Status check"
      title="No. Not yet. Soon."
      body="Astra is still thinking about it. Have you tried asking again in a slightly more hopeful tone? Works ~12% of the time."
      cta="Fine, I'll wait at home"
    />
  );
}
