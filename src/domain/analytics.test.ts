import { describe, expect, it } from 'vitest'
import { captureDomain } from './analytics'

describe('captureDomain', () => {
  it('keeps mindfulness practice records in the Mind domain', () => {
    expect(
      captureDomain({
        id: 'mind-1',
        type: 'custom',
        occurredAt: '2026-09-28T12:00:00.000Z',
        title: 'Mind practice',
        source: 'manual',
        context: 'mindfulness',
        createdAt: '2026-09-28T12:00:00.000Z',
        updatedAt: '2026-09-28T12:00:00.000Z',
      }),
    ).toBe('mind')
  })
})
