export function AdminConfigNotice() {
  return (
    <div className="rounded-2xl border border-signal-amber/30 bg-signal-amber/[0.06] p-5">
      <p className="text-[13.5px] font-medium text-dusk">
        Service role key not configured
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-dusk-muted">
        Set{" "}
        <code className="rounded bg-carbon px-1.5 py-0.5 font-mono text-[12px] text-brass">
          SUPABASE_SERVICE_ROLE_KEY
        </code>{" "}
        on the server to enable platform-wide data.
      </p>
    </div>
  );
}
