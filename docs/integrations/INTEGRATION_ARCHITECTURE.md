# Integration architecture

## Product boundary

You 2.0 is a local-first health record system with optional provider connections. The canonical pipeline is:

`provider adapter → normalized record → provenance + dedupe → canonical store → domain projections → Today / Body / Activity / Sleep / Nutrition / Mind / Patterns / Insights`

The app may display local manual data without any integration. Provider connection metadata is separate from credentials. Access tokens, refresh tokens, client secrets, and encryption keys must live in a server-side secret/token store, never in React state or browser IndexedDB.

## Canonical record contract

`NormalizedHealthRecord` keeps the observation time (`startAt`/`endAt`), the user-local calendar date, a normalized unit/value, and `SourceProvenance`. Provenance must preserve the provider, external record ID/version, source app/device, timezone, and a safe raw reference. Raw payloads are not stored in `rawReference`; that field is an opaque pointer only.

Compound observations such as blood pressure, nutrition, sleep stages, and workout details must remain compound in `metadata` or a typed extension rather than being silently flattened into unrelated values. Derived insights must set `isDerived` and cite the records or rules that produced them.

## Deduplication policy

1. Prefer provider + connection + external record ID/version.
2. For imports, use a stable file/batch identity plus row/message identity.
3. For records without a stable source ID, use a source-scoped fingerprint of metric, time interval, value, and unit.
4. Never sum overlapping sources by default. Retain duplicates for auditability and choose a display source using explicit `SourcePreference`.
5. Preserve provider revisions and deletion/tombstone support in the sync layer before claiming a production-ready adapter.

## Sync lifecycle

Every run records its trigger, start/finish, outcome, counts, duplicate count, cursor transition, and errors. A provider adapter must handle:

- initial backfill and incremental cursors;
- pagination and provider rate limits;
- access-token expiry and refresh;
- retry with capped exponential backoff;
- partial success without losing the cursor for already persisted pages;
- revoked permission, disconnect, provider outage, and malformed records;
- timezone/DST boundaries and late-arriving revisions.

## Native versus cloud

Health Connect is the device store in scope for this Android release. It requires a native bridge, device availability checks, user permission screens, and a physical/emulator test path. A desktop browser cannot truthfully connect to it. Apple Health / HealthKit is intentionally out of scope for this release.

Cloud providers use OAuth 2.0 authorization code flows with PKCE where supported, state/CSRF validation, exact callback URLs, least-privilege scopes, refresh/revocation, and provider-specific approval gates. The web app may initiate an OAuth flow, but it must not exchange codes with a client secret in the browser.

## UI truthfulness

Profile → Connections is the source of truth for integration state. It should distinguish:

- Ready — configuration exists and the adapter can begin authorization;
- Needs configuration — the app is not configured for this provider;
- Approval required — provider access is gated by a partner/review program;
- Android required / iOS required — the current surface cannot access the native store;
- Connected — authorization/permission succeeded and a verification read succeeded;
- Error — a real connection exists but its latest operation failed;
- Unsupported — no supported implementation is available.

“Connected” must never be inferred from a button click or a saved preference.

## Sleep and dream journal

Objective sleep sessions and subjective dream notes are related but different records. Dream notes are private manual reflections linked to a sleep date/session when the user chooses. They are not scored, diagnosed, or automatically interpreted as medical evidence. Insights may use them only after an explicit user choice and should cite the source record.
