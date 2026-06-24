"use client";

/**
 * Per-project Supabase connect modal — opens right inside the workspace so a
 * backend can be attached to THIS project (and only this project) without
 * leaving the build surface. Backed by the same per-project server actions used
 * on the project page, so credentials are scoped to this project and encrypted
 * at rest. The service-role key never reaches the browser after saving.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Database, ExternalLink, Loader2, Unplug, X } from "lucide-react";
import { toast } from "sonner";
import {
  saveSupabaseIntegration,
  deleteSupabaseIntegration,
} from "@/lib/actions/integrations";

interface Props {
  projectId: string;
  connected: boolean;
  projectUrl: string | null;
  onClose: () => void;
}

export function SupabaseConnectModal({ projectId, connected, projectUrl, onClose }: Props) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [showServiceKey, setShowServiceKey] = useState(false);

  function connect() {
    if (!url.trim() || !anonKey.trim()) {
      toast.error("Project URL and anon key are required.");
      return;
    }
    startSave(async () => {
      const res = await saveSupabaseIntegration({
        projectId,
        projectUrl: url,
        anonKey,
        serviceRoleKey: serviceKey,
      });
      if (res.ok) {
        toast.success("Supabase connected to this project.");
        router.refresh();
        onClose();
      } else {
        toast.error(res.error ?? "Could not connect.");
      }
    });
  }

  function disconnect() {
    startDelete(async () => {
      const res = await deleteSupabaseIntegration(projectId);
      if (res.ok) {
        toast.success("Disconnected.");
        router.refresh();
        onClose();
      } else {
        toast.error("Could not disconnect.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-carbon/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-carbon-line bg-carbon-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-carbon-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-signal-green/12">
              <Database className="size-4 text-signal-green" />
            </span>
            <div>
              <h2 className="text-[14px] font-medium text-dusk">Project backend</h2>
              <p className="text-[11.5px] text-dusk-faint">
                Connect a Supabase project to this workspace only
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-dusk-faint transition-colors hover:bg-carbon-high hover:text-dusk"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        {connected ? (
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3 rounded-xl border border-signal-green/25 bg-signal-green/8 p-4">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-signal-green/15">
                <Check className="size-3.5 text-signal-green" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-dusk">Connected</p>
                <p className="mt-0.5 truncate font-mono text-[12px] text-dusk-muted">
                  {projectUrl}
                </p>
                <p className="mt-1 text-[11.5px] text-dusk-faint">
                  Scoped to this project. Agents and generated code use this backend.
                </p>
              </div>
              {projectUrl && (
                <a
                  href={projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 text-dusk-faint transition-colors hover:text-dusk"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
            <button
              onClick={disconnect}
              disabled={deleting}
              className="flex items-center gap-2 text-[12.5px] text-signal-red/70 transition-colors hover:text-signal-red disabled:opacity-40"
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Unplug className="size-3.5" />}
              Disconnect from this project
            </button>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <p className="text-[12.5px] leading-relaxed text-dusk-muted">
              Find these in your Supabase dashboard under{" "}
              <span className="text-dusk">Settings → API</span>. They&apos;re stored
              encrypted and attached to this project only — not your other projects.
            </p>

            <Field label="Project URL">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xxxxxxxxxxxx.supabase.co"
                className="h-9 w-full rounded-lg border border-carbon-line bg-carbon px-3 font-mono text-[12.5px] text-dusk outline-none placeholder:text-dusk-faint/60 focus:border-carbon-line-strong"
              />
            </Field>

            <Field label="Anon / public key">
              <input
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                className="h-9 w-full rounded-lg border border-carbon-line bg-carbon px-3 font-mono text-[12.5px] text-dusk outline-none placeholder:text-dusk-faint/60 focus:border-carbon-line-strong"
              />
            </Field>

            <Field label="Service role key" hint="For schema reads — never sent to the browser">
              <div className="relative">
                <input
                  type={showServiceKey ? "text" : "password"}
                  value={serviceKey}
                  onChange={(e) => setServiceKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                  className="h-9 w-full rounded-lg border border-carbon-line bg-carbon px-3 pr-14 font-mono text-[12.5px] text-dusk outline-none placeholder:text-dusk-faint/60 focus:border-carbon-line-strong"
                />
                <button
                  type="button"
                  onClick={() => setShowServiceKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-dusk-faint transition-colors hover:text-dusk"
                >
                  {showServiceKey ? "hide" : "show"}
                </button>
              </div>
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="h-9 rounded-lg px-3.5 text-[12.5px] text-dusk-muted transition-colors hover:text-dusk"
              >
                Cancel
              </button>
              <button
                onClick={connect}
                disabled={saving || !url.trim() || !anonKey.trim()}
                className="flex h-9 items-center gap-2 rounded-lg bg-brass px-4 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
              >
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                {saving ? "Connecting…" : "Connect"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
          {label}
        </label>
        {hint && <span className="text-[11px] text-dusk-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
