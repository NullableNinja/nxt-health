# Architecture decisions

## ADR-001: web-first Vite application

React’s current documentation supports building from scratch when a framework is not a fit, and Vite provides a lean modern build system. We chose React 19.3 + Vite 8.3 because the requested product is a responsive client-first PWA and the repository began empty. React Server Components or a full-stack framework can be introduced later if server-rendered surfaces become valuable.

References: https://react.dev/learn/installation, https://vite.dev/guide/

## ADR-002: Dexie over IndexedDB for local-first MVP

The first useful version must work offline and avoid a server dependency. Dexie provides a typed repository-friendly IndexedDB layer with schema versions. The UI never talks to tables directly, so native SQLite or a remote repository can be added later.

## ADR-003: PWA via vite-plugin-pwa

The web app is a first-class installable target. A manifest and service worker are configured at the build boundary. Cache behavior will be expanded carefully as provider/network workflows are added.

Reference: https://vite-pwa-org.netlify.app/

## ADR-004: provider adapters, not provider-shaped domain models

USDA FoodData Central requires an API key and publishes food search/details endpoints; Open Food Facts provides an open product API with a current v3 API. Both are normalized into `Food`, with source and confidence retained. No key is committed and missing network access falls back to local logging.

References: https://fdc.nal.usda.gov/api-guide/, https://openfoodfacts.github.io/openfoodfacts-server/api/

## ADR-005: native Android is an explicit future boundary

Capacitor is designed to be added to existing modern JavaScript projects and exposes a plugin boundary for native functionality. Health Connect is Android/Google Play-specific, permissioned, and sensitive; therefore Phase 1 includes no fake integration and no health permissions. A future Android client will add only the data types it needs and will expose sync state to users.

References: https://capacitorjs.com/docs, https://developer.android.com/health-and-fitness/health-connect, https://developer.android.com/health-and-fitness/health-connect/publish

## ADR-006: trend before certainty

The weight screen uses a regression slope when enough dated entries exist. A single scale reading is not treated as progress or failure. Confidence is labeled as insufficient/early/developing/strong and will later incorporate completeness, volatility, and observation length for adaptive TDEE.

## ADR-007: no hardcoded person or medical protocol

Profile, goal, food, activity, medication, fasting, and symptom concepts remain generalized. Optional modules are not rendered globally until enabled by data or user choice. This is a product safety and commercialization constraint, not merely a style preference.

## ADR-008: Paper-Fu visual language

The primary surface uses near-black navy, crisp one-pixel rules, offset hard shadows, and small-radius layered panels. The rainbow onboarding progress strip is an intentional LGBTQ+ support signal, while green is reserved for positive health-state semantics. Ambient motion is subtle and respects `prefers-reduced-motion`.

## ADR-009: four connected health domains

The product uses `body`, `mind`, `behavior`, and `environment` as shared domain labels. Mental health
has architectural parity with nutrition, activity, medication, sleep, and body composition. This
avoids building a weight-management product with a later mental-health attachment while keeping
domain-specific workflows optional.

## ADR-010: observation before interpretation

Wellbeing and life-event records preserve user-entered observations and context. Future insights may
describe temporal patterns with uncertainty, but may not diagnose, prescribe, celebrate emotional
suppression, or infer causation from correlation. There is no global health score or failure streak.

## ADR-011: sensitive data requires scoped consent

Local storage is the default. AI access, cross-domain analysis, cloud sync, and health-data imports
each require their own revocable consent scope. Enabling one capability does not imply permission to
read private journals, wellbeing entries, medication information, or life events.

## ADR-012: kintsugi as restraint, not decoration

Kintsugi is a philosophical inspiration about continuing with visible history, not the product name
and not a justification for fake pottery cracks. Visual references should stay occasional and
intentional: imperfect gold seams, transitions, dividers, timeline moments, and the reusable `//`
motif. The dark navy, blue, and restrained gold direction remains primary.

## ADR-013: emotionally honest product voice

The product should not sound like a wellness company. Its copy should acknowledge difficulty without
romanticizing suffering: damage does not erase value, struggling does not make someone a failure,
mental health is health, and a setback does not erase progress. The voice is direct, warm,
intelligent, and nonjudgmental. “Sometimes you’re just trying to keep going. And that counts.” is a
core tone test for future onboarding and empty-state copy.

The first-run opening uses `BODY // MIND // LIFE`, “See the whole you,” and “Every part of you //
understood together.” The same visual weight should be applied to body, mind, behavior, medication,
sleep, activity, nutrition, and life context. Mental-health tools should feel like part of the person,
not a segregated product area.

## ADR-014: inclusive identity and equation language

Sex assigned at birth, gender identity, and pronouns are separate profile concepts. All identity
fields are optional. When provided, sex assigned at birth may imply the technical population
reference used by a formula; that derived value is never presented as a user's identity or inferred
from pronouns.

## ADR-015: additive universal capture layer

Universal Log // and Patterns use a versioned `captures` table rather than replacing the existing
domain tables in place. This lets the product ship one capture surface while preserving existing
user data and Today/domain screens. Where a compatible canonical table exists, a universal entry
mirrors into it at write time; unsupported note/event types remain in `captures` until their richer
domain model is implemented. Blood pressure uses one compound capture and retains the prior scalar
metric IDs for backwards compatibility.
