import { describe, expect, it } from 'vitest'
import { RxNormProvider } from './medicationProvider'

describe('RxNorm provider', () => {
  it('sends only the normalized search term and maps concepts', async () => {
    let requestedUrl = ''
    const provider = new RxNormProvider(async (url) => {
      requestedUrl = url
      return new Response(
        JSON.stringify({
          drugGroup: {
            conceptGroup: [
              {
                conceptProperties: [
                  { rxcui: '123', name: 'Example 10 MG Tablet', synonym: 'Example' },
                  { rxcui: '123', name: 'Duplicate result' },
                ],
              },
            ],
          },
        }),
        { status: 200 },
      )
    })

    const results = await provider.search(' example ')

    expect(requestedUrl).toContain('/REST/drugs.json?name=example')
    expect(results).toEqual([
      {
        id: 'rxnorm-123',
        name: 'Example 10 MG Tablet',
        synonym: 'Example',
        source: 'rxnorm',
        sourceId: '123',
        sourceLabel: 'NIH RxNorm',
      },
    ])
  })

  it('surfaces provider failures', async () => {
    const provider = new RxNormProvider(async () => new Response('', { status: 503 }))
    await expect(provider.search('unavailable')).rejects.toThrow('RxNorm medication lookup failed')
  })
})
