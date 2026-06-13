import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { docNeighbors } from "@/lib/data/docs";
import { cn } from "@/lib/utils";

/** The header block at the top of every doc page. */
export function DocHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <header className="border-b border-line pb-10">
      <p className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze">
        {eyebrow}
      </p>
      <h1 className="mt-4 font-serif text-display font-normal text-ink text-balance">
        {title}
      </h1>
      <p className="mt-5 max-w-[60ch] text-lede text-graphite text-pretty">
        {intro}
      </p>
    </header>
  );
}

export function DocH2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-14 scroll-mt-28 font-serif text-headline font-normal text-ink first:mt-10"
    >
      {children}
    </h2>
  );
}

export function DocH3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-9 font-serif text-title text-ink">{children}</h3>;
}

export function DocP({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 max-w-[68ch] text-[15.5px] leading-[1.75] text-ink-soft text-pretty">
      {children}
    </p>
  );
}

export function DocList({
  items,
  ordered = false,
}: {
  items: React.ReactNode[];
  ordered?: boolean;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <List
      className={cn(
        "mt-5 max-w-[68ch] space-y-2.5 text-[15.5px] leading-[1.7] text-ink-soft",
        ordered ? "list-decimal pl-5" : "pl-1",
      )}
    >
      {items.map((item, i) => (
        <li key={i} className={cn(!ordered && "flex gap-3")}>
          {!ordered && <span className="mt-2.5 size-1 shrink-0 rounded-full bg-bronze" />}
          <span>{item}</span>
        </li>
      ))}
    </List>
  );
}

export function DocCode({
  title,
  language = "bash",
  children,
}: {
  title?: string;
  language?: string;
  children: string;
}) {
  return (
    <figure className="mt-6 overflow-hidden rounded-2xl border border-carbon-line bg-carbon shadow-lift">
      <figcaption className="flex items-center justify-between border-b border-carbon-line px-4 py-2.5">
        <span className="font-mono text-[11px] text-dusk-muted">{title ?? language}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-dusk-faint">
          {language}
        </span>
      </figcaption>
      <pre className="platform-scroll overflow-x-auto px-4 py-4">
        <code className="font-mono text-[12.5px] leading-relaxed text-dusk">{children}</code>
      </pre>
    </figure>
  );
}

export function DocCallout({
  label = "Note",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="mt-6 max-w-[68ch] rounded-2xl border border-line bg-paper-deep/60 p-5">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-bronze-deep">
        {label}
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-graphite text-pretty">{children}</p>
    </aside>
  );
}

/** Previous / next navigation, derived from the docs reading order. */
export function DocPager({ href }: { href: string }) {
  const { prev, next } = docNeighbors(href);
  if (!prev && !next) return null;
  return (
    <nav className="mt-16 grid gap-4 border-t border-line pt-10 sm:grid-cols-2">
      {prev ? (
        <Link
          href={prev.href}
          className="group rounded-2xl border border-line p-5 transition-colors hover:border-stone hover:bg-paper-deep"
        >
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft">
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            Previous
          </span>
          <span className="mt-2 block font-serif text-title text-ink">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group rounded-2xl border border-line p-5 text-right transition-colors hover:border-stone hover:bg-paper-deep"
        >
          <span className="flex items-center justify-end gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft">
            Next
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="mt-2 block font-serif text-title text-ink">{next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
