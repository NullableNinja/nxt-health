import { describe, expect, it } from 'vitest'
import { calculateDailyNutritionTotals, normalizeFoodEntry, summarizeMeals } from './nutrition'

describe('nutrition helpers', () => {
  it('normalizes alternate nutrient names and numeric strings', () => {
    expect(
      normalizeFoodEntry({
        date: '2026-09-28',
        name: 'Oats',
        meal: 'Breakfast',
        servings: '2',
        perServing: {
          energyKcal: '150',
          protein: '5',
          carbohydrates: 27,
          fat: '3',
          dietaryFiber: '4',
        },
      }),
    ).toMatchObject({
      foodName: 'Oats',
      servings: 2,
      calories: 300,
      proteinG: 10,
      carbsG: 54,
      fatG: 6,
      fiberG: 8,
    })
  })

  it('keeps direct food-log totals from being multiplied by servings', () => {
    expect(
      normalizeFoodEntry({
        date: '2026-09-28',
        foodName: 'Yogurt',
        meal: 'Breakfast',
        servings: 2,
        calories: 180,
        proteinG: 12,
        carbsG: 20,
        fatG: 4,
        fiberG: 0,
      }),
    ).toMatchObject({ calories: 180, proteinG: 12, carbsG: 20, fatG: 4, fiberG: 0 })
  })

  it('uses zero for missing or invalid nutrients without creating NaN', () => {
    const normalized = normalizeFoodEntry({
      foodName: 'Tea',
      calories: 'not-a-number',
      proteinG: null,
    })
    expect(normalized).toMatchObject({
      foodName: 'Tea',
      meal: 'Uncategorized',
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
    })
    expect(
      Object.values(normalized).every(
        (value) => typeof value !== 'number' || Number.isFinite(value),
      ),
    ).toBe(true)
  })

  it('calculates date-scoped daily totals', () => {
    expect(
      calculateDailyNutritionTotals(
        [
          { date: '2026-09-28', calories: 400, proteinG: 20 },
          { date: '2026-09-28', calories: 250, carbsG: 30 },
          { date: '2026-09-27', calories: 999 },
        ],
        '2026-09-28',
      ),
    ).toEqual({ calories: 650, proteinG: 20, carbsG: 30, fatG: 0, fiberG: 0 })
  })

  it('groups meal summaries in first-seen order', () => {
    expect(
      summarizeMeals([
        { meal: 'Lunch', calories: 500, servings: 1 },
        { meal: 'Breakfast', calories: 300, servings: 1 },
        { meal: 'Lunch', calories: 200, servings: 0.5 },
      ]),
    ).toEqual([
      {
        meal: 'Lunch',
        entryCount: 2,
        servings: 1.5,
        totals: { calories: 700, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
      },
      {
        meal: 'Breakfast',
        entryCount: 1,
        servings: 1,
        totals: { calories: 300, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
      },
    ])
  })
})
