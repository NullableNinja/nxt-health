# Android client

This directory contains the Capacitor Android host. The web app remains the shared product surface, while this host supplies explicit native implementations for barcode scanning, Health Connect, notifications, secure storage, camera, and background synchronization.

Do not add a second domain model here. Native adapters should implement the interfaces in `src/platform` and the shared repositories/domain calculations should remain authoritative.

## Current status

The Capacitor host includes a read-only Health Connect bridge. The web app still reports Android Health Connect as **Android required** in the browser, while the Android build exposes a real Connect/Sync flow after the user grants permissions.

## First native milestone

Create one read-only bridge with these operations:

```text
HealthConnect.isAvailable()
HealthConnect.getPermissions()
HealthConnect.requestPermissions({ dataTypes })
HealthConnect.read({ startTime, endTime, dataTypes })
HealthConnect.openSettings()
```

Start with the least-privilege read set: steps, exercise sessions, distance, active calories, weight, body fat, heart rate, resting heart rate, and sleep. Return the Health Connect record ID, source app/device, UTC timestamps with offsets, canonical units, and a provider revision to the shared normalizer. Do not request write or background permissions until a product feature and sync policy require them.

The bridge checks device availability and granted permissions on every entry point. The initial sync intentionally reads the most recent 30 days; older history requires a separate Health Connect history permission and is not requested yet. The first real verification path is a physical Android 14+ device or an Android 13-and-lower device with the Health Connect app installed; it is not verifiable from the desktop browser.
