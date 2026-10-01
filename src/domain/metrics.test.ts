import { describe, expect, it } from 'vitest'
import { getMetricDefinition, metricRegistry } from './metrics'

describe('metric registry', () => {
  it('keeps blood pressure fields explicit and validated', () => {
    const systolic = getMetricDefinition('systolic-blood-pressure')
    expect(systolic.defaultUnit).toBe('mmHg')
    expect(systolic.validate(120)).toBeUndefined()
    expect(systolic.validate(0)).toBeTruthy()
  })

  it('defines privacy metadata for every metric', () => {
    expect(metricRegistry.every((metric) => metric.id && metric.label && metric.domain)).toBe(true)
    expect(getMetricDefinition('custom').privacySensitive).toBe(true)
  })
})
