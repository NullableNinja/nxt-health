import type { DailyNutrition, FoodLogEntry } from './models'

export interface NutritionEntryInput {
  id?: unknown
  date?: unknown
  foodId?: unknown
  foodName?: unknown
  name?: unknown
  meal?: unknown
  servings?: unknown
  calories?: unknown
  proteinG?: unknown
  carbsG?: unknown
  fatG?: unknown
  fiberG?: unknown
  nutrients?: Record<string, unknown>
  perServing?: Record<string, unknown>
  nutrientsPerServing?: Record<string, unknown>
}

export interface NormalizedFoodEntry extends DailyNutrition {
  id?: string
  date: string
  foodId?: string
  foodName: string
  meal: string
  servings: number
}

export interface MealNutritionSummary {
  meal: string
  entryCount: number
  servings: number
  totals: DailyNutrition
}

const nutrientAliases: Record<keyof DailyNutrition, string[]> = {
  calories: ['calories', 'energyKcal', 'energy-kcal', 'energy_kcal', 'energy'],
  proteinG: ['proteinG', 'protein_g', 'protein', 'proteins'],
  carbsG: ['carbsG', 'carbs_g', 'carbs', 'carbohydrates', 'carbohydrate'],
  fatG: ['fatG', 'fat_g', 'fat', 'fats'],
  fiberG: ['fiberG', 'fiber_g', 'fiber', 'dietaryFiber', 'dietary_fiber'],
}

const emptyNutrition = (): DailyNutrition => ({
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
})

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function nonNegativeNumber(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value.replace(/,/g, ''))
        : NaN
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined
}

function firstNumber(records: Record<string, unknown>[], aliases: string[]): number | undefined {
  for (const record of records) {
    for (const alias of aliases) {
      const value = nonNegativeNumber(record[alias])
      if (value !== undefined) return value
    }
  }
  return undefined
}

function readNutrition(
  input: Record<string, unknown>,
  nested: Record<string, unknown>,
): DailyNutrition {
  const totals = emptyNutrition()
  for (const nutrient of Object.keys(totals) as Array<keyof DailyNutrition>) {
    totals[nutrient] = firstNumber([input, nested], nutrientAliases[nutrient]) ?? 0
  }
  return totals
}

function addNutrition(left: DailyNutrition, right: DailyNutrition): DailyNutrition {
  return {
    calories: left.calories + right.calories,
    proteinG: left.proteinG + right.proteinG,
    carbsG: left.carbsG + right.carbsG,
    fatG: left.fatG + right.fatG,
    fiberG: left.fiberG + right.fiberG,
  }
}

function scaleNutrition(nutrition: DailyNutrition, factor: number): DailyNutrition {
  return {
    calories: nutrition.calories * factor,
    proteinG: nutrition.proteinG * factor,
    carbsG: nutrition.carbsG * factor,
    fatG: nutrition.fatG * factor,
    fiberG: nutrition.fiberG * factor,
  }
}

function nutritionOnly(entry: DailyNutrition): DailyNutrition {
  return {
    calories: entry.calories,
    proteinG: entry.proteinG,
    carbsG: entry.carbsG,
    fatG: entry.fatG,
    fiberG: entry.fiberG,
  }
}

/**
 * Converts a food-log-shaped value into stable, non-negative nutrition values.
 * Direct nutrient fields are treated as entry totals. A per-serving block is
 * used only when a corresponding direct nutrient field is absent.
 */
export function normalizeFoodEntry(
  input: NutritionEntryInput | FoodLogEntry | unknown,
): NormalizedFoodEntry {
  const record = asRecord(input)
  const servings = nonNegativeNumber(record.servings) ?? 1
  const directNutrition = readNutrition(record, asRecord(record.nutrients))
  const perServingRecord = asRecord(record.perServing ?? record.nutrientsPerServing)
  const perServingNutrition = readNutrition(perServingRecord, {})
  const directFields = (Object.keys(emptyNutrition()) as Array<keyof DailyNutrition>).map(
    (nutrient) => firstNumber([record, asRecord(record.nutrients)], nutrientAliases[nutrient]),
  )
  const hasDirectNutrient = directFields.some((value) => value !== undefined)
  const totals = hasDirectNutrient ? directNutrition : scaleNutrition(perServingNutrition, servings)

  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : undefined,
    date: text(record.date, ''),
    foodId:
      typeof record.foodId === 'string' && record.foodId.trim() ? record.foodId.trim() : undefined,
    foodName: text(record.foodName ?? record.name, 'Unnamed food'),
    meal: text(record.meal, 'Uncategorized'),
    servings,
    ...totals,
  }
}

export function calculateDailyNutritionTotals(
  entries: readonly (NutritionEntryInput | FoodLogEntry | unknown)[],
  date?: string,
): DailyNutrition {
  return entries
    .map(normalizeFoodEntry)
    .filter((entry) => date === undefined || entry.date === date)
    .reduce((total, entry) => addNutrition(total, entry), emptyNutrition())
}

export function summarizeMeals(
  entries: readonly (NutritionEntryInput | FoodLogEntry | unknown)[],
  date?: string,
): MealNutritionSummary[] {
  const summaries = new Map<string, MealNutritionSummary>()
  for (const entry of entries.map(normalizeFoodEntry)) {
    if (date !== undefined && entry.date !== date) continue
    const existing = summaries.get(entry.meal)
    if (existing) {
      existing.entryCount += 1
      existing.servings += entry.servings
      existing.totals = addNutrition(existing.totals, entry)
    } else {
      summaries.set(entry.meal, {
        meal: entry.meal,
        entryCount: 1,
        servings: entry.servings,
        totals: nutritionOnly(entry),
      })
    }
  }
  return [...summaries.values()]
}
