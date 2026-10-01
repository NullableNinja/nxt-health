import type {
  ActivityLevel,
  DailyNutrition,
  Goal,
  MetabolicEstimate,
  MetabolicSummary,
  Profile,
  SexForEquation,
  WeightEntry,
} from './models'

export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54

const activityFactors: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
}

export function poundsToKg(pounds: number): number {
  return pounds * KG_PER_LB
}

export function kgToPounds(kg: number): number {
  return kg / KG_PER_LB
}

export function inchesToCm(inches: number): number {
  return inches * CM_PER_IN
}

export function cmToInches(cm: number): number {
  return cm / CM_PER_IN
}

export function feetAndInchesToCm(feet: number, inches: number): number {
  return inchesToCm(feet * 12 + inches)
}

export function round(value: number, digits = 0): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function calculateAge(
  profile: Pick<Profile, 'birthDate' | 'age'>,
  today = new Date(),
): number | undefined {
  if (profile.birthDate) {
    const birth = new Date(`${profile.birthDate}T00:00:00`)
    let age = today.getFullYear() - birth.getFullYear()
    const birthdayPassed =
      today.getMonth() > birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate())
    if (!birthdayPassed) age -= 1
    return age >= 0 ? age : undefined
  }
  return profile.age !== undefined && profile.age >= 0 ? profile.age : undefined
}

function sexOffset(sex: SexForEquation, female: number, male: number): number | undefined {
  if (sex === 'female') return female
  if (sex === 'male') return male
  return undefined
}

export function estimateRmr(
  profile: Profile,
  weightKg: number,
  bodyFatPercent?: number,
): MetabolicEstimate[] {
  const age = calculateAge(profile)
  if (age === undefined || profile.heightCm === undefined) return []
  const sex = profile.sexForEquation
  const estimates: MetabolicEstimate[] = []
  const mifflinOffset = sexOffset(sex, -161, 5)
  if (mifflinOffset !== undefined) {
    estimates.push({
      method: 'Mifflin–St Jeor',
      valueKcal: 10 * weightKg + 6.25 * profile.heightCm - 5 * age + mifflinOffset,
      source: 'equation',
      explanation: 'Uses weight, height, age, and sex where required by the equation.',
    })
  }
  const revisedOffset = sexOffset(sex, 447.593, 88.362)
  const revisedWeight = sex === 'female' ? 9.247 : 13.397
  const revisedHeight = sex === 'female' ? 3.098 : 4.799
  const revisedAge = sex === 'female' ? 4.33 : 5.677
  if (revisedOffset !== undefined) {
    estimates.push({
      method: 'Revised Harris–Benedict',
      valueKcal:
        revisedOffset +
        revisedWeight * weightKg +
        revisedHeight * profile.heightCm -
        revisedAge * age,
      source: 'equation',
      explanation: 'A population equation shown alongside other methods for transparency.',
    })
  }
  const originalOffset = sexOffset(sex, 655.1, 66.47)
  const originalWeight = sex === 'female' ? 9.563 : 13.75
  const originalHeight = sex === 'female' ? 1.85 : 5.003
  const originalAge = sex === 'female' ? 4.676 : 6.755
  if (originalOffset !== undefined) {
    estimates.push({
      method: 'Original Harris–Benedict',
      valueKcal:
        originalOffset +
        originalWeight * weightKg +
        originalHeight * profile.heightCm -
        originalAge * age,
      source: 'equation',
      explanation: 'An older population equation retained for comparison, not certainty.',
    })
  }
  const owenBase = sexOffset(sex, 795, 879)
  const owenWeight = sex === 'female' ? 7.18 : 10.2
  if (owenBase !== undefined) {
    estimates.push({
      method: 'Owen',
      valueKcal: owenBase + owenWeight * weightKg,
      source: 'equation',
      explanation: 'Uses body weight and sex-specific constants; height is not used.',
    })
  }
  if (bodyFatPercent !== undefined && bodyFatPercent > 0 && bodyFatPercent < 70) {
    const leanMassKg = weightKg * (1 - bodyFatPercent / 100)
    estimates.push({
      method: 'Cunningham',
      valueKcal: 500 + 22 * leanMassKg,
      source: 'equation',
      explanation: 'Uses estimated lean mass from the supplied body-fat percentage.',
    })
  }
  return estimates.map((estimate) => ({ ...estimate, valueKcal: Math.max(0, estimate.valueKcal) }))
}

