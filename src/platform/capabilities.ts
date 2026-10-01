/**
 * Native capability boundary for the future Capacitor client.
 *
 * The web implementation intentionally reports unsupported capabilities rather than
 * pretending browser APIs are equivalent to Health Connect or secure native storage.
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
