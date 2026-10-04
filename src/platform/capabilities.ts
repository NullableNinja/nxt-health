import { Capacitor } from '@capacitor/core'

/**
 * Native capability boundary for the Capacitor client.
 *
 * Capabilities stay explicit so the web app and the Android host never pretend that
 * a browser API is equivalent to Health Connect or secure native storage. Individual
 * native adapters can raise these flags only after their bridge is implemented.
 */
export interface PlatformCapabilities {
  readonly isNative: boolean
  readonly canScanBarcode: boolean
  readonly canSyncHealthData: boolean
  readonly canScheduleNotifications: boolean
  readonly canUseSecureStorage: boolean
}

export const webCapabilities: PlatformCapabilities = {
  isNative: false,
  canScanBarcode: false,
  canSyncHealthData: false,
  canScheduleNotifications: false,
  canUseSecureStorage: false,
}

export const nativeCapabilities: PlatformCapabilities = {
  isNative: true,
  canScanBarcode: false,
  canSyncHealthData: true,
  canScheduleNotifications: false,
  canUseSecureStorage: false,
}

export function getPlatformCapabilities(): PlatformCapabilities {
  return Capacitor.isNativePlatform() ? nativeCapabilities : webCapabilities
}
