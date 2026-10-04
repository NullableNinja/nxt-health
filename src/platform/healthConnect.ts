import { registerPlugin } from '@capacitor/core'

export const HEALTH_CONNECT_DATA_TYPES = [
  'steps',
  'exercise',
  'distance',
  'activeCalories',
  'weight',
  'bodyFat',
  'heartRate',
  'restingHeartRate',
  'sleep',
] as const

export type HealthConnectDataType = (typeof HEALTH_CONNECT_DATA_TYPES)[number]

export interface HealthConnectAvailability {
  available: boolean
  status: 'available' | 'provider-update-required' | 'unavailable'
  sdkStatus: number
  providerPackage: string
}

export interface HealthConnectRecord {
  recordType: HealthConnectDataType
  recordId: string
  clientRecordId?: string
  clientRecordVersion: number
  sourceApp?: string
  deviceName?: string
  lastModifiedTime: string
  metric: string
  value?: number
  unit: string
  startTime: string
  endTime?: string
  localDate: string
  title?: string
  notes?: string
  exerciseType?: number
  samples?: Array<{ time: string; bpm: number }>
  stages?: Array<{ startTime: string; endTime: string; stage: number }>
}

export interface HealthConnectPlugin {
  isAvailable(): Promise<HealthConnectAvailability>
  getPermissions(): Promise<{ permissions: string[]; dataTypes: HealthConnectDataType[] }>
  requestPermissions(input: {
    dataTypes: HealthConnectDataType[]
  }): Promise<{ granted: string[]; requested: string[]; missing: string[] }>
  openSettings(): Promise<void>
  read(input: { startTime: string; endTime: string; dataTypes: HealthConnectDataType[] }): Promise<{
    records: HealthConnectRecord[]
    dataTypes: HealthConnectDataType[]
    startTime: string
    endTime: string
  }>
}

export const HealthConnect = registerPlugin<HealthConnectPlugin>('HealthConnect')
