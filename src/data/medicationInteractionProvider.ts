/**
 * FDA label-backed medication interaction evidence.
 *
 * Provider choice: openFDA's Drug Product Labeling API. Its documented
 * `drug_interactions` and `drug_interactions_table` fields contain the
 * interaction guidance from Structured Product Labels (SPLs), and labels can
 * be searched by the harmonized `openfda.rxcui` field.
 *
 * This is not a complete pairwise DDI database. A result is label evidence for
 * a medication, not a clinical determination that two medications are safe
 * together. The former RxNav interaction endpoint was discontinued by NLM, so
 * this provider deliberately does not call it or claim that an empty result
 * proves the absence of an interaction.
 *
 * Documentation:
 * - https://open.fda.gov/apis/drug/label/how-to-use-the-endpoint/
 * - https://open.fda.gov/apis/drug/label/searchable-fields/
 * - https://open.fda.gov/apis/openfda-fields/
 */

export type MedicationInteractionSection = 'drug_interactions' | 'drug_interactions_table'

export interface MedicationInteraction {
  /** The requested RxCUI whose FDA label contains this evidence. */
  rxcui: string
  /** Plain text extracted from the FDA label section. */
  description: string
  section: MedicationInteractionSection
  labelName?: string
  labelId?: string
  effectiveTime?: string
  source: 'openfda'
  sourceUrl: string
}

export interface MedicationInteractionResult {
  requestedRxcuis: string[]
  coveredRxcuis: string[]
  unresolvedRxcuis: string[]
  interactions: MedicationInteraction[]
  checkedAt: string
  source: {
    name: 'FDA openFDA Drug Product Labeling'
    endpoint: string
    documentationUrl: string
    limitation: string
  }
}

export type MedicationInteractionProviderErrorCode =
  'invalid-rxcui' | 'request-failed' | 'http-error' | 'invalid-response'

export class MedicationInteractionProviderError extends Error {
  readonly code: MedicationInteractionProviderErrorCode
  readonly rxcuis?: string[]
  readonly status?: number

  constructor(
    message: string,
    code: MedicationInteractionProviderErrorCode,
    options: { rxcuis?: string[]; status?: number } = {},
  ) {
    super(message)
    this.name = 'MedicationInteractionProviderError'
    this.code = code
    this.rxcuis = options.rxcuis
    this.status = options.status
  }
}

export type MedicationInteractionFetcher = (input: string, init?: RequestInit) => Promise<Response>

export interface MedicationInteractionProviderOptions {
  fetcher?: MedicationInteractionFetcher
  baseUrl?: string
  maxLabels?: number
  now?: () => Date
}

const DEFAULT_BASE_URL = 'https://api.fda.gov/drug/label.json'
const DEFAULT_MAX_LABELS = 100
const DOCUMENTATION_URL = 'https://open.fda.gov/apis/drug/label/how-to-use-the-endpoint/'
const LIMITATION =
  'FDA label evidence is not a complete pairwise interaction database; an empty result does not prove that no interaction exists. Consult a pharmacist or clinician.'

/** Normalize, validate, and de-duplicate a list of RxNorm Concept Unique Identifiers. */
export function normalizeRxCuiList(rxcuis: readonly (string | number)[]): string[] {
  const normalized: string[] = []

  for (const value of rxcuis) {
    const text = typeof value === 'number' ? String(value) : value.trim()
    if (
      (typeof value === 'number' && !Number.isSafeInteger(value)) ||
      !/^\d+$/.test(text) ||
      /^0+$/.test(text)
    ) {
      throw new MedicationInteractionProviderError(
        `Invalid RxCUI: ${String(value)}`,
        'invalid-rxcui',
      )
    }

    const canonical = text.replace(/^0+(?=\d)/, '')
    if (!normalized.includes(canonical)) normalized.push(canonical)
  }

  return normalized
}

interface JsonRecord {
  [key: string]: unknown
}

interface LabelMatch {
  record: JsonRecord
  rxcuis: string[]
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const result = String(value).trim()
  return result || undefined
}

function stringValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const result = stringValue(item)
      return result ? [result] : []
    })
  }

  const result = stringValue(value)
  return result ? [result] : []
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function readNestedRecord(record: JsonRecord, key: string): JsonRecord | undefined {
  const value = record[key]
  return isRecord(value) ? value : undefined
}

function readResults(body: unknown, rxcuis: string[]): JsonRecord[] {
  if (!isRecord(body) || !Array.isArray(body.results)) {
    throw new MedicationInteractionProviderError(
      'FDA interaction response did not contain a results array',
      'invalid-response',
      { rxcuis },
    )
  }

  return body.results.filter(isRecord)
}

function labelMatches(record: JsonRecord, requestedRxcuis: string[]): LabelMatch | undefined {
  const openfda = readNestedRecord(record, 'openfda')
  const labelRxcuis = stringValues(openfda?.rxcui).map((value) => value.replace(/^0+(?=\d)/, ''))
  const matchingRxcuis = requestedRxcuis.filter((rxcui) => labelRxcuis.includes(rxcui))

  // A single-RxCUI query is still attributable when a provider response omits
  // openfda metadata. For multiple RxCUIs, do not guess which label matched.
  if (matchingRxcuis.length > 0) return { record, rxcuis: matchingRxcuis }
  if (requestedRxcuis.length === 1 && labelRxcuis.length === 0) {
    return { record, rxcuis: requestedRxcuis }
  }
  return undefined
}

