# Architecture

## Current shape

This is a single Vite application with explicit internal package boundaries:

```text
src/
  domain/       pure models and calculations
  data/         Dexie database, repositories, provider adapters
  platform/     explicit web/native capability boundary
  ui/           React composition and presentation
public/         PWA icons and static assets
```

The layout is intentionally a “similarly organized” architecture rather than a prematurely distributed monorepo. The domain layer is independent of React and persistence. It can be moved into a package later without changing the calculations.

The product is organized around four connected health domains: `body`, `mind`, `behavior`, and
`environment`. These are shared context labels, not separate products or diagnoses. Mental-health
data uses the same domain and repository boundaries as physical-health data while receiving stricter
privacy and consent treatment.

## Runtime boundaries

- `domain`: canonical entities and pure calculations. No browser APIs, fetch, or React.
- `data`: persistence and external provider adapters. Repositories are the only UI-facing data access path.
- `ui`: onboarding, dashboard, logging workflows, responsive presentation, and user-facing error/safety language.
- future `services/api`: a modular monolith boundary for sync/auth/provider proxying when cloud features are justified.
- future `apps/android`: Capacitor host and native plugins. It should consume the same domain/data contracts rather than become a second product implementation.

## Persistence

The MVP uses Dexie over IndexedDB. Canonical values are stored in metric units (kg, cm, km) and converted at the UI edge. Dexie gives a browser-local database with migrations and leaves room for native SQLite or a server repository later.

Current tables are `profiles`, `goals`, `weights`, `foods`, `foodLogs`, `exercises`,
`healthMetrics`, `wellbeingEntries`, `lifeEvents`, `consentPreferences`, and `captures`. The
`captures` table is the additive universal-observation layer used by Log // and Patterns. Existing
domain tables remain readable for compatibility and Today; supported capture types mirror into
those tables at write time. The schema is versioned.
Demo foods are seeded separately from user data. Health metrics, wellbeing, and life-event records
are foundational contracts and storage only; they do not imply that every workflow or analytics model
is already shipped.

## Provider boundaries

`FoodProvider` abstracts search and barcode lookup. USDA FoodData Central and Open Food Facts adapters normalize into the neutral `Food` model and preserve source/source ID/confidence. Missing keys or network access do not prevent custom/local food logging.

## PWA and Android readiness

`vite-plugin-pwa` provides an installable manifest and service worker. Browser APIs are the default. `src/platform/capabilities.ts` makes native-only capabilities explicit with web-safe false values; no fake Health Connect integration is included in this phase. Capacitor can be added to the built web app later with native plugins for Health Connect, barcode scanning, secure storage, notifications, and background sync.

## Data flow

```text
React screen → repository / capture workflow → Dexie table(s)
                    ↓
              domain calculations
                    ↓
             derived dashboard view
```

Provider calls are opt-in and normalized before saving. UI components never own the canonical calculation formulas.

Future cross-domain insight generation must read explicit, user-authorized data scopes and emit
observations with source, date range, uncertainty, and limitations. Temporal correlation must never
be presented as causation.

## Safety and privacy

The app does not diagnose, prescribe, or recommend medication changes. Calorie values are estimates
and should remain accompanied by methodology/context. Self-reported wellbeing values are observations,
not a clinical score. Sensitive health data—including journals, medication information, life events,
and wellbeing entries—must not be included in AI or cross-domain analysis by default.

Cloud sync, AI processing, accounts, Health Connect imports, and analytics require explicit,
granular consent, destination explanations, export, deletion, and retention work. Crisis/safety
resources must be configurable by region and surfaced carefully when a future workflow indicates a
need; this MVP does not attempt crisis assessment.
