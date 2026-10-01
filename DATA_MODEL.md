# Data model

## Conventions

- IDs are opaque strings and do not contain the working product name.
- Stored timestamps/dates are ISO strings; local-day handling will become timezone-aware before sync.
- Canonical physical units are metric: kilograms, centimeters, kilometers, minutes, grams, and kilocalories.
- Every externally sourced food preserves provider and source ID.
- Derived metrics should eventually store methodology, source, confidence, and sufficient-data status.
- Health context is organized with the shared domains `body`, `mind`, `behavior`, and `environment`.
- Self-reported wellbeing values are raw observations, never a composite mental-health score.
- Sensitive records are user-controlled and must carry an explicit consent scope before any future
  sync, AI access, or cross-domain analysis.
- Universal observations preserve origin, date/time, units, context, and notes so a record can be
  reviewed without confusing a report with a measured or imported value.

## Implemented entities

### Profile

Display name, age or birth-date input, optional sex assigned at birth, optional gender identity,
optional pronouns, height, unit preference, activity baseline, typical steps, and audit timestamps.
When sex assigned at birth is provided, the app may derive a technical population-reference input
for formulas that require one. That derived value is not an identity field and is never inferred from
gender identity or pronouns.

### Goal

General goal kind, user-facing label, relevant health domains, optional target weight/date, active
state, and created timestamp. A profile can have multiple goals. No global assumption that a user
wants weight loss or that a mental-health goal implies a diagnosis.

### WeightEntry

Date, canonical kg value, source (`manual`, `imported`, or `measured`), and optional note.

### HealthMetricEntry

An optional dated observation such as waist or hip circumference, body-fat percentage, resting heart
rate, blood pressure, fasting screening values, or A1C. Values preserve a normalized unit, source
(`manual`, `screening`, or `imported`), and date. A screening result is context to interpret, not a
diagnosis or a verdict.

### Food

Name, optional brand/barcode/serving grams, calories/macros/fiber, source, source ID, verification time, and confidence.

### FoodLogEntry

Local date, food reference plus display snapshot, meal label, servings, and calculated nutrition snapshot. Storing the snapshot keeps historical logs stable when a food is later edited.

### ExerciseEntry

Date, generalized activity type, duration, intensity, optional distance/steps/heart rate/calories, and note. This is intentionally not a specialized “running” or “martial arts” table.

### WellbeingEntry

An optional, private self-report for a local date, optionally linked to a journal entry. It may
contain any user-selected subset of separate mood, anxiety, stress, energy, motivation,
sleep-quality, focus, and body-tension observations on a user-facing scale, plus a note and source.
The fields remain separate so the product does not collapse a person's experience into a single
mental-health score.

### LifeEvent

An optional user-entered context event with kind, title, start/end dates, related domains, note, and
audit timestamps. Examples include therapy started, medication changed, injury, bereavement, move,
job change, relationship change, recovery milestone, or a custom event. It is private, editable,
deletable, and contextual; temporal alignment does not establish causation.

### ConsentPreference

A granular local preference for future capabilities such as cloud sync, general AI, sensitive-data
AI access, cross-domain analysis, or health-data import. Consent is scoped and revocable rather than
implied by enabling the application.

### CaptureEntry

The additive universal Log // record. It contains a capture type (`weight`, `metric`,
`blood-pressure`, `heart-rate`, `glucose`, `cholesterol`, `food`, `movement`, `wellbeing`, `sleep`,
`medication`, `symptom`, `life-event`, or `custom`), an historical timestamp, title/value/unit,
source, optional context/note, and a typed payload for compound values. Blood pressure is one
capture with systolic as the primary value and diastolic in its payload; old scalar systolic and
diastolic metric records remain supported for compatibility. Supported capture types also mirror to
existing canonical tables so Today and domain histories remain useful.

### MetricDefinition

The metric registry in `src/domain/metrics.ts` defines stable IDs, labels, domains, units, input
types, compound status, privacy sensitivity, and validation. The registry is the source for metric
selectors and is additive: compatibility IDs remain readable while new metric definitions can be
introduced without expanding unrelated React components.

## Planned entities

BodyMeasurement, BodyCompositionEntry, Meal, Recipe, RecipeIngredient, ExerciseSegment, Medication,
MedicationSchedule, MedicationAdministration, SymptomType, SymptomEntry, FastingProtocol,
FastingSession, HydrationEntry, SleepEntry, JournalEntry, CopingStrategy, TherapyGoal,
MetabolicEstimate, TDEEObservation, GoalProjection, HealthDataImport, DataSource, SafetyResource,
and Insight.

These should be added as vertical slices, not empty UI routes. Optional modules must remain configurable.

## Migration policy

Dexie schema versions are the migration source of truth for the local database. Production data must never be reset to accommodate a model change. Demo reset is an explicit development-only action in Settings.
