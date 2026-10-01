export const ACTIVITY_CATEGORIES = [
  'walking',
  'running',
  'cycling',
  'swimming',
  'strength',
  'mobility',
  'sports',
  'dance',
  'household',
  'mind-body',
  'other',
] as const

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]

export const ACTIVITY_INTENSITIES = ['easy', 'moderate', 'hard'] as const

export type ActivityIntensity = (typeof ACTIVITY_INTENSITIES)[number]

export type ActivitySource = 'manual' | 'imported' | 'device'

export interface ActivitySession {
  id: string
  occurredAt: string
  category: ActivityCategory
  durationMinutes: number
  intensity: ActivityIntensity
  label?: string
  distanceKm?: number
  steps?: number
  averageHeartRate?: number
  estimatedCalories?: number
  note?: string
  source?: ActivitySource
}

export interface ActivityDateRange {
  startDate: string
  endDate: string
}

export interface WeeklyActivityTotals extends ActivityDateRange {
  totalMinutes: number
  sessionCount: number
  activeDays: number
  minutesByCategory: Record<ActivityCategory, number>
  minutesByIntensity: Record<ActivityIntensity, number>
}

export interface ActivityIntensityBalance {
  totalMinutes: number
  minutesByIntensity: Record<ActivityIntensity, number>
  shareByIntensity: Record<ActivityIntensity, number>
  easyMinutes: number
  moderateMinutes: number
  hardMinutes: number
}

export type ActivityTrendDirection = 'increasing' | 'steady' | 'decreasing' | 'not-enough-data'

export interface RecentActivityTrend {
  direction: ActivityTrendDirection
  windowDays: number
  recentRange: ActivityDateRange
  priorRange: ActivityDateRange
  recentMinutes: number
  priorMinutes: number
  recentActiveDays: number
  priorActiveDays: number
  changeMinutes: number
  changePercent?: number
}

export type ActivitySuggestionKind =
  'start-small' | 'balance-intensity' | 'gentle-restart' | 'continue-exploring'

export interface ActivityNextStepSuggestion {
  kind: ActivitySuggestionKind
  title: string
  message: string
}

export interface ActivitySnapshot {
  weeklyTotals: WeeklyActivityTotals
  intensityBalance: ActivityIntensityBalance
  recentTrend: RecentActivityTrend
}

export interface RecentTrendOptions {
  referenceDate: string
  windowDays?: number
}

const DEFAULT_TREND_WINDOW_DAYS = 14
const TREND_STEADY_ABSOLUTE_MINUTES = 10
const TREND_STEADY_RELATIVE_CHANGE = 0.1

function createZeroCategoryMinutes(): Record<ActivityCategory, number> {
  return Object.fromEntries(ACTIVITY_CATEGORIES.map((category) => [category, 0])) as Record<
    ActivityCategory,
    number
  >
}

function createZeroIntensityMinutes(): Record<ActivityIntensity, number> {
  return { easy: 0, moderate: 0, hard: 0 }
}

