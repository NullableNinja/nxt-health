import { describe, expect, it } from 'vitest'
import {
  getActivityIntensityBalance,
  getRecentActivityTrend,
  getWeeklyActivityTotals,
  suggestActivityNextStep,
  type ActivitySession,
} from './activity'

const sessions: ActivitySession[] = [
  {
    id: 'walk-1',
    occurredAt: '2026-09-21',
    category: 'walking',
    durationMinutes: 30,
    intensity: 'easy',
  },
  {
    id: 'strength-1',
    occurredAt: '2026-09-23T12:00:00.000Z',
    category: 'strength',
    durationMinutes: 45,
    intensity: 'moderate',
  },
  {
    id: 'mobility-1',
    occurredAt: '2026-09-27',
    category: 'mobility',
    durationMinutes: 15,
    intensity: 'easy',
  },
]

describe('activity domain helpers', () => {
  it('summarizes the Monday-to-Sunday week without mutating sessions', () => {
    const totals = getWeeklyActivityTotals(sessions, '2026-09-24')

    expect(totals.startDate).toBe('2026-09-21')
    expect(totals.endDate).toBe('2026-09-27')
    expect(totals.totalMinutes).toBe(90)
    expect(totals.sessionCount).toBe(3)
    expect(totals.activeDays).toBe(3)
    expect(totals.minutesByCategory).toMatchObject({ walking: 30, strength: 45, mobility: 15 })
    expect(totals.minutesByIntensity).toEqual({ easy: 45, moderate: 45, hard: 0 })
    expect(sessions[0].durationMinutes).toBe(30)
  })

  it('calculates an intensity distribution for a selected range', () => {
    const balance = getActivityIntensityBalance(sessions, {
      startDate: '2026-09-21',
      endDate: '2026-09-27',
    })

    expect(balance.totalMinutes).toBe(90)
    expect(balance.shareByIntensity).toEqual({ easy: 0.5, moderate: 0.5, hard: 0 })
    expect(balance.easyMinutes).toBe(45)
    expect(balance.moderateMinutes).toBe(45)
  })

  it('compares fixed recent and prior windows deterministically', () => {
    const trend = getRecentActivityTrend(
      [
        ...sessions,
        {
          id: 'prior-1',
          occurredAt: '2026-09-07',
          category: 'walking',
          durationMinutes: 60,
          intensity: 'moderate',
        },
      ],
      { referenceDate: '2026-09-27', windowDays: 14 },
    )

    expect(trend.recentRange).toEqual({ startDate: '2026-09-14', endDate: '2026-09-27' })
    expect(trend.priorRange).toEqual({ startDate: '2026-08-31', endDate: '2026-09-13' })
    expect(trend.recentMinutes).toBe(90)
    expect(trend.priorMinutes).toBe(60)
    expect(trend.changePercent).toBe(0.5)
    expect(trend.direction).toBe('increasing')
  })

  it('offers a non-prescriptive suggestion based on the snapshot', () => {
    const weeklyTotals = getWeeklyActivityTotals([], '2026-09-24')
    const intensityBalance = getActivityIntensityBalance([])
    const recentTrend = getRecentActivityTrend([], { referenceDate: '2026-09-24' })

    expect(suggestActivityNextStep({ weeklyTotals, intensityBalance, recentTrend })).toEqual({
      kind: 'start-small',
      title: 'Start with what feels doable',
      message: expect.stringContaining('no need to make it a streak'),
    })
  })

  it('suggests balancing when harder activity dominates', () => {
    const hardSession: ActivitySession = {
      id: 'hard-1',
      occurredAt: '2026-09-24',
      category: 'running',
      durationMinutes: 40,
      intensity: 'hard',
    }
    const weeklyTotals = getWeeklyActivityTotals([hardSession], '2026-09-24')
    const intensityBalance = getActivityIntensityBalance([hardSession])
    const recentTrend = getRecentActivityTrend([hardSession], { referenceDate: '2026-09-24' })

    expect(suggestActivityNextStep({ weeklyTotals, intensityBalance, recentTrend }).kind).toBe(
      'balance-intensity',
    )
  })
})