export function buildMetabolicSummary(
  profile: Profile,
  weightKg: number | undefined,
  goal: Goal | undefined,
  bodyFatPercent?: number,
): MetabolicSummary {
  if (weightKg === undefined) return { rmr: [] }
  const rmr = estimateRmr(profile, weightKg, bodyFatPercent)
  if (rmr.length === 0) return { rmr }
  const ensembleValue = rmr.reduce((sum, estimate) => sum + estimate.valueKcal, 0) / rmr.length
  const tdee = ensembleValue * activityFactors[profile.activityLevel]
  const calorieTarget = targetCalories(tdee, goal)
  return {
    rmr,
    ensembleRmr: {
      method: 'Transparent ensemble',
      valueKcal: ensembleValue,
      source: 'ensemble',
      explanation:
        'The mean of available equations; it is an initial estimate, not a laboratory measurement.',
    },
    estimatedTdee: tdee,
    calorieTarget,
    practicalRange: [Math.max(1200, calorieTarget - 100), calorieTarget + 100],
  }
}

export function targetCalories(tdee: number, goal?: Goal): number {
  if (!goal || goal.kind === 'maintain-weight' || goal.kind === 'understand-data')
    return Math.round(tdee)
  if (goal.kind === 'lose-weight') return Math.round(Math.max(1200, tdee - 400))
  if (goal.kind === 'gain-weight') return Math.round(tdee + 250)
  return Math.round(tdee)
}

export interface WeightTrend {
  latestKg?: number
  averageKg?: number
  changeKg?: number
  rateKgPerWeek?: number
  confidence: 'insufficient' | 'early' | 'developing' | 'strong'
}

export function calculateWeightTrend(entries: WeightEntry[]): WeightTrend {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length === 0) return { confidence: 'insufficient' }
  const values = sorted.map((entry) => entry.weightKg)
  const latest = sorted.at(-1)
  const first = sorted[0]
  const days = (new Date(latest!.date).getTime() - new Date(first.date).getTime()) / 86_400_000
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  let rateKgPerWeek: number | undefined
  if (days >= 7 && sorted.length >= 3) {
    const xMean =
      sorted.reduce((sum, entry) => sum + new Date(entry.date).getTime(), 0) / sorted.length
    const yMean = mean
    const numerator = sorted.reduce(
      (sum, entry) => sum + (new Date(entry.date).getTime() - xMean) * (entry.weightKg - yMean),
      0,
    )
    const denominator = sorted.reduce(
      (sum, entry) => sum + (new Date(entry.date).getTime() - xMean) ** 2,
      0,
    )
    rateKgPerWeek = denominator === 0 ? undefined : (numerator / denominator) * 7 * 86_400_000
  }
  return {
    latestKg: latest?.weightKg,
    averageKg: mean,
    changeKg: latest!.weightKg - first.weightKg,
    rateKgPerWeek,
    confidence:
      sorted.length >= 8 && days >= 28
        ? 'strong'
        : sorted.length >= 3 && days >= 7
          ? 'developing'
          : 'early',
  }
}

export function projectGoalDate(
  currentKg: number | undefined,
  goal: Goal | undefined,
  trend: WeightTrend,
): string | undefined {
  if (
    currentKg === undefined ||
    goal?.targetWeightKg === undefined ||
    trend.rateKgPerWeek === undefined
  )
    return undefined
  const distance = goal.targetWeightKg - currentKg
  if (distance === 0 || Math.sign(distance) !== Math.sign(trend.rateKgPerWeek)) return undefined
  const weeks = Math.abs(distance / trend.rateKgPerWeek)
  if (!Number.isFinite(weeks) || weeks > 520) return undefined
  const date = new Date()
  date.setDate(date.getDate() + Math.round(weeks * 7))
  return date.toISOString().slice(0, 10)
}

export function sumNutrition(
  logs: Array<Pick<DailyNutrition, keyof DailyNutrition>>,
): DailyNutrition {
  return logs.reduce(
    (total, log) => ({
      calories: total.calories + log.calories,
      proteinG: total.proteinG + log.proteinG,
      carbsG: total.carbsG + log.carbsG,
      fatG: total.fatG + log.fatG,
      fiberG: total.fiberG + log.fiberG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  )
}
