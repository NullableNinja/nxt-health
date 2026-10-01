import type {
  DataSource,
  HealthRecordDomain,
  IntegrationProviderId,
  NormalizedHealthRecord,
  SourcePreference,
} from './models'

export interface ProviderRecordInput {
  domain: HealthRecordDomain
  kind: NormalizedHealthRecord['kind']
  metric: string
  value?: number
  unit?: NormalizedHealthRecord['unit']
  text?: string
  startAt: string
  endAt?: string
  localDate: string
  source: DataSource
  provider?: IntegrationProviderId
  externalRecordId?: string
  externalVersion?: string
  deviceName?: string
  sourceApp?: string
  timezone?: string
  tags?: string[]
  metadata?: NormalizedHealthRecord['metadata']
  isDerived?: boolean
}

const stablePart = (value: string | number | undefined): string =>
  value === undefined ? '' : String(value).trim().toLowerCase()

export function buildDedupeKey(input: ProviderRecordInput): string {
  if (input.provider && input.externalRecordId) {
    return `provider:${input.provider}:${stablePart(input.externalRecordId)}`
  }

  return [
    input.domain,
    input.kind,
    input.metric,
    input.localDate,
    input.startAt,
    input.endAt,
    input.value,
    input.unit,
  ]
    .map(stablePart)
    .join('|')
}

export function normalizeProviderRecord(
  input: ProviderRecordInput,
  now = new Date().toISOString(),
): NormalizedHealthRecord {
  return {
    id: `health-${buildDedupeKey(input)}`,
    domain: input.domain,
    kind: input.kind,
    metric: input.metric,
    value: input.value,
    unit: input.unit,
    text: input.text,
    startAt: input.startAt,
    endAt: input.endAt,
    localDate: input.localDate,
    provenance: {
      source: input.source,
      provider: input.provider,
      externalRecordId: input.externalRecordId,
      externalVersion: input.externalVersion,
      deviceName: input.deviceName,
      sourceApp: input.sourceApp,
      timezone: input.timezone,
    },
    tags: input.tags,
    metadata: input.metadata,
    isDerived: input.isDerived ?? input.source === 'derived',
    dedupeKey: buildDedupeKey(input),
    createdAt: now,
    updatedAt: now,
  }
}

const providerRank = (
  record: NormalizedHealthRecord,
  preference: SourcePreference | undefined,
): number => {
  if (preference?.preferManual && record.provenance.source === 'manual') return -1
  if (!record.provenance.provider || !preference)
    return preference ? preference.providerOrder.length + 1 : 0
  const rank = preference.providerOrder.indexOf(record.provenance.provider)
  return rank === -1 ? preference.providerOrder.length + 1 : rank
}

export interface DedupeResult {
  records: NormalizedHealthRecord[]
  duplicatesSkipped: number
  duplicateIds: string[]
}

export function dedupeHealthRecords(
  records: NormalizedHealthRecord[],
  preferences: SourcePreference[] = [],
): DedupeResult {
  const byKey = new Map<string, NormalizedHealthRecord>()
  const duplicateIds: string[] = []

  for (const record of records) {
    const preference = preferences.find(
      (candidate) => candidate.domain === record.domain && candidate.metric === record.metric,
    )
    const existing = byKey.get(record.dedupeKey)
    if (!existing) {
      byKey.set(record.dedupeKey, record)
      continue
    }

    if (providerRank(record, preference) < providerRank(existing, preference)) {
      duplicateIds.push(existing.id)
      byKey.set(record.dedupeKey, record)
    } else {
      duplicateIds.push(record.id)
    }
  }

  return {
    records: [...byKey.values()],
    duplicatesSkipped: duplicateIds.length,
    duplicateIds,
  }
}

export function nextSyncBackoffMs(consecutiveFailures: number): number {
  const safeFailures = Math.max(0, Math.min(consecutiveFailures, 12))
  return Math.min(24 * 60 * 60 * 1000, 30_000 * 2 ** safeFailures)
}
