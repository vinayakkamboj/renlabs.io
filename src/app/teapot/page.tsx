import type { Metadata } from "next";
import { FunScene } from "@/components/site/fun-scene";

export const metadata: Metadata = {
  title: "I'm a teapot",
  robots: { index: false, follow: false },
};

export default function TeapotPage() {
  return (
    <FunScene
      sticker="mug"
      tilt={-8}
      eyebrow="HTTP 418"
      title="I'm a teapot."
      body="Short and stout. We tried to brew you a response, but this server is, regrettably, a teapot. No coffee here — only standards-compliant whimsy."
      cta="Pour me back home"
    />
  );
}
