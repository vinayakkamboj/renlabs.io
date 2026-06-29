"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";

const ease = [0.25, 1, 0.5, 1] as const;

const pillars = [
  {
    label: "Workspaces & projects",
    detail: "Organize everything you're building. Each project keeps its own goals, memory, and context.",
  },
  {
    label: "AI agent teams",
    detail: "Assign specialized agents — research, development, QA, marketing — each with a role, goal, and budget.",
  },
  {
    label: "Reports & oversight",
    detail: "Agents execute continuously and report progress, so you manage outcomes instead of prompts.",
  },
];

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
            Ren Labs · AI workspace platform
          </p>
        </motion.div>

        <motion.h1
          {...enter(0.08)}
          className="mt-8 max-w-[18ch] font-serif text-display-xl font-normal text-ink text-balance"
        >
          Create projects. Deploy AI teams.
        </motion.h1>

        <motion.p
          {...enter(0.16)}
          className="mt-6 max-w-[52ch] text-lede text-graphite text-pretty"
        >
          Ren Labs is the AI workspace where you spin up projects and assign
          autonomous agents to build, test, and ship them. Research, development,
          and QA agents work in parallel on the goals you set — and report back.
        </motion.p>

        <motion.div {...enter(0.26)} className="mt-12 flex flex-wrap items-center gap-4">
          <Button href="/dashboard" size="lg">
            Start building
          </Button>
          <Button href="/docs" variant="outline" size="lg">
            Documentation
            <ArrowUpRight className="size-4 text-graphite transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Button>
        </motion.div>

        <motion.div {...enter(0.42)} className="mt-24 md:mt-32">
          <div className="rule" />
          <div className="grid gap-x-8 gap-y-8 pt-8 sm:grid-cols-3">
            {pillars.map((p) => (
              <div key={p.label}>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-graphite-soft">
                  {p.label}
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-graphite text-pretty">
                  {p.detail}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
