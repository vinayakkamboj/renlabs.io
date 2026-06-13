import Link from "next/link";
import { Container } from "@/components/ui/container";
import { RenMark } from "@/components/ui/wordmark";

const columns: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Ren Code", href: "/code" },
      { label: "New project", href: "/code#new-project" },
      { label: "Existing repository", href: "/code#repository" },
      { label: "Start building", href: "/dashboard" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Ren API", href: "/api" },
      { label: "API reference", href: "/docs/api-reference" },
      { label: "GitHub integration", href: "/docs/github-integration" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Research · Astra", href: "/research" },
      { label: "Philosophy", href: "/philosophy" },
      { label: "Sign in", href: "/login" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-deep/60">
      <Container className="pb-12 pt-20">
        <div className="grid gap-14 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div>
            <RenMark className="size-8 text-ink" />
            <p className="mt-6 max-w-[30ch] font-serif text-title text-ink-soft">
              AI software engineering that{" "}
              <em className="text-bronze-deep">understands your code</em>.
            </p>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-graphite-soft">
              In active development
            </p>
          </div>
          {columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h3 className="font-mono text-[11px] uppercase tracking-eyebrow text-graphite-soft">
                {col.heading}
              </h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-graphite transition-colors duration-300 hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="rule mt-20" />

        <div className="flex flex-col gap-4 pt-8 text-[13px] text-graphite-soft sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Ren AI. Building in the open.</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em]">
            Evidence over hype
          </p>
        </div>
      </Container>
    </footer>
  );
}
