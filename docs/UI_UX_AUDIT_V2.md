# N//XT UI/UX Audit v2

This ledger records the defects found during the current product expansion. It intentionally separates verified fixes from work still queued so visual QA does not get mistaken for completion.

## Product lens

Kintsugi is the quality bar: the interface should make room for imperfect data, difficult days, and
unfinished change without framing the person as broken. Insights should reveal useful relationships
and next steps while preserving dignity, agency, and the right to keep parts of life private.

## Verified fixes in this sprint

1. Added a persisted SleepSession domain and Dexie migration.
2. Added overnight and nap capture workflows.
3. Added sleep duration, quality, restedness, awakenings, notes, and source fields.
4. Added sleep averages and cautious timing/quality insights.
5. Added Sleep to Today, the desktop sidebar, and the mobile More menu.
6. Added sleep records to workspace export/import and reset/delete flows.
7. Added Today layout density control.
8. Added Today module show/hide controls.
9. Added Today module order controls with persisted move-up/move-down behavior.
10. Added Today module size controls.
11. Added a recommended-layout reset action.
12. Added mobile Body action stacking so controls no longer clip horizontally.
13. Added mobile auto-scroll to Body capture forms.
14. Added photo pose metadata for progress photos.
15. Added Imperial height formatting in the Profile readout.
16. Added Imperial height input conversion in Profile editing.
17. Added timezone, movement preference, nutrition context, sleep context, and data-detail preferences.
18. Added rationale/domain context to onboarding-created intentions.
19. Added visible destination and rationale context to Profile intentions.
20. Prevented an empty Profile share selection from producing outbound text.
21. Added a clipboard visibility warning to Profile sharing.
22. Added theme-token overrides for legacy inline forms that leaked dark-green styling into Dawn.
23. Added domain tests for overnight duration and sleep summaries.
24. Preserved existing full check-in dimensions in the journal/record views.
25. Kept Mind practice counts tied to the actual 30-item catalog.

## Verified visual observations

26. Dawn uses light page surfaces but still had a legacy dark inline-form surface.
27. Dawn’s selected jump-link state is visible and should be matched in every theme.
28. Palette changes correctly recolor primary buttons but legacy secondary surfaces require token review.
29. Background imagery is present for growth and orbit, with plain available as a no-imagery option.
30. Mobile Body actions now stack into full-width touch targets.
31. Mobile Body measurement capture now lands the first field in view.
32. Mobile Sleep summary cards collapse to one column.
33. Mobile Today customization remains usable as a vertical disclosure.
34. Mobile navigation provides access to Sleep without crowding the five primary destinations.
35. The app still emits a large JavaScript chunk and needs a performance/code-splitting pass.

## Queued findings from cross-route audit

36. Replace small mobile jump-link targets with a minimum 44px touch height.
37. Consolidate duplicated mobile `.main-content` padding rules.
38. Consolidate duplicated mobile navigation grid rules.
39. Remove broad `overflow-x: hidden` where it masks real overflow.
40. Keep Back to Top visible above the fixed mobile navigation.
41. Add safe-area-aware spacing for fixed add and Back to Top controls.
42. Add `aria-live` announcements for food, GIF, and activity async states.
43. Add modal focus trapping and focus return for emoji and practice dialogs.
44. Add complete tab/panel semantics to Write/Preview and other tab-like controls.
45. Add labels to inputs that currently rely only on placeholders.
46. Add a text/table fallback beside chart-like visualizations.
47. Change one-reading Body state from “0 change” to an explicitly unavailable trend state.
48. Add Body date-range controls and metric-specific trend views.
49. Add a unified mobile Body capture sheet for measurement, composition, photo, and check-in context.
50. Add Body composition records without fabricating unavailable device stages.
51. Add photo capture method, camera-facing, thumbnail, and stable association metadata.
52. Add weight edit/delete actions and timestamp ordering.
53. Add data completeness indicators to Body and Sleep.
54. Add clear Profile field-level explanations for sensitive values.
55. Derive age from birth date when present and explain precedence.
56. Move medication/symptom/data intentions to their correct destination screens.
57. Replace “Profile completeness” with non-judgmental personalization language.
58. Add priority, review date, status, and “why this matters” editing for intentions.
59. Add Profile fieldsets for identity, body context, preferences, and focus.
60. Add privacy status directly to Profile, not only Settings.
61. Add an explicit external-share confirmation and remove sensitive URL query composition.
62. Add Profile image support with local-only storage and deletion.
63. Add Today quick actions for sleep, check-in, and intention-specific logging.
64. Connect focus areas to visible Today modules and actionable next steps.
65. Add sleep data to Patterns and weekly review views.
66. Add explicit “stages unavailable” states rather than empty stage charts.
67. Add split-sleep and nap summaries to Today.
68. Add Health Connect readiness messaging without implying an active connection.
69. Add medication adherence and effects records to the cross-domain record view.
70. Add hydration/caffeine context as a separate, optional first-class record.
71. Add capture provenance and stable source-record IDs across mirrored records.
72. Complete deletion cascade coverage for every capture type.
73. Add export/import migration tests with populated pre-upgrade records.
74. Add route/history synchronization for browser back/forward and deep links.
75. Run the final visual matrix at 360, 390, 430, tablet, and desktop across all themes, palettes, and imagery modes.

## QA protocol

Every item that changes layout or color must be checked in Midnight, Dawn, and Forest; Harvest gold, Soft coral, and Evening violet; and Growth field, Orbit lines, Soft haze, and Quiet plain. Mobile checks must include 360px, 390px, and 430px widths. A screenshot is only considered valid when the page can be scrolled end-to-end, opened forms land in view, and no action is clipped or hidden behind fixed navigation.
