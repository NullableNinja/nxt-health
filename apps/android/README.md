# Android client boundary

This directory is reserved for the future Capacitor Android host. The web app should remain the shared product surface, while this host supplies explicit native implementations for barcode scanning, Health Connect, notifications, secure storage, camera, and background synchronization.

Do not add a second domain model here. Native adapters should implement the interfaces in `src/platform` and the shared repositories/domain calculations should remain authoritative.

## Current status

There is no Android module, Gradle project, Capacitor host, or Health Connect bridge in this repository yet. The web app must therefore report Android Health Connect as **Android required**, never as connected.

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

The bridge must check device availability and granted permissions on every entry point. Map unavailable, denied, history-limited, and transient states to explicit diagnostics. The first real verification path is a physical Android 14+ device or an Android 13-and-lower device with the Health Connect app installed; it is not verifiable from the desktop browser.
