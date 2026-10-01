import { describe, expect, it } from 'vitest'
import { dedupeHealthRecords, normalizeProviderRecord, nextSyncBackoffMs } from './integrations'

describe('integration normalization', () => {
  it('preserves provider identity and creates a stable dedupe key', () => {
    const record = normalizeProviderRecord({
      domain: 'activity',
      kind: 'daily-summary',
      metric: 'steps',
      value: 4200,
      unit: 'steps',
      startAt: '2026-09-29T00:00:00.000Z',
      localDate: '2026-09-29',
      source: 'provider',
      provider: 'fitbit',
      externalRecordId: 'daily-29',
    })

    expect(record.provenance.provider).toBe('fitbit')
    expect(record.dedupeKey).toBe('provider:fitbit:daily-29')
    expect(record.isDerived).toBe(false)
  })

  it('keeps the preferred provider when records overlap', () => {
    const first = normalizeProviderRecord({
      domain: 'activity',
      kind: 'daily-summary',
      metric: 'steps',
      value: 4000,
      unit: 'steps',
      startAt: '2026-09-29T00:00:00.000Z',
      localDate: '2026-09-29',
      source: 'provider',
      provider: 'fitbit',
      externalRecordId: 'fitbit-29',
    })
    const second = normalizeProviderRecord({
      domain: 'activity',
      kind: 'daily-summary',
      metric: 'steps',
      value: 4100,
      unit: 'steps',
      startAt: first.startAt,
      localDate: first.localDate,
      source: 'provider',
      provider: 'google-health-api',
      externalRecordId: 'google-29',
    })

    // A provider-specific external ID is the primary identity. The normalized
    // layer does not silently collapse two distinct provider records.
    expect(dedupeHealthRecords([first, second]).records).toHaveLength(2)

    const duplicate = normalizeProviderRecord({
      domain: second.domain,
      kind: second.kind,
      metric: second.metric,
      value: second.value,
      unit: second.unit,
      startAt: second.startAt,
      localDate: second.localDate,
      source: 'provider',
      provider: 'google-health-api',
      externalRecordId: 'google-29',
    })
    const result = dedupeHealthRecords([second, duplicate])
    expect(result.records).toHaveLength(1)
    expect(result.duplicatesSkipped).toBe(1)
  })

  it('caps exponential retry backoff at one day', () => {
    expect(nextSyncBackoffMs(0)).toBe(30_000)
    expect(nextSyncBackoffMs(3)).toBe(240_000)
    expect(nextSyncBackoffMs(99)).toBe(86_400_000)
  })
})
