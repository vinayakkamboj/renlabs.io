"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import {
  saveSupabaseIntegration,
  deleteSupabaseIntegration,
  getSupabaseSchema,
  type SupabaseIntegration,
  type TableInfo,
} from "@/lib/actions/integrations";
import { cn } from "@/lib/utils";

interface Props {
  integration: SupabaseIntegration | null;
  initialTables: TableInfo[] | null;
}

export function SupabaseConnect({ integration, initialTables }: Props) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [refreshing, startRefresh] = useTransition();

  // Form state
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [showServiceKey, setShowServiceKey] = useState(false);

  // Schema state (client-managed after initial server fetch)
  const [tables, setTables] = useState<TableInfo[] | null>(initialTables);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  function connect() {
    if (!url.trim() || !anonKey.trim()) {
      toast.error("Project URL and anon key are required.");
      return;
    }
    startSave(async () => {
      const res = await saveSupabaseIntegration({
        projectUrl: url,
        anonKey,
        serviceRoleKey: serviceKey,
      });
      if (res.ok) {
        toast.success("Supabase project connected.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not connect.");
      }
    });
  }

  function disconnect() {
    startDelete(async () => {
      const res = await deleteSupabaseIntegration();
      if (res.ok) {
        setTables(null);
        toast.success("Integration removed.");
        router.refresh();
      } else {
        toast.error("Could not remove integration.");
      }
    });
  }

  function refreshSchema() {
    startRefresh(async () => {
      const res = await getSupabaseSchema();
      if (res.ok && res.tables) {
        setTables(res.tables);
        toast.success("Schema refreshed.");
      } else {
        toast.error(res.error ?? "Could not fetch schema.");
      }
    });
  }

  // ── Connected view ──────────────────────────────────────────────────────────
  if (integration) {
    const connectedDate = new Date(integration.createdAt).toLocaleDateString(
      "en-US",
      { year: "numeric", month: "short", day: "numeric" },
    );

    return (
      <div className="space-y-4">
        {/* Status card */}
        <div className="flex items-start gap-3 rounded-xl border border-signal-green/25 bg-signal-green/8 p-4">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-signal-green/15">
            <Check className="size-3.5 text-signal-green" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-dusk">Connected</p>
            <p className="mt-0.5 truncate font-mono text-[12px] text-dusk-muted">
              {integration.projectUrl}
            </p>
            <p className="mt-1 text-[11.5px] text-dusk-faint">
              Since {connectedDate} · {integration.hasServiceRoleKey ? "Service role key stored" : "Anon key only"}
            </p>
          </div>
          <a
            href={integration.projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 text-dusk-faint transition-colors hover:text-dusk"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>

        {/* Schema browser */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-dusk-faint">
              Schema · {tables ? `${tables.length} tables` : "loading…"}
            </p>
            <button
              onClick={refreshSchema}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-[12px] text-dusk-muted transition-colors hover:text-dusk disabled:opacity-40"
            >
              {refreshing ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Refresh
            </button>
          </div>

          {tables && tables.length > 0 ? (
            <ul className="max-h-72 overflow-y-auto rounded-lg border border-carbon-line">
              {tables.map((t, i) => (
                <li key={t.name} className={cn(i > 0 && "border-t border-carbon-line/60")}>
                  <button
                    onClick={() =>
                      setExpandedTable(expandedTable === t.name ? null : t.name)
                    }
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-carbon-raised"
                  >
                    <Database className="size-3.5 shrink-0 text-brass" />
                    <span className="flex-1 font-mono text-[12.5px] text-dusk">
                      {t.name}
                    </span>
                    <span className="text-[11px] text-dusk-faint">
                      {t.columns.length} col{t.columns.length !== 1 ? "s" : ""}
                    </span>
                    {expandedTable === t.name ? (
                      <ChevronDown className="size-3 text-dusk-faint" />
                    ) : (
                      <ChevronRight className="size-3 text-dusk-faint" />
                    )}
                  </button>
                  {expandedTable === t.name && (
                    <div className="border-t border-carbon-line/60 bg-carbon px-3.5 py-2">
                      <ul className="space-y-1">
                        {t.columns.map((col) => (
                          <li key={col.name} className="flex items-center gap-2">
                            <span className="font-mono text-[12px] text-dusk">
                              {col.name}
                            </span>
                            <span className="font-mono text-[11px] text-dusk-faint">
                              {col.type}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : tables && tables.length === 0 ? (
            <p className="rounded-lg border border-carbon-line px-4 py-3 text-[12.5px] text-dusk-faint">
              No public tables found. Make sure your schema is in the{" "}
              <code className="font-mono text-[11.5px]">public</code> schema.
            </p>
          ) : (
            <div className="rounded-lg border border-carbon-line px-4 py-3">
              <p className="text-[12.5px] text-dusk-faint">
                Schema not loaded yet.{" "}
                <button
                  onClick={refreshSchema}
                  className="text-brass hover:underline"
                >
                  Fetch now
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Disconnect */}
        <button
          onClick={disconnect}
          disabled={deleting}
          className="flex items-center gap-2 text-[12.5px] text-signal-red/70 transition-colors hover:text-signal-red disabled:opacity-40"
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Unplug className="size-3.5" />
          )}
          Disconnect
        </button>
      </div>
    );
  }

  // ── Connect form ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-dusk-muted">
        Connect your Supabase project so Ren agents can understand your database
        schema, generate typed queries, and write migrations.
      </p>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
            Project URL
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxxxxxxxxxx.supabase.co"
            className="h-9 w-full rounded-lg border border-carbon-line bg-carbon px-3 font-mono text-[12.5px] text-dusk outline-none placeholder:text-dusk-faint/60 focus:border-carbon-line-strong"
          />
        </div>

        <div>
          <label className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
            Anon / public key
          </label>
          <input
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
            className="h-9 w-full rounded-lg border border-carbon-line bg-carbon px-3 font-mono text-[12.5px] text-dusk outline-none placeholder:text-dusk-faint/60 focus:border-carbon-line-strong"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
              Service role key
            </label>
            <span className="text-[11px] text-dusk-faint">
              Required for schema introspection
            </span>
          </div>
          <div className="relative">
            <input
              type={showServiceKey ? "text" : "password"}
              value={serviceKey}
              onChange={(e) => setServiceKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
              className="h-9 w-full rounded-lg border border-carbon-line bg-carbon px-3 pr-16 font-mono text-[12.5px] text-dusk outline-none placeholder:text-dusk-faint/60 focus:border-carbon-line-strong"
            />
            <button
              type="button"
              onClick={() => setShowServiceKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-dusk-faint transition-colors hover:text-dusk"
            >
              {showServiceKey ? "hide" : "show"}
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-dusk-faint">
            Never exposed to the browser. Stored encrypted server-side and only used for schema reads.
          </p>
        </div>
      </div>

      <button
        onClick={connect}
        disabled={saving || !url.trim() || !anonKey.trim()}
        className="flex h-9 items-center gap-2 rounded-lg bg-brass px-4 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="hidden" />}
        {saving ? "Connecting…" : "Connect project"}
      </button>
    </div>
  );
}
