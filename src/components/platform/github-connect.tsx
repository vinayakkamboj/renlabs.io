"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Github, Loader2, Unplug } from "lucide-react";

interface GithubConnectProps {
  configured: boolean;
  connected: boolean;
  login: string | null;
  connectedAt: string | null;
}

const ERROR_LABELS: Record<string, string> = {
  supabase_not_configured: "Sign-in is not configured yet.",
  github_not_configured: "GitHub OAuth is not configured on the server.",
  missing_state: "The authorization session expired. Please try again.",
  missing_state_param: "GitHub did not return a valid session. Try again.",
  invalid_state: "The authorization session was invalid. Please try again.",
  state_mismatch: "Security check failed. Please start the connection again.",
  missing_code: "GitHub did not return an authorization code.",
  token_exchange_failed: "Could not exchange the GitHub code for a token.",
  token_exchange_error: "Could not reach GitHub to exchange the token.",
  github_user_fetch_failed: "Could not read your GitHub profile.",
  github_user_fetch_error: "Could not reach GitHub to read your profile.",
};

export function GithubConnect({
  configured,
  connected,
  login,
  connectedAt,
}: GithubConnectProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );

  // Surface ?github=connected and ?github_error=… from the OAuth callback.
  useEffect(() => {
    const error = params.get("github_error");
    const ok = params.get("github");
    if (error) {
      setNotice({
        kind: "error",
        text: ERROR_LABELS[error] ?? decodeURIComponent(error),
      });
    } else if (ok === "connected") {
      setNotice({ kind: "ok", text: "GitHub connected." });
    }
    if (error || ok) {
      // Clean the URL so the notice doesn't persist on refresh.
      router.replace("/dashboard/integrations");
    }
  }, [params, router]);

  async function disconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    setNotice(null);
    try {
      await fetch("/api/github/disconnect", { method: "POST" });
      startTransition(() => router.refresh());
      setNotice({ kind: "ok", text: "GitHub disconnected." });
    } catch {
      setNotice({ kind: "error", text: "Could not disconnect. Try again." });
    } finally {
      setDisconnecting(false);
    }
  }

  const connectedDate = connectedAt
    ? new Date(connectedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised">
      <div className="flex items-center justify-between border-b border-carbon-line px-5 py-3.5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-dusk-muted">
          GitHub
        </h2>
        {connected ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-green/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-signal-green">
            <Check className="size-3" />
            Connected
          </span>
        ) : null}
      </div>

      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-carbon-line bg-carbon">
            <Github className="size-5 text-dusk" />
          </div>
          <div>
            {connected ? (
              <>
                <p className="text-[14px] font-medium text-dusk">
                  Connected as{" "}
                  <span className="font-mono text-brass">@{login}</span>
                </p>
                <p className="mt-1.5 max-w-[42ch] text-[13px] leading-relaxed text-dusk-muted">
                  Ren Code can read your selected repositories to index them,
                  analyze architecture, and open pull requests.
                  {connectedDate ? ` Connected ${connectedDate}.` : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-[14px] font-medium text-dusk">
                  Connect your GitHub
                </p>
                <p className="mt-1.5 max-w-[42ch] text-[13px] leading-relaxed text-dusk-muted">
                  Authorize Ren Code to read selected repositories — indexing,
                  analysis, file navigation, and pull request generation.
                </p>
              </>
            )}
          </div>
        </div>

        {notice ? (
          <p
            className={
              notice.kind === "ok"
                ? "mt-4 rounded-lg bg-signal-green/10 px-3 py-2 text-[12.5px] text-signal-green"
                : "mt-4 rounded-lg bg-signal-red/10 px-3 py-2 text-[12.5px] text-signal-red"
            }
          >
            {notice.text}
          </p>
        ) : null}

        {!configured ? (
          <p className="mt-5 rounded-lg border border-carbon-line bg-carbon px-4 py-3 text-[12.5px] leading-relaxed text-dusk-muted">
            GitHub connection activates once the GitHub OAuth app credentials
            (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET) are configured on the
            server.
          </p>
        ) : connected ? (
          <button
            onClick={disconnect}
            disabled={disconnecting || pending}
            className="mt-5 flex h-10 items-center gap-2 rounded-lg border border-carbon-line bg-carbon px-5 text-[13px] font-medium text-dusk transition-colors duration-200 hover:border-carbon-line-strong disabled:opacity-50"
          >
            {disconnecting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Unplug className="size-4" />
            )}
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : (
          <a
            href="/api/github/connect?returnTo=/dashboard/integrations"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-dusk px-5 text-[13px] font-medium text-carbon transition-opacity duration-200 hover:opacity-90"
          >
            <Github className="size-4" />
            Connect GitHub
          </a>
        )}
      </div>
    </div>
  );
}
