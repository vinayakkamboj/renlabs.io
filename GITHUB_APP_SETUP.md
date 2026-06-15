# GitHub App Setup — Ren Code

Ren Code connects to GitHub through a **GitHub App** (`Ren Coding Agent`). A
GitHub App lets each user install Ren on their account, pick exactly which
repositories Ren can touch, and gives Ren high rate limits and short-lived
tokens. This is the recommended, production-grade way to manage many users'
repositories.

> If you'd rather use a simpler **OAuth App** instead, just leave
> `GITHUB_APP_SLUG` unset — the code automatically falls back to the classic
> OAuth authorize+scope flow. The rest of this doc is for the GitHub App.

---

## 1. App settings (github.com/settings/apps → Ren Coding Agent)

### Identity & URLs
| Field | Value |
|-------|-------|
| Homepage URL | `https://ren-ai-six.vercel.app/` |
| Callback URL | `https://ren-ai-six.vercel.app/api/github/callback` |
| Webhook | **Inactive** (uncheck "Active" — not needed) |

### Identifying and authorizing users — IMPORTANT
- ✅ **Check "Request user authorization (OAuth) during installation"**

  This is what makes installation return an OAuth `code` so Ren can identify
  the user and act on their behalf. **Without this, connecting will fail** with
  an `enable_oauth_during_install` error.

- ✅ **Uncheck "Expire user authorization tokens"** (recommended)

  Keeps user tokens long-lived so you don't depend on refresh-token rotation.
  (Ren *does* handle refresh automatically if you leave this on — but turning it
  off is simpler and avoids any edge cases.)

---

## 2. Permissions (Permissions & events tab)

Set these **Repository permissions**, then save:

| Permission | Access | Why |
|------------|--------|-----|
| **Contents** | Read & write | Read repo files (import) and commit pushed code |
| **Administration** | Read & write | Create new repositories for the user |
| **Workflows** | Read & write | Push files under `.github/workflows/` |
| **Metadata** | Read-only | (Mandatory — auto-selected) |

Optional **Account permissions**:
| Permission | Access | Why |
|------------|--------|-----|
| Email addresses | Read-only | Record the connecting user's email |

> After changing permissions, GitHub will ask existing installations to
> **accept the new permissions**. New installs get them automatically.

---

## 3. Environment variables (Vercel → Settings → Environment Variables)

```bash
# The GitHub App's OAuth credentials (Client ID + a generated client secret)
GITHUB_CLIENT_ID=Iv23ligjem5OdWfPwyXa
GITHUB_CLIENT_SECRET=<your client secret>

# The app slug from its public URL: github.com/apps/<slug>
GITHUB_APP_SLUG=ren-coding-agent

# Canonical production URL so the OAuth redirect_uri is always correct
NEXT_PUBLIC_APP_URL=https://ren-ai-six.vercel.app

# Random key to encrypt the session cookie (openssl rand -hex 32)
GITHUB_SESSION_SECRET=<64-char hex>
```

Redeploy after setting these.

---

## 4. How the flow works in code

```
User clicks "Connect GitHub"
        │
        ▼
/api/github/connect
  • verifies the user is signed in (Supabase)
  • GITHUB_APP_SLUG is set → redirect to
    github.com/apps/ren-coding-agent/installations/new?state=<csrf>
        │
        ▼
GitHub: user installs the app, picks repositories
  (OAuth-during-install is on → GitHub returns a code too)
        │
        ▼
/api/github/callback
  • verifies CSRF state (cookie; param when present)
  • exchanges code → user-to-server access token
  • captures installation_id, refresh_token, expires_in
  • stores it all in an encrypted httpOnly cookie
        │
        ▼
Push / Import use that token:
  • create repo            POST /user/repos        (Administration)
  • commit files           Git Data API            (Contents)
  • token auto-refreshes when expired (getValidSession)
```

A newly created repo is automatically added to the installation, so Ren can
push to it immediately.

---

## 5. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `redirect_uri is not associated with this application` | The Callback URL in the app settings must exactly equal `<NEXT_PUBLIC_APP_URL>/api/github/callback`. Set `NEXT_PUBLIC_APP_URL` in Vercel. |
| `enable_oauth_during_install` | Check "Request user authorization (OAuth) during installation" in the app settings. |
| Push fails with 404 on a repo | The app isn't installed on that repo. Reconnect and grant access (or choose "All repositories" at install). |
| Push fails creating a repo (403) | Add the **Administration: Read & write** permission and re-accept it. |
| `Resource not accessible by integration` on workflow files | Add the **Workflows: Read & write** permission. |
