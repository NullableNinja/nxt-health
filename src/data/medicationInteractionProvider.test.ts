import { describe, expect, it } from 'vitest'
import {
  MedicationInteractionProviderError,
  OpenFdaMedicationInteractionProvider,
  normalizeRxCuiList,
} from './medicationInteractionProvider'

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status })

describe('FDA medication interaction provider', () => {
  it('normalizes RxCUIs and extracts both documented interaction sections', async () => {
    let requestedUrl = ''
    const provider = new OpenFdaMedicationInteractionProvider({
      now: () => new Date('2026-09-30T12:00:00.000Z'),
      fetcher: async (url) => {
        requestedUrl = url
        return jsonResponse({
          results: [
            {
              set_id: 'label-1',
              effective_time: '20260101',
              openfda: {
                rxcui: ['123'],
                generic_name: ['Example'],
              },
              drug_interactions: ['<p>Use caution with Example B.</p>'],
              drug_interactions_table: ['Avoid concurrent use.'],
            },
          ],
        })
      },
    })

    const result = await provider.check([' 00123 ', '123'])
    const query = new URL(requestedUrl).searchParams.get('search')

    expect(query).toBe('openfda.rxcui.exact:(123)')
    expect(result.requestedRxcuis).toEqual(['123'])
    expect(result.coveredRxcuis).toEqual(['123'])
    expect(result.unresolvedRxcuis).toEqual([])
    expect(result.interactions).toEqual([
      {
        rxcui: '123',
        description: 'Use caution with Example B.',
        section: 'drug_interactions',
        labelName: 'Example',
        labelId: 'label-1',
        effectiveTime: '20260101',
        source: 'openfda',
        sourceUrl: requestedUrl,
      },
      {
        rxcui: '123',
        description: 'Avoid concurrent use.',
        section: 'drug_interactions_table',
        labelName: 'Example',
        labelId: 'label-1',
        effectiveTime: '20260101',
        source: 'openfda',
        sourceUrl: requestedUrl,
      },
    ])
    expect(result.source.limitation).toContain('not a complete pairwise')
  })

  it('associates labels with each requested RxCUI and leaves missing ones unresolved', async () => {
    const provider = new OpenFdaMedicationInteractionProvider({
      fetcher: async () =>
        jsonResponse({
          results: [
            {
              openfda: { rxcui: ['10'], brand_name: ['One'] },
              drug_interactions: ['One warning'],
            },
            {
              openfda: { rxcui: ['20'] },
            },
          ],
        }),
    })

    const result = await provider.check([10, '20', '30'])

    expect(result.coveredRxcuis).toEqual(['10', '20'])
    expect(result.unresolvedRxcuis).toEqual(['30'])
    expect(result.interactions).toHaveLength(1)
    expect(result.interactions[0]).toMatchObject({
      rxcui: '10',
      labelName: 'One',
      description: 'One warning',
    })
  })

  it('returns an empty result without calling the provider for an empty list', async () => {
    let calls = 0
    const provider = new OpenFdaMedicationInteractionProvider({
      fetcher: async () => {
        calls += 1
        return jsonResponse({ results: [] })
      },
    })

    const result = await provider.check([])

    expect(calls).toBe(0)
    expect(result).toMatchObject({
      requestedRxcuis: [],
      coveredRxcuis: [],
      unresolvedRxcuis: [],
      interactions: [],
    })
  })

  it('normalizes and validates standalone RxCUI lists', () => {
    expect(normalizeRxCuiList([' 001 ', 2, '2'])).toEqual(['1', '2'])
    expect(() => normalizeRxCuiList(['abc'])).toThrowError(MedicationInteractionProviderError)
    expect(() => normalizeRxCuiList(['0'])).toThrow('Invalid RxCUI')
  })

  it('surfaces HTTP, network, and malformed-response failures clearly', async () => {
    const httpProvider = new OpenFdaMedicationInteractionProvider({
      fetcher: async () => new Response('', { status: 503 }),
    })
    await expect(httpProvider.check(['1'])).rejects.toMatchObject({
      code: 'http-error',
      status: 503,
      rxcuis: ['1'],
    })

    const networkProvider = new OpenFdaMedicationInteractionProvider({
      fetcher: async () => {
        throw new Error('offline')
      },
    })
    await expect(networkProvider.check(['1'])).rejects.toThrow(
      'FDA medication interaction lookup failed: offline',
    )

    const malformedProvider = new OpenFdaMedicationInteractionProvider({
      fetcher: async () => new Response('{"results": "not-an-array"}', { status: 200 }),
    })
    await expect(malformedProvider.check(['1'])).rejects.toMatchObject({
      code: 'invalid-response',
    })
  })

  it('treats a valid no-match response as unresolved rather than as no interaction', async () => {
    const provider = new OpenFdaMedicationInteractionProvider({
      fetcher: async () => new Response('', { status: 404 }),
    })

    const result = await provider.check(['999999'])

    expect(result.interactions).toEqual([])
    expect(result.unresolvedRxcuis).toEqual(['999999'])
    expect(result.source.limitation).toContain('empty result does not prove')
  })
})
