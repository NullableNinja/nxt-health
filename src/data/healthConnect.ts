import { Capacitor } from '@capacitor/core'
import { normalizeProviderRecord, type ProviderRecordInput } from '../domain/integrations'
import type { HealthRecordDomain, HealthRecordKind, HealthRecordUnit } from '../domain/models'
import { healthRecordRepository } from './repositories'
import {
  HEALTH_CONNECT_DATA_TYPES,
  HealthConnect,
  type HealthConnectDataType,
  type HealthConnectRecord,
} from '../platform/healthConnect'

export const healthConnectDataTypes = [...HEALTH_CONNECT_DATA_TYPES]

export function healthConnectIsNative(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform()
}

export async function syncHealthConnect(
  startTime: string,
  endTime: string,
  dataTypes: HealthConnectDataType[] = healthConnectDataTypes,
): Promise<number> {
  const response = await HealthConnect.read({ startTime, endTime, dataTypes })
  const inputs = response.records.flatMap(toProviderInputs)
  if (inputs.length === 0) return 0
  await healthRecordRepository.bulkSave(inputs.map((input) => normalizeProviderRecord(input)))
  return inputs.length
}

function toProviderInputs(record: HealthConnectRecord): ProviderRecordInput[] {
  const base = {
    provider: 'android-health-connect' as const,
    source: 'device' as const,
    externalRecordId: record.recordId,
    externalVersion: String(record.clientRecordVersion),
    sourceApp: record.sourceApp,
    deviceName: record.deviceName,
    startAt: record.startTime,
    endAt: record.endTime,
    localDate: record.localDate,
    metadata: {
      clientRecordId: record.clientRecordId ?? null,
      lastModifiedTime: record.lastModifiedTime,
      exerciseType: record.exerciseType ?? null,
      stages: record.stages ? JSON.stringify(record.stages) : null,
      samples: record.samples ? JSON.stringify(record.samples) : null,
    },
  }

  if (record.recordType === 'heartRate' && record.samples?.length) {
    return record.samples.map((sample) =>
      providerInput(base, {
        domain: 'cardiovascular',
        kind: 'measurement',
        metric: 'heartRate',
        value: sample.bpm,
        unit: 'bpm',
        startAt: sample.time,
        endAt: sample.time,
        externalRecordId: `${record.recordId}:${sample.time}`,
      }),
    )
  }

  const mapping: Record<
    HealthConnectDataType,
    { domain: HealthRecordDomain; kind: HealthRecordKind; metric: string; unit: HealthRecordUnit }
  > = {
    steps: { domain: 'activity', kind: 'daily-summary', metric: 'steps', unit: 'steps' },
    exercise: { domain: 'activity', kind: 'activity', metric: 'exercise', unit: 'text' },
    distance: { domain: 'activity', kind: 'measurement', metric: 'distance', unit: 'meters' },
    activeCalories: {
      domain: 'activity',
      kind: 'daily-summary',
      metric: 'activeCalories',
      unit: 'kcal',
    },
    weight: { domain: 'body', kind: 'measurement', metric: 'weight', unit: 'kilograms' },
    bodyFat: { domain: 'body', kind: 'measurement', metric: 'bodyFat', unit: 'percent' },
    heartRate: { domain: 'cardiovascular', kind: 'measurement', metric: 'heartRate', unit: 'bpm' },
    restingHeartRate: {
      domain: 'cardiovascular',
      kind: 'measurement',
      metric: 'restingHeartRate',
      unit: 'bpm',
    },
    sleep: { domain: 'sleep', kind: 'sleep-session', metric: 'sleep', unit: 'hours' },
  }
  const mapped = mapping[record.recordType]
  return [
    providerInput(base, {
      ...mapped,
      value: record.value,
      text: record.title ?? record.notes,
    }),
  ]
}

function providerInput(
  base: Omit<ProviderRecordInput, 'domain' | 'kind' | 'metric' | 'unit' | 'value' | 'text'>,
  overrides: Pick<ProviderRecordInput, 'domain' | 'kind' | 'metric' | 'unit'> &
    Partial<Pick<ProviderRecordInput, 'value' | 'text' | 'startAt' | 'endAt' | 'externalRecordId'>>,
): ProviderRecordInput {
  return { ...base, ...overrides }
}
