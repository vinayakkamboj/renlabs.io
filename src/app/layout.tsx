import type { Metadata } from "next";
import { Inter, Newsreader, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ren AI — Building Intelligence Through Reasoning",
    template: "%s — Ren AI",
  },
  description:
    "Ren AI develops advanced reasoning systems, coding models, and autonomous agents designed to expand human capability.",
  metadataBase: new URL("https://ren.ai"),
  openGraph: {
    title: "Ren AI",
    description:
      "Advanced reasoning systems, coding models, and autonomous agents — measured, calibrated, and published.",
    siteName: "Ren AI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} ${jetbrains.variable}`}>
      <body className="bg-paper font-sans text-ink antialiased">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1d1c19",
              border: "1px solid #2b2925",
              color: "#e9e4d8",
            },
          }}
        />
      </body>
    </html>
  );
}
