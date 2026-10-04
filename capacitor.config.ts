import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Provisional application ID. Replace this before publishing to Google Play.
  appId: 'com.nxt.health',
  appName: 'N//XT',
  webDir: 'dist',
  android: {
    path: 'apps/android',
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