function labelName(record: JsonRecord): string | undefined {
  const openfda = readNestedRecord(record, 'openfda')
  return stringValues(openfda?.generic_name)[0] ?? stringValues(openfda?.brand_name)[0]
}

function labelId(record: JsonRecord): string | undefined {
  const openfda = readNestedRecord(record, 'openfda')
  return (
    stringValue(record.set_id) ??
    stringValue(record.id) ??
    stringValues(openfda?.spl_set_id)[0] ??
    stringValues(openfda?.spl_id)[0]
  )
}

function interactionValues(record: JsonRecord, section: MedicationInteractionSection): string[] {
  return stringValues(record[section]).map(plainText).filter(Boolean)
}

/**
 * Reads FDA label interaction sections for one or more normalized RxCUIs.
 *
 * HTTP failures, network failures, and malformed successful responses reject
 * with MedicationInteractionProviderError. A valid response with no matching
 * label is represented in `unresolvedRxcuis`, while a label with no interaction
 * section is represented in `coveredRxcuis` with no interaction finding.
 */
export class OpenFdaMedicationInteractionProvider {
  readonly name = 'FDA openFDA Drug Product Labeling'
  readonly endpoint: string
  private readonly fetcher: MedicationInteractionFetcher
  private readonly maxLabels: number
  private readonly now: () => Date

  constructor(options: MedicationInteractionProviderOptions = {}) {
    this.endpoint = options.baseUrl ?? DEFAULT_BASE_URL
    this.fetcher = options.fetcher ?? ((input) => fetch(input))
    this.maxLabels = Math.min(
      1000,
      Math.max(1, Math.floor(options.maxLabels ?? DEFAULT_MAX_LABELS)),
    )
    this.now = options.now ?? (() => new Date())
  }

  async check(rxcuis: readonly (string | number)[]): Promise<MedicationInteractionResult> {
    const requestedRxcuis = normalizeRxCuiList(rxcuis)
    const checkedAt = this.now().toISOString()
    if (requestedRxcuis.length === 0) {
      return this.result(requestedRxcuis, [], [], checkedAt)
    }

    const url = new URL(this.endpoint)
    url.searchParams.set('search', `openfda.rxcui.exact:(${requestedRxcuis.join(' OR ')})`)
    url.searchParams.set('limit', String(this.maxLabels))

    let response: Response
    try {
      response = await this.fetcher(url.toString())
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error'
      throw new MedicationInteractionProviderError(
        `FDA medication interaction lookup failed: ${detail}`,
        'request-failed',
        { rxcuis: requestedRxcuis },
      )
    }

    if (response.status === 404) {
      return this.result(requestedRxcuis, [], requestedRxcuis, checkedAt, url.toString())
    }
    if (!response.ok) {
      throw new MedicationInteractionProviderError(
        `FDA medication interaction lookup failed with HTTP ${response.status}`,
        'http-error',
        { rxcuis: requestedRxcuis, status: response.status },
      )
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new MedicationInteractionProviderError(
        'FDA medication interaction response was not valid JSON',
        'invalid-response',
        { rxcuis: requestedRxcuis },
      )
    }

    const records = readResults(body, requestedRxcuis)
    const matches = records
      .map((record) => labelMatches(record, requestedRxcuis))
      .filter((match): match is LabelMatch => match !== undefined)
    const coveredRxcuis = [...new Set(matches.flatMap((match) => match.rxcuis))]
    const interactions: MedicationInteraction[] = []
    const seen = new Set<string>()

    for (const match of matches) {
      const recordLabelName = labelName(match.record)
      const recordLabelId = labelId(match.record)
      const effectiveTime = stringValue(match.record.effective_time)

      for (const rxcui of match.rxcuis) {
        for (const section of ['drug_interactions', 'drug_interactions_table'] as const) {
          for (const description of interactionValues(match.record, section)) {
            const key = `${rxcui}|${recordLabelId ?? ''}|${section}|${description}`
            if (seen.has(key)) continue
            seen.add(key)
            interactions.push({
              rxcui,
              description,
              section,
              ...(recordLabelName ? { labelName: recordLabelName } : {}),
              ...(recordLabelId ? { labelId: recordLabelId } : {}),
              ...(effectiveTime ? { effectiveTime } : {}),
              source: 'openfda',
              sourceUrl: url.toString(),
            })
          }
        }
      }
    }

    const unresolvedRxcuis = requestedRxcuis.filter((rxcui) => !coveredRxcuis.includes(rxcui))
    return this.result(
      requestedRxcuis,
      coveredRxcuis,
      unresolvedRxcuis,
      checkedAt,
      url.toString(),
      interactions,
    )
  }

  private result(
    requestedRxcuis: string[],
    coveredRxcuis: string[],
    unresolvedRxcuis: string[],
    checkedAt: string,
    sourceUrl = this.endpoint,
    interactions: MedicationInteraction[] = [],
  ): MedicationInteractionResult {
    return {
      requestedRxcuis,
      coveredRxcuis,
      unresolvedRxcuis,
      interactions,
      checkedAt,
      source: {
        name: 'FDA openFDA Drug Product Labeling',
        endpoint: sourceUrl,
        documentationUrl: DOCUMENTATION_URL,
        limitation: LIMITATION,
      },
    }
  }
}
