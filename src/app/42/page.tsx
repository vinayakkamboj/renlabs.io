import type { Metadata } from "next";
import { FunScene } from "@/components/site/fun-scene";

export const metadata: Metadata = {
  title: "42",
  robots: { index: false, follow: false },
};

export default function AnswerPage() {
  return (
    <FunScene
      sticker="robot"
      tilt={6}
      eyebrow="The Answer"
      title="Life, the universe, and everything."
      body="You've reached the Answer. The Question, unfortunately, is still compiling. Give it seven and a half million years."
      cta="Don't panic — go home"
    />
  );
}
