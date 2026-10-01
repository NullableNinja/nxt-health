import { describe, expect, it } from 'vitest'
import { parseMyFitnessPalCsv } from './myfitnesspal'

describe('parseMyFitnessPalCsv', () => {
  it('parses standard MFP food rows and quoted commas', () => {
    const rows = parseMyFitnessPalCsv(
      'Date,Meal,Food,Calories,Fat (g),Carbohydrates (g),Protein (g),Fiber,Note\n' +
        '09/28/2026,Breakfast,"Oats, rolled",300,8,45,12,6,"Before work"',
    )
    expect(rows).toEqual([
      {
        date: '2026-09-28',
        meal: 'Breakfast',
        foodName: 'Oats, rolled',
        calories: 300,
        fatG: 8,
        carbsG: 45,
        proteinG: 12,
        fiberG: 6,
        note: 'Before work',
      },
    ])
  })

  it('accepts ISO dates and ignores summary rows without a food name', () => {
    const rows = parseMyFitnessPalCsv(
      'entry_date,diary_meal,food,calories,fat,carbs,protein\n2026-09-28,Lunch,Chicken,400,10,20,50\n2026-09-28,Lunch,,400,10,20,50',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].foodName).toBe('Chicken')
  })
})
