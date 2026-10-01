import { describe, expect, it } from 'vitest'
import {
  filterMindPractices,
  findMindPractice,
  mindPracticeCatalog,
  mindPracticeCategories,
  mindSafetyGuidance,
  mindToolkitPrinciples,
  recommendMindPractices,
} from './mind'

describe('mind practice catalog', () => {
  it('covers the optional secular toolkit categories', () => {
    expect(new Set(mindPracticeCatalog.map((practice) => practice.category))).toEqual(
      new Set(mindPracticeCategories),
    )
    expect(mindPracticeCatalog.length).toBeGreaterThanOrEqual(12)
    expect(mindToolkitPrinciples).toMatchObject({
      optional: true,
      secular: true,
      usesStreaks: false,
      usesGuiltLanguage: false,
    })
  })

  it('gives every practice safe, usable guided content', () => {
    for (const practice of mindPracticeCatalog) {
      expect(practice.id).toBeTruthy()
      expect(practice.title).toBeTruthy()
      expect(practice.summary).toBeTruthy()
      expect(practice.invitation).toBeTruthy()
      expect(practice.durationMinutes).toBeGreaterThan(0)
      expect(practice.steps.length).toBeGreaterThan(0)
      expect(practice.cautions.length).toBeGreaterThan(0)
      expect(practice.steps.every((step) => step.id && step.title && step.instruction)).toBe(true)

      const content = JSON.stringify(practice).toLocaleLowerCase()
      expect(content).not.toMatch(/\b(streak|guilt|must|required)\b/)
    }

    expect(mindSafetyGuidance.invitation).toMatch(/optional/i)
    expect(mindSafetyGuidance.stop).toMatch(/stop/i)
    expect(mindSafetyGuidance.scope).toMatch(/not medical care/i)
  })

  it('finds a practice without coupling callers to the catalog shape', () => {
    expect(findMindPractice('observing-thoughts')?.category).toBe('observing-thoughts')
    expect(findMindPractice('does-not-exist')).toBeUndefined()
  })
})

describe('mind practice filtering and recommendations', () => {
  it('filters by category, format, duration, and query', () => {
    const shortBreath = filterMindPractices({ category: 'breath', maxDurationMinutes: 3 })
    expect(shortBreath.length).toBeGreaterThan(0)
    expect(
      shortBreath.every(
        (practice) => practice.category === 'breath' && practice.durationMinutes <= 3,
      ),
    ).toBe(true)

    const reflection = filterMindPractices({ format: 'reflection', query: 'meaning' })
    expect(reflection.length).toBeGreaterThan(0)
    expect(reflection.every((practice) => practice.format === 'reflection')).toBe(true)
  })

  it('supports include and exclude lists while preserving catalog order', () => {
    const result = filterMindPractices({
      includeIds: ['one-minute-pause', 'paced-breathing'],
      excludeIds: ['paced-breathing'],
    })
    expect(result.map((practice) => practice.id)).toEqual(['one-minute-pause'])
  })

  it('recommends deterministically and respects preferences without streak logic', () => {
    const options = { maxDurationMinutes: 3, preferredIds: ['extended-exhale'], limit: 3 }
    const first = recommendMindPractices(options).map((practice) => practice.id)
    const second = recommendMindPractices(options).map((practice) => practice.id)

    expect(first).toEqual(second)
    expect(first[0]).toBe('extended-exhale')
    expect(first).toHaveLength(3)
    expect(
      recommendMindPractices({ excludeIds: ['one-minute-pause'], limit: 20 }),
    ).not.toContainEqual(expect.objectContaining({ id: 'one-minute-pause' }))
  })
})
