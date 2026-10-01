import { describe, expect, it } from 'vitest'
import { OpenFdaMedicationFactsProvider } from './medicationFactsProvider'

describe('medication facts provider', () => {
  it('reads curated sections from an FDA label matched by RxCUI', async () => {
    let requestedUrl = ''
    const provider = new OpenFdaMedicationFactsProvider({
      fetcher: async (url) => {
        requestedUrl = url
        return new Response(
          JSON.stringify({
            results: [
              {
                effective_time: '20260101',
                openfda: { generic_name: ['example medicine'], rxcui: ['12345'] },
                indications_and_usage: ['Used for an example condition.'],
                warnings: ['Ask a clinician before use.'],
                adverse_reactions: ['Headache may occur.'],
              },
            ],
          }),
          { status: 200 },
        )
      },
    })

    const result = await provider.getFacts({ name: 'Example medicine', rxcui: '12345' })

    expect(requestedUrl).toContain('openfda.rxcui.exact%3A12345')
    expect(result?.medicationName).toBe('example medicine')
    expect(result?.sections.map((section) => section.id)).toEqual([
      'purpose',
      'warnings',
      'side-effects',
    ])
  })

  it('returns null when the label endpoint has no matching result', async () => {
    const provider = new OpenFdaMedicationFactsProvider({
      fetcher: async () =>
        new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 }),
    })

    await expect(provider.getFacts({ name: 'Unknown medicine' })).resolves.toBeNull()
  })
})
