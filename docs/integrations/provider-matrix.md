# Provider integration matrix

N//XT is currently centered on Android Health Connect. The Connections surface intentionally lists only a real, in-scope integration; cloud-provider and file-import placeholders are not advertised.

| Provider               | Delivery                  | Auth / gate                                                                             | Reads                                                                                               | Writes                      | Current maturity                                                 |
| ---------------------- | ------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| Android Health Connect | Android native, on-device | User-granted native read permissions; Play Health Apps declaration required for release | Steps, exercise, distance, active calories, weight, body fat, heart rate, resting heart rate, sleep | None in the current product | Native bridge implemented; physical-device verification required |

Official references: [Health Connect overview](https://developer.android.com/health-and-fitness/health-connect), [data types](https://developer.android.com/health-and-fitness/health-connect/data-types), and [permissions](https://developer.android.com/health-and-fitness/health-connect/ui/permissions).

## Current boundary

- The browser build cannot connect to Android Health Connect.
- The Android build reads approved data locally and stores normalized records in the app's local database.
- The first sync is limited to the last 30 days.
- Write, background-read, historical-read, and cloud sync are intentionally out of scope for this first integration.
- A physical Android device is required for end-to-end verification.
