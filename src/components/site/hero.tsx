"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";

const ease = [0.25, 1, 0.5, 1] as const;

export function Hero() {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 28 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, delay, ease },
        };

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[24rem] -top-[20rem] hidden lg:block"
      >
        <svg width="900" height="900" viewBox="0 0 32 32" fill="none">
          <path
            d="M27.5 12.4A12 12 0 1 0 28 16"
            stroke="var(--color-line)"
            strokeWidth="0.22"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <Container className="relative pb-24 pt-40 md:pb-32 md:pt-52">
        <motion.div {...enter(0)} className="flex items-center gap-2.5">
          <span className="flex size-1.5 items-center justify-center">
            <span className="size-1.5 animate-pulse rounded-full bg-bronze" />
          </span>
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze">
            Ren AI · Software engineering intelligence
          </p>
        </motion.div>

        <motion.h1
          {...enter(0.08)}
          className="mt-8 font-serif text-display-xl font-normal text-ink"
        >
          Ren Code
        </motion.h1>

        <motion.p
          {...enter(0.14)}
          className="mt-6 max-w-[30ch] font-serif text-headline font-normal text-ink-soft text-balance"
        >
          AI software engineering that{" "}
          <em className="text-bronze-deep">understands your codebase</em>.
        </motion.p>

        <motion.p
          {...enter(0.22)}
          className="mt-8 max-w-[58ch] text-lede text-graphite text-pretty"
        >
          Powered by Astra, Ren AI&apos;s flagship language model — built to
          understand repositories, reason about architecture, and execute
          complex development tasks.
        </motion.p>

        <motion.div {...enter(0.32)} className="mt-12 flex flex-wrap items-center gap-4">
          <Button href="/dashboard" size="lg">
            Start building
          </Button>
          <Button href="/docs" variant="outline" size="lg">
            Documentation
            <ArrowUpRight className="size-4 text-graphite transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Button>
        </motion.div>

        <motion.div {...enter(0.46)} className="mt-24 md:mt-32">
          <div className="rule" />
          <div className="grid gap-x-8 gap-y-8 pt-8 sm:grid-cols-2">
            <Link href="/code#new-project" className="group block">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-graphite-soft">
                Workflow 01
              </p>
              <p className="mt-3 font-serif text-title text-ink transition-colors duration-300 group-hover:text-bronze-deep">
                Start a new project from a prompt
              </p>
              <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-graphite">
                Describe what you want to build — a SaaS, a CRM, an internal
                tool — and watch it take shape.
              </p>
            </Link>
            <Link href="/code#repository" className="group block sm:border-l sm:border-line sm:pl-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-graphite-soft">
                Workflow 02
              </p>
              <p className="mt-3 font-serif text-title text-ink transition-colors duration-300 group-hover:text-bronze-deep">
                Continue an existing repository
              </p>
              <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-graphite">
                Connect GitHub and let Ren Code understand the codebase before
                it changes a line.
              </p>
            </Link>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
