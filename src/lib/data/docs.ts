/**
 * Documentation navigation. A single ordered list drives the sidebar, the
 * previous/next pager, and breadcrumbs — so the IA stays consistent.
 */

export type DocLink = { title: string; href: string; summary: string };
export type DocGroup = { group: string; items: DocLink[] };

export const docsNav: DocGroup[] = [
  {
    group: "Get started",
    items: [
      {
        title: "Getting Started",
        href: "/docs",
        summary: "What Ren Code is, and how to go from a repository to a reviewable pull request.",
      },
      {
        title: "Authentication",
        href: "/docs/authentication",
        summary: "Sign in with email or Google, and how sessions and protected workspaces work.",
      },
    ],
  },
  {
    group: "Workflows",
    items: [
      {
        title: "GitHub Integration",
        href: "/docs/github-integration",
        summary: "Connect repositories through GitHub, with explicit, revocable, per-repo access.",
      },
      {
        title: "Repository Analysis",
        href: "/docs/repository-analysis",
        summary: "How Astra reads a codebase — architecture, dependencies, and conventions.",
      },
      {
        title: "Pull Requests",
        href: "/docs/pull-requests",
        summary: "Describe a change, review a real pull request, and stay in control of what merges.",
      },
    ],
  },
  {
    group: "Develop",
    items: [
      {
        title: "API Reference",
        href: "/docs/api-reference",
        summary: "The shape of the Ren API for driving Astra programmatically.",
      },
      {
        title: "Best Practices",
        href: "/docs/best-practices",
        summary: "How to get the most reliable results from Ren Code on real codebases.",
      },
    ],
  },
];

/** Flattened, in reading order — used for the prev/next pager. */
export const docsFlat: DocLink[] = docsNav.flatMap((g) => g.items);

export function docNeighbors(href: string): { prev?: DocLink; next?: DocLink } {
  const i = docsFlat.findIndex((d) => d.href === href);
  if (i === -1) return {};
  return { prev: docsFlat[i - 1], next: docsFlat[i + 1] };
}