function parseDateKey(value: string): string {
  const dateKey = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new RangeError(`Expected an ISO date or timestamp, received: ${value}`)
  }

  const parsed = Date.parse(`${dateKey}T00:00:00.000Z`)
  if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== dateKey) {
    throw new RangeError(`Expected a valid ISO date, received: ${value}`)
  }

  return dateKey
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${parseDateKey(dateKey)}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function nonNegativeMinutes(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function sessionDate(session: ActivitySession): string {
  return parseDateKey(session.occurredAt)
}

function sessionsInRange(sessions: ActivitySession[], range: ActivityDateRange): ActivitySession[] {
  const startDate = parseDateKey(range.startDate)
  const endDate = parseDateKey(range.endDate)

  return sessions.filter((session) => {
    const occurredDate = sessionDate(session)
    return occurredDate >= startDate && occurredDate <= endDate
  })
}

function summarizeSessions(sessions: ActivitySession[]): {
  totalMinutes: number
  sessionCount: number
  activeDays: number
  minutesByCategory: Record<ActivityCategory, number>
  minutesByIntensity: Record<ActivityIntensity, number>
} {
  const minutesByCategory = createZeroCategoryMinutes()
  const minutesByIntensity = createZeroIntensityMinutes()
  const activeDates = new Set<string>()
  let totalMinutes = 0

  for (const session of sessions) {
    const minutes = nonNegativeMinutes(session.durationMinutes)
    totalMinutes += minutes
    minutesByCategory[session.category] += minutes
    minutesByIntensity[session.intensity] += minutes
    if (minutes > 0) activeDates.add(sessionDate(session))
  }

  return {
    totalMinutes,
    sessionCount: sessions.length,
    activeDays: activeDates.size,
    minutesByCategory,
    minutesByIntensity,
  }
}

/** Returns the inclusive calendar week containing referenceDate. Weeks start on Monday. */
export function getActivityWeekRange(referenceDate: string): ActivityDateRange {
  const dateKey = parseDateKey(referenceDate)
  const weekday = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay()
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1
  const startDate = addDays(dateKey, -daysFromMonday)
  return { startDate, endDate: addDays(startDate, 6) }
}

export function getWeeklyActivityTotals(
  sessions: ActivitySession[],
  referenceDate: string,
): WeeklyActivityTotals {
  const range = getActivityWeekRange(referenceDate)
  const summary = summarizeSessions(sessionsInRange(sessions, range))
  return { ...range, ...summary }
}

export function getActivityIntensityBalance(
  sessions: ActivitySession[],
  range?: ActivityDateRange,
): ActivityIntensityBalance {
  const summary = summarizeSessions(range ? sessionsInRange(sessions, range) : sessions)
  const totalMinutes = summary.totalMinutes
  const shareByIntensity = {
    easy: totalMinutes ? summary.minutesByIntensity.easy / totalMinutes : 0,
    moderate: totalMinutes ? summary.minutesByIntensity.moderate / totalMinutes : 0,
    hard: totalMinutes ? summary.minutesByIntensity.hard / totalMinutes : 0,
  }

  return {
    totalMinutes,
    minutesByIntensity: summary.minutesByIntensity,
    shareByIntensity,
    easyMinutes: summary.minutesByIntensity.easy,
    moderateMinutes: summary.minutesByIntensity.moderate,
    hardMinutes: summary.minutesByIntensity.hard,
  }
}

export function getRecentActivityTrend(
  sessions: ActivitySession[],
  options: RecentTrendOptions,
): RecentActivityTrend {
  const windowDays = Math.max(1, Math.floor(options.windowDays ?? DEFAULT_TREND_WINDOW_DAYS))
  const referenceDate = parseDateKey(options.referenceDate)
  const recentRange = {
    startDate: addDays(referenceDate, -(windowDays - 1)),
    endDate: referenceDate,
  }
  const priorRange = {
    startDate: addDays(recentRange.startDate, -windowDays),
    endDate: addDays(recentRange.startDate, -1),
  }
  const recentSummary = summarizeSessions(sessionsInRange(sessions, recentRange))
  const priorSummary = summarizeSessions(sessionsInRange(sessions, priorRange))
  const changeMinutes = recentSummary.totalMinutes - priorSummary.totalMinutes
  const comparisonBase = Math.max(priorSummary.totalMinutes, recentSummary.totalMinutes)
  const isInsufficient = recentSummary.totalMinutes === 0 && priorSummary.totalMinutes === 0
  const steadyThreshold = Math.max(
    TREND_STEADY_ABSOLUTE_MINUTES,
    priorSummary.totalMinutes * TREND_STEADY_RELATIVE_CHANGE,
  )
  const direction: ActivityTrendDirection = isInsufficient
    ? 'not-enough-data'
    : Math.abs(changeMinutes) <= steadyThreshold
      ? 'steady'
      : changeMinutes > 0
        ? 'increasing'
        : 'decreasing'

  return {
    direction,
    windowDays,
    recentRange,
    priorRange,
    recentMinutes: recentSummary.totalMinutes,
    priorMinutes: priorSummary.totalMinutes,
    recentActiveDays: recentSummary.activeDays,
    priorActiveDays: priorSummary.activeDays,
    changeMinutes,
    changePercent: priorSummary.totalMinutes
      ? changeMinutes / priorSummary.totalMinutes
      : comparisonBase
        ? undefined
        : undefined,
  }
}

export function suggestActivityNextStep(snapshot: ActivitySnapshot): ActivityNextStepSuggestion {
  const { weeklyTotals, intensityBalance, recentTrend } = snapshot

  if (
    intensityBalance.totalMinutes > 0 &&
    intensityBalance.hardMinutes > intensityBalance.totalMinutes / 2
  ) {
    return {
      kind: 'balance-intensity',
      title: 'Make room for easier movement',
      message:
        'If it feels supportive, balance harder sessions with an easy walk, mobility, or rest day.',
    }
  }

  if (weeklyTotals.totalMinutes === 0) {
    return {
      kind: 'start-small',
      title: 'Start with what feels doable',
      message:
        'A few comfortable minutes of movement can be a useful place to begin. There is no need to make it a streak.',
    }
  }

  if (recentTrend.direction === 'decreasing') {
    return {
      kind: 'gentle-restart',
      title: 'Try a gentle restart',
      message:
        'Your recent activity is quieter than the prior window. Consider one small movement option that fits today.',
    }
  }

  return {
    kind: 'continue-exploring',
    title: 'Keep noticing what works',
    message:
      'Continue with movement you enjoy, or explore a small variation that matches your energy today.',
  }
}
