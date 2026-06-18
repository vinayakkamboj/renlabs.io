"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock, Loader2, Mail, UserPlus, X } from "lucide-react";
import {
  inviteCollaborator,
  getCollaborators,
  type CollaboratorRow,
} from "@/lib/actions/collaborators";

interface InviteModalProps {
  projectId: string;
  onClose: () => void;
}

const STATUS_LABEL: Record<CollaboratorRow["status"], string> = {
  pending: "Pending",
  accepted: "Active",
  declined: "Declined",
};

const STATUS_STYLE: Record<CollaboratorRow["status"], string> = {
  pending: "text-signal-amber",
  accepted: "text-signal-green",
  declined: "text-dusk-faint",
};

export function InviteModal({ projectId, onClose }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [collaborators, setCollaborators] = useState<CollaboratorRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getCollaborators(projectId).then(setCollaborators).catch(() => {});
  }, [projectId]);

  function submit() {
    const value = email.trim().toLowerCase();
    if (!value) return;
    setError(null);
    startTransition(async () => {
      const res = await inviteCollaborator(projectId, value);
      if (res.ok) {
        setCollaborators((prev) => {
          const without = prev.filter((c) => c.email !== value);
          return [...without, { email: value, status: "pending" }];
        });
        setEmail("");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-carbon/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-carbon-line bg-carbon-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-carbon-line px-5 py-4">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-brass" />
            <span className="text-[14px] font-medium text-dusk">
              Invite collaborator
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-dusk-faint transition-colors hover:bg-carbon-high hover:text-dusk"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-[13px] leading-relaxed text-dusk-muted">
            Invite someone by email. They&apos;ll get a request to collaborate
            and, once they accept, the project appears in their workspace to view
            and edit.
          </p>

          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-dusk-faint" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="teammate@example.com"
                className="w-full rounded-lg border border-carbon-line bg-carbon py-2.5 pl-9 pr-3 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
              />
            </div>
            <button
              onClick={submit}
              disabled={!email.trim() || pending}
              className="flex h-10 items-center gap-1.5 rounded-lg bg-brass px-4 text-[13px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Send"
              )}
            </button>
          </div>

          {error && <p className="mt-2 text-[12px] text-signal-red">{error}</p>}

          {collaborators.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-dusk-faint">
                People on this project
              </p>
              <ul className="space-y-1.5">
                {collaborators.map((c) => (
                  <li
                    key={c.email}
                    className="flex items-center gap-2 rounded-lg border border-carbon-line bg-carbon px-3 py-2 text-[12.5px]"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-carbon-high text-[11px] font-medium uppercase text-dusk-muted">
                      {c.email[0]}
                    </span>
                    <span className="flex-1 truncate text-dusk-muted">
                      {c.email}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-[11px] ${STATUS_STYLE[c.status]}`}
                    >
                      {c.status === "pending" && <Clock className="size-3" />}
                      {STATUS_LABEL[c.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-carbon-line bg-carbon/40 px-5 py-3.5">
          <p className="text-[11.5px] leading-relaxed text-dusk-faint">
            Only people with a Ren Code account can be invited. They&apos;ll see
            your request on their dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
