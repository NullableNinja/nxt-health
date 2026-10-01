# Metabolic engine

The current pure implementation is in `src/domain/calculations.ts`. It exposes Mifflin–St Jeor, revised/original Harris–Benedict, Owen, and Cunningham when body-fat data is available. It reports available equations separately and derives a transparent ensemble mean plus an activity-factor TDEE starting point.

These are population estimates. The application must not describe them as measured resting metabolism. Adaptive TDEE is a later phase and will require longer windows, logging completeness, weight trend smoothing, and explicit confidence.
