import Link from "next/link";
import { Container } from "@/components/ui/container";
import { RenMark } from "@/components/ui/wordmark";

const columns: {
  heading: string;
  links: { label: string; href: string; muted?: boolean }[];
}[] = [
  {
    heading: "Product",
    links: [
      { label: "Ren Code", href: "/code" },
      { label: "API Console", href: "/api" },
      { label: "Documentation", href: "/docs" },
    ],
  },
  {
    heading: "Models",
    links: [
      { label: "Astra", href: "/research" },
      { label: "Research", href: "/research" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { label: "API Reference", href: "/docs/api-reference" },
      { label: "SDKs", href: "/docs" },
      { label: "Changelog", href: "/changelog" },
      { label: "Status", href: "/status" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Philosophy", href: "/philosophy" },
      { label: "Careers", href: "/careers", muted: true },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Documentation", href: "/docs" },
      { label: "Research Notes", href: "/research" },
      { label: "Updates", href: "/blog" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-deep/60">
      <Container className="pb-12 pt-20">
        {/* Brand row */}
        <div className="mb-16 grid gap-10 md:grid-cols-[2fr_1fr] md:items-end">
          <div>
            <RenMark className="size-8 text-ink" />
            <p className="mt-6 max-w-[32ch] font-serif text-title text-ink-soft">
              AI software engineering that{" "}
              <em className="text-bronze-deep">understands your code</em>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-graphite-soft">
              <span className="size-1.5 animate-pulse rounded-full bg-bronze" />
              Actively evolving
            </span>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid gap-10 sm:grid-cols-3 md:grid-cols-6">
          {columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h3 className="font-mono text-[10.5px] uppercase tracking-eyebrow text-graphite-soft">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className={
                        link.muted
                          ? "text-sm text-graphite-soft/60 transition-colors duration-300 hover:text-graphite"
                          : "text-sm text-graphite transition-colors duration-300 hover:text-ink"
                      }
                    >
                      {link.label}
                      {link.muted && (
                        <span className="ml-1.5 font-mono text-[10px] text-graphite-soft/50">
                          soon
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="rule mt-16" />

        <div className="flex flex-col gap-4 pt-8 text-[13px] text-graphite-soft sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Ren Labs. All rights reserved.</p>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.12em]">
            Evidence over hype
          </p>
        </div>
      </Container>
    </footer>
  );
}
