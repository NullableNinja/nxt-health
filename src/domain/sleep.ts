import type { SleepQuality, SleepSession } from './models'

export function sleepDurationMinutes(startAt: string, endAt: string): number {
  const start = new Date(startAt).getTime()
  let end = new Date(endAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  if (end <= start) end += 24 * 60 * 60 * 1000
  return Math.max(0, Math.round((end - start) / 60000))
}

export function formatSleepDuration(minutes: number | undefined): string {
  if (!minutes || minutes < 1) return '—'
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`
}

export function sleepSummary(sessions: SleepSession[]) {
  const primary = sessions.filter((session) => session.kind === 'primary')
  const durations = primary.map((session) => session.durationMinutes).filter((value) => value > 0)
  const averageMinutes = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : undefined
  const quality = primary
    .map((session) => session.quality)
    .filter((value): value is SleepQuality => value !== undefined)
  const averageQuality = quality.length
    ? Math.round((quality.reduce((sum, value) => sum + value, 0) / quality.length) * 10) / 10
    : undefined
  const bedtime = primary
    .map((session) => new Date(session.startAt).getTime())
    .filter(Number.isFinite)
  const wakeTimes = primary
    .map((session) => new Date(session.endAt).getTime())
    .filter(Number.isFinite)
  const bedtimeRange =
    bedtime.length > 1
      ? Math.round((Math.max(...bedtime) - Math.min(...bedtime)) / 60000)
      : undefined
  const wakeRange =
    wakeTimes.length > 1
      ? Math.round((Math.max(...wakeTimes) - Math.min(...wakeTimes)) / 60000)
      : undefined
  return { primary, durations, averageMinutes, averageQuality, bedtimeRange, wakeRange }
}

export function sleepInsight(summary: ReturnType<typeof sleepSummary>): string {
  if (!summary.averageMinutes) return 'Log a few nights to see a useful sleep pattern.'
  if (summary.averageMinutes < 420)
    return 'Your recent average is below seven hours. Treat this as context, not a pass/fail score.'
  if (summary.bedtimeRange !== undefined && summary.bedtimeRange > 120)
    return 'Your sleep timing is moving around. A steadier wind-down window may be useful if it feels supportive.'
  if (summary.averageQuality !== undefined && summary.averageQuality <= 2.5)
    return 'Duration is only one signal. Your quality notes can help distinguish time asleep from how restorative it felt.'
  return 'Your recent sleep record is becoming more useful. Look for how rest connects with energy and focus rather than chasing a perfect number.'
}
