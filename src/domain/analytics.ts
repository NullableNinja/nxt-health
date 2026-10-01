import type { CaptureEntry } from './models'

export type PatternDomain = 'body' | 'mind' | 'life' | 'spiritual'

export interface SeriesPoint {
  date: string
  value: number
}

export function captureDomain(entry: CaptureEntry): PatternDomain {
  if (['wellbeing'].includes(entry.type)) return 'mind'
  if (entry.type === 'custom' && entry.context === 'mindfulness') return 'mind'
  if (['life-event', 'medication', 'symptom'].includes(entry.type)) return 'life'
  if (['custom'].includes(entry.type) && entry.payload?.domain === 'spiritual') return 'spiritual'
  return 'body'
}

export function numericSeries(entries: CaptureEntry[], type: CaptureEntry['type']): SeriesPoint[] {
  return entries
    .filter((entry) => entry.type === type && typeof entry.value === 'number')
    .map((entry) => ({ date: entry.occurredAt.slice(0, 10), value: Number(entry.value) }))
}

export function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined
}

export function compareSeries(left: SeriesPoint[], right: SeriesPoint[]) {
  const leftAverage = average(left.map((point) => point.value))
  const rightAverage = average(right.map((point) => point.value))
  return { leftAverage, rightAverage, changedAroundSameTime: left.length > 0 && right.length > 0 }
}
