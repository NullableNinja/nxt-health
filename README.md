# N//XT

N//XT is the working project for a local-first whole-health platform. The name points forward without pretending the past disappears: the product helps people see body, mind, habits, relationships, and context together.

## Current slice

The Phase 1 foundation currently includes:

- progressive onboarding for profile, units, activity baseline, and goal context;
- a skippable first-run primer and sectioned multi-select goals spanning physical, mental, daily-life, spiritual, and whole-picture priorities;
- a configurable Today view shaped by the person’s chosen focus areas;
- a Mind workspace with optional check-ins, paced breathing, box breathing, and original non-attributed reflections;
- explicit Open Food Facts search, barcode lookup, and camera scanning where the browser supports it;
- optional dated body measurements and biometric screening context;
- local IndexedDB persistence through Dexie;
- manual weight logging with regression-based trend calculations;
- transparent population metabolic estimates and goal-sensitive calorie targets;
- provenance-aware demo food library and food diary with serving math;
- generalized activity logging;
- foundational local contracts for wellbeing observations, life events, and granular consent;
- installable PWA configuration and offline-capable app shell;
- responsive dashboard layouts for desktop and phone widths;
- Capacitor Android host under `apps/android`, sharing the web build and ready for native capability bridges;
- unit tests for conversions, metabolic equations, and trend calculations.

## Run locally

```powershell
npm install
npm run dev
```

Quality checks:

```powershell
npm run format:check
npm run lint
npm run test
npm run build
```

Android host workflow:

```powershell
npm run android:sync
npm run android:open
```

The Android project is a Capacitor shell around the shared web app. Android Studio
and the Android SDK are required to open, run, and package it. The application ID in
`capacitor.config.ts` is provisional and must be replaced before publishing.

Optional third-party lookup configuration belongs in `.env` and must never be committed. Android Health Connect uses on-device permissions rather than provider credentials. USDA lookups require a FoodData Central API key; the app remains useful without one through cached/custom foods. Journal GIF search uses an optional `VITE_GIPHY_API_KEY`; local image uploads and direct GIF URLs do not require a key.

## Architecture notes

Read [ARCHITECTURE.md](./ARCHITECTURE.md), [DATA_MODEL.md](./DATA_MODEL.md), [ROADMAP.md](./ROADMAP.md), and [DECISIONS.md](./DECISIONS.md) for the current implementation boundary.
