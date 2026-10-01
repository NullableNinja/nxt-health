# Backend security boundary

The current workspace is a Vite PWA with Dexie local storage and no server. That is a good local-first baseline, but it cannot safely hold OAuth client secrets or refresh tokens. Cloud connections should begin only after adding a same-origin backend-for-frontend (BFF).

## Required boundary

```text
React PWA ── opaque HttpOnly session cookie ──> BFF
                                               ├─ OAuth start/callback
                                               ├─ encrypted token store
                                               ├─ refresh/revoke
                                               ├─ provider adapters
                                               └─ sync worker
```

The browser must never receive provider refresh tokens or client secrets. `VITE_*` values are public bundle values; provider secrets must use server-only environment variables such as `OAUTH_STRAVA_CLIENT_SECRET` and `TOKEN_ENCRYPTION_KEY`.

## OAuth contract

- `POST /api/oauth/:provider/start` validates the provider against a server allowlist, creates a short-lived state + PKCE transaction, records the exact callback/return route, and redirects to the provider.
- `GET /api/oauth/:provider/callback` validates state, session binding, provider, exact redirect URI, and PKCE before exchanging the code server-to-server. It returns a clean `303` redirect and never logs or returns codes/tokens.
- `GET /api/connections` returns metadata and truthful status only; tokens never appear in the response.
- `POST /api/connections/:id/sync` queues a manual run.
- `POST /api/connections/:id/disconnect` disables local sync first, attempts provider revocation, removes/quarantines token material, and reports whether remote revocation was confirmed.

Use Secure, HttpOnly, SameSite=Lax, `__Host-` application-session cookies, CSRF protection for state-changing routes, exact provider allowlists, least-privilege scopes, authenticated encryption with key rotation, and a per-connection refresh lock. Keep “connected,” “last verified,” and “last successful sync” as separate facts.

## Current honest limit

Until that BFF exists and real provider credentials/test accounts are supplied, this repository can provide the canonical model, provider matrix, local sync contract, file-import path, and truthful setup states. It must not claim that Fitbit, Google Health API, Strava, Withings, Oura, Garmin, or Health Connect is connected.
