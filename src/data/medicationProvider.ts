export interface MedicationLookupResult {
  id: string
  name: string
  synonym?: string
  source: 'rxnorm'
  sourceId: string
  sourceLabel: string
}

type FetchLike = (input: string) => Promise<Response>

interface RxNormConceptProperty {
  rxcui?: string
  name?: string
  synonym?: string
  tty?: string
}

interface RxNormResponse {
  drugGroup?: {
    conceptGroup?: Array<{
      conceptProperties?: RxNormConceptProperty[]
    }>
  }
}

/** Read-only RxNorm lookup. Only the search term is sent to the provider. */
export class RxNormProvider {
  readonly name = 'RxNorm'
  private readonly baseUrl = 'https://rxnav.nlm.nih.gov/REST'
  private readonly fetcher: FetchLike

  constructor(fetcher: FetchLike = (input) => fetch(input)) {
    this.fetcher = fetcher
  }

  async search(query: string): Promise<MedicationLookupResult[]> {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return []

    const response = await this.fetcher(
      `${this.baseUrl}/drugs.json?name=${encodeURIComponent(normalizedQuery)}`,
    )
    if (!response.ok) throw new Error('RxNorm medication lookup failed')

    const body = (await response.json()) as RxNormResponse
    const concepts = (body.drugGroup?.conceptGroup ?? []).flatMap(
      (group) => group.conceptProperties ?? [],
    )
    const seen = new Set<string>()

    return concepts
      .flatMap((concept): MedicationLookupResult[] => {
        const sourceId = String(concept.rxcui ?? '').trim()
        const name = String(concept.name ?? '').trim()
        if (!sourceId || !name || seen.has(sourceId)) return []
        seen.add(sourceId)
        return [
          {
            id: `rxnorm-${sourceId}`,
            name,
            synonym: String(concept.synonym ?? '').trim() || undefined,
            source: 'rxnorm' as const,
            sourceId,
            sourceLabel: 'NIH RxNorm',
          },
        ]
      })
      .slice(0, 12)
  }
}
