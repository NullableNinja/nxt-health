# Expanded product vision impact plan

## Decision

The product remains a general-purpose, local-first personal health intelligence platform. The
temporary working name stays unchanged. Mental health is a first-class domain alongside body,
behavior, and environment; it is not a separate add-on or a diagnostic feature.

The first-run opening is `BODY // MIND // LIFE` — “See the whole you.” It presents movement, food,
sleep, feelings, medication, habits, and history as information about one person, not separate
identity categories.

## What changes now

| Area                 | Foundation in this pass                                                                                           | Deliberately deferred                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Domain model         | Add `HealthDomain`, multi-goal intent, `WellbeingEntry`, `LifeEvent`, and granular `ConsentPreference` contracts. | Clinical taxonomies, diagnosis, treatment plans, or composite scores.                |
| Database             | Add versioned local tables for wellbeing observations, life events, and consent preferences.                      | Cloud sync, encryption/key management, and cross-device merge policy.                |
| Onboarding           | Add a skippable two-page opening, multi-select goals, and optional identity/metric context across body and mind.  | Full privacy-control wizard and all future domain setup flows.                       |
| Navigation/dashboard | Preserve the current shell and screens; let goals and future modules shape the dashboard.                         | A dedicated mental-health dashboard before there is a meaningful workflow behind it. |
| Analytics            | Establish observation-first language and preserve source/context fields.                                          | Causal inference, predictive risk models, and diagnosis.                             |
| AI                   | Keep AI opt-in and separately consented for sensitive data.                                                       | Any AI write path or journal analysis.                                               |
| Privacy              | Treat wellbeing, journals, medication, and life events as highly sensitive future categories.                     | Claiming compliance or shipping a sync service.                                      |
| Design               | Preserve dark navy, restrained gold, blue, and occasional seam/`//` motifs.                                       | Literal pottery cracks or an application-wide kintsugi theme.                        |
| Android              | Keep native capability boundaries generic so Health Connect can later support multiple domains.                   | Requesting permissions or importing health data in the web MVP.                      |

## UX guardrails

- Health is physical and mental.
- Logging is input. Understanding is the product.
- Nothing about you is a failed streak.
- Be curious, never judgmental.
- Notice patterns; do not invent causation.
- Support people; do not diagnose them.
- The user owns their story and data.
- Continue from where you are. //

## Voice guardrail

Do not sound like a wellness company. Sound like someone who understands why the product needs to
exist. Copy should be emotionally honest, direct, warm without being saccharine, and comfortable
acknowledging that life can be difficult. Sometimes people are just trying to keep going. And that
counts.

## Next vertical slices

1. Add a private, non-scored wellbeing check-in workflow with clear edit/delete controls.
2. Add optional life-event context with explicit user-entered dates and domains.
3. Add privacy controls for local-only storage, cross-domain analysis, AI access, export, deletion,
   and retention before any cloud or AI feature is enabled.
4. Add observation-based insight copy and tests that prohibit causal or diagnostic claims.
