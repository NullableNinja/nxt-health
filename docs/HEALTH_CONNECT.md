# Android Health Connect

N//XT now has a read-only Capacitor bridge for Android Health Connect. The browser build remains intentionally local-only and displays Android required; the Android build can check availability, request scoped read permissions, open Health Connect settings, read approved records, normalize them, and persist them locally.

The product currently advertises only this integration. Other provider/API/file-import placeholders were removed from the Connections surface while N//XT is being built as a Health Connect-centered dashboard.

The initial Android sync reads the last 30 days of steps, exercise, distance, active calories, weight, body fat, heart rate, resting heart rate, and sleep. It does not request write, background-read, or historical-read permissions.
