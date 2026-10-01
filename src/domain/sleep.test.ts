import { describe, expect, it } from 'vitest'
import { formatSleepDuration, sleepDurationMinutes, sleepInsight, sleepSummary } from './sleep'
import type { SleepSession } from './models'

const session = (overrides: Partial<SleepSession> = {}): SleepSession => ({
  id: crypto.randomUUID(),
  date: '2026-09-29',
  kind: 'primary',
  startAt: '2026-09-28T22:00',
  endAt: '2026-09-29T06:00',
  durationMinutes: 480,
  source: 'manual',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('sleep domain helpers', () => {
  it('handles overnight sessions that cross midnight', () => {
    expect(sleepDurationMinutes('2026-09-28T22:00', '2026-09-29T06:00')).toBe(480)
  })

  it('formats hours and remaining minutes compactly', () => {
    expect(formatSleepDuration(480)).toBe('8h')
    expect(formatSleepDuration(455)).toBe('7h 35m')
  })

  it('summarizes primary sleep without treating naps as nights', () => {
    const summary = sleepSummary([
      session({ quality: 4 }),
      session({
        id: 'second',
        date: '2026-09-28',
        startAt: '2026-09-27T23:00',
        endAt: '2026-09-28T06:00',
        durationMinutes: 420,
        quality: 3,
      }),
      session({ id: 'nap', kind: 'nap', durationMinutes: 30 }),
    ])
    expect(summary.primary).toHaveLength(2)
    expect(summary.averageMinutes).toBe(450)
    expect(summary.averageQuality).toBe(3.5)
    expect(sleepInsight(summary)).toContain('sleep timing')
  })
})
