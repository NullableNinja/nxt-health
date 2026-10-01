import { describe, expect, it } from 'vitest'
import {
  buildMetabolicSummary,
  calculateWeightTrend,
  cmToInches,
  feetAndInchesToCm,
  inchesToCm,
  kgToPounds,
  poundsToKg,
} from './calculations'
import type { Goal, Profile, WeightEntry } from './models'

const profile: Profile = {
  id: 'p',
  displayName: 'Test',
  age: 35,
  sexForEquation: 'female',
  heightCm: 165,
  unitSystem: 'metric',
  activityLevel: 'moderate',
  createdAt: '',
  updatedAt: '',
}

describe('unit conversions', () => {
  it('round trips common units', () => {
    expect(poundsToKg(150)).toBeCloseTo(68.0389, 3)
    expect(kgToPounds(68.0388555)).toBeCloseTo(150, 3)
    expect(inchesToCm(65)).toBeCloseTo(165.1, 3)
    expect(cmToInches(165.1)).toBeCloseTo(65, 3)
    expect(feetAndInchesToCm(5, 10)).toBeCloseTo(177.8, 3)
  })
})

describe('metabolic engine', () => {
  it('returns transparent equation and target estimates', () => {
    const goal: Goal = {
      id: 'g',
      kind: 'lose-weight',
      label: 'Lose weight',
      active: true,
      createdAt: '',
    }
    const summary = buildMetabolicSummary(profile, 80, goal)
    expect(summary.rmr.length).toBeGreaterThanOrEqual(4)
    expect(summary.ensembleRmr?.source).toBe('ensemble')
    expect(summary.estimatedTdee!).toBeGreaterThan(summary.ensembleRmr!.valueKcal)
    expect(summary.calorieTarget!).toBeLessThan(summary.estimatedTdee!)
  })
})

describe('weight trend', () => {
  it('uses regression instead of a single noisy change', () => {
    const entries: WeightEntry[] = [
      { id: '1', date: '2026-01-01', weightKg: 80, source: 'manual' },
      { id: '2', date: '2026-01-08', weightKg: 79.5, source: 'manual' },
      { id: '3', date: '2026-01-15', weightKg: 79, source: 'manual' },
    ]
    const trend = calculateWeightTrend(entries)
    expect(trend.rateKgPerWeek).toBeCloseTo(-0.5, 4)
    expect(trend.confidence).toBe('developing')
  })
})
