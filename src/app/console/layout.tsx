import type { Metadata } from "next";
import { ConsoleShell } from "@/components/platform/console-shell";

export const metadata: Metadata = {
  title: {
    default: "API Console",
    template: "%s — Ren Labs API",
  },
  description: "Manage your Ren API keys and usage.",
  robots: { index: false, follow: false },
};

export default function ConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
