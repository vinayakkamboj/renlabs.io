/**
 * Instant skeleton for the workspace route. Next.js shows this the moment the
 * user navigates, while the server component resolves the project, saved files,
 * and (for imported repos) the GitHub file tree. Without it the browser would
 * sit on the previous screen until all of that finished.
 */
export default function WorkspaceLoading() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-carbon text-dusk">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-carbon-line px-4">
        <div className="flex items-center gap-3">
          <div className="size-4 rounded bg-carbon-raised" />
          <div className="h-3 w-32 rounded bg-carbon-raised" />
        </div>
        <div className="h-7 w-40 rounded-lg bg-carbon-raised" />
        <div className="flex items-center gap-2">
          <div className="h-6 w-16 rounded-lg bg-carbon-raised" />
          <div className="h-6 w-16 rounded-lg bg-carbon-raised" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Chat column */}
        <div className="flex w-[30%] shrink-0 flex-col gap-3 border-r border-carbon-line p-4">
          <div className="h-3 w-20 rounded bg-carbon-raised" />
          <div className="mt-auto h-24 rounded-xl bg-carbon-raised" />
        </div>

        {/* Center — preview placeholder */}
        <div className="flex flex-1 items-center justify-center bg-carbon">
          <div className="flex items-center gap-2.5 text-[13px] text-dusk-faint">
            <span className="size-4 animate-spin rounded-full border-2 border-brass border-t-transparent" />
            Loading workspace…
          </div>
        </div>
      </div>
    </div>
  );
}
