/**
 * Instant skeleton for dashboard routes. Renders inside the platform shell
 * (nav stays put) while the server resolves projects, credits, and counts.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Credit / header strip */}
      <div className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-carbon-line bg-carbon-raised p-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-carbon-high" />
          <div className="space-y-2">
            <div className="h-3 w-28 rounded bg-carbon-high" />
            <div className="h-2.5 w-40 rounded bg-carbon-high" />
          </div>
        </div>
        <div className="h-7 w-24 rounded-lg bg-carbon-high" />
      </div>

      {/* Title */}
      <div className="mb-5 h-6 w-40 rounded bg-carbon-raised" />

      {/* Project card grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl border border-carbon-line bg-carbon-raised"
          />
        ))}
      </div>
    </div>
  );
}
