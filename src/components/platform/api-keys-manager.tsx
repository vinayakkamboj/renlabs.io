"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createApiKey,
  revokeApiKey,
  deleteApiKey,
  type ApiKeyRow,
} from "@/lib/actions/api-keys";
import { cn } from "@/lib/utils";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ApiKeysManager({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const res = await createApiKey(name.trim() || "Default key");
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setKeys((prev) => [res.row, ...prev]);
      setRevealed({ name: res.row.name, key: res.key });
      setName("");
      setCreating(false);
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await revokeApiKey(id);
      if (!res.ok) {
        toast.error("Couldn't revoke the key.");
        return;
      }
      setKeys((prev) =>
        prev.map((k) =>
          k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k,
        ),
      );
      toast.success("Key revoked");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteApiKey(id);
      if (!res.ok) {
        toast.error("Couldn't delete the key.");
        return;
      }
      setKeys((prev) => prev.filter((k) => k.id !== id));
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-medium text-dusk">Your keys</h2>
          <p className="mt-0.5 text-[12px] text-dusk-faint">
            Use a key as a bearer token. We only store a hash — copy it when it&apos;s
            created.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brass px-3.5 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep"
          >
            <Plus className="size-3.5" />
            Create key
          </button>
        )}
      </div>

      {/* Create row */}
      {creating && (
        <div className="flex items-center gap-2 rounded-xl border border-carbon-line bg-carbon-raised p-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Key name — e.g. Production server"
            className="h-9 flex-1 rounded-lg border border-carbon-line bg-carbon px-3 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
          />
          <button
            onClick={create}
            disabled={pending}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-brass px-3.5 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Generate"}
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setName("");
            }}
            className="flex size-9 items-center justify-center rounded-lg text-dusk-faint transition-colors hover:bg-carbon-high hover:text-dusk"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Reveal-once banner */}
      {revealed && (
        <RevealedKey
          name={revealed.name}
          value={revealed.key}
          onClose={() => setRevealed(null)}
        />
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-carbon-line py-12 text-center">
          <KeyRound className="size-6 text-dusk-faint/40" />
          <p className="mt-3 text-[13px] text-dusk-muted">No API keys yet.</p>
          <p className="mt-1 text-[12px] text-dusk-faint">
            Create one to start calling the Ren API.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-carbon-line">
          <ul className="divide-y divide-carbon-line">
            {keys.map((k) => {
              const revoked = !!k.revokedAt;
              return (
                <li
                  key={k.id}
                  className="flex items-center gap-3 bg-carbon-raised px-4 py-3"
                >
                  <KeyRound
                    className={cn(
                      "size-4 shrink-0",
                      revoked ? "text-dusk-faint/40" : "text-brass",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-[13px] font-medium",
                          revoked ? "text-dusk-faint line-through" : "text-dusk",
                        )}
                      >
                        {k.name}
                      </span>
                      {revoked && (
                        <span className="rounded-full bg-carbon-high px-2 py-0.5 text-[10.5px] text-dusk-faint">
                          Revoked
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[11.5px] text-dusk-faint">
                      {k.keyPrefix}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-[11.5px] text-dusk-muted">
                      Created {fmtDate(k.createdAt)}
                    </p>
                    <p className="text-[11px] text-dusk-faint">
                      Last used {fmtDate(k.lastUsedAt)}
                    </p>
                  </div>
                  {revoked ? (
                    <button
                      onClick={() => remove(k.id)}
                      disabled={pending}
                      title="Delete"
                      className="flex size-8 items-center justify-center rounded-lg text-dusk-faint transition-colors hover:bg-carbon-high hover:text-signal-red disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => revoke(k.id)}
                      disabled={pending}
                      className="flex h-8 items-center rounded-lg border border-carbon-line bg-carbon px-3 text-[11.5px] text-dusk-muted transition-colors hover:border-signal-red/40 hover:text-signal-red disabled:opacity-40"
                    >
                      Revoke
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function RevealedKey({
  name,
  value,
  onClose,
}: {
  name: string;
  value: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success("Key copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-brass/30 bg-brass/[0.05] p-4">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brass" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-dusk">
            Copy your key for “{name}” now
          </p>
          <p className="mt-0.5 text-[12px] text-dusk-muted">
            This is the only time the full key is shown. Store it somewhere safe
            — you won&apos;t be able to see it again.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-carbon-line bg-carbon px-3 py-2 font-mono text-[12.5px] text-brass">
              {value}
            </code>
            <button
              onClick={copy}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-brass px-3 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-lg text-dusk-faint transition-colors hover:bg-carbon-high hover:text-dusk"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
