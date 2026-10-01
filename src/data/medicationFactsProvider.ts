/**
 * Curated patient-facing sections from FDA Structured Product Labels via
 * openFDA. This is label information, not individualized medical advice.
 *
 * Documentation:
 * - https://open.fda.gov/apis/drug/label/how-to-use-the-endpoint/
 * - https://open.fda.gov/apis/drug/label/searchable-fields/
 */

export interface MedicationFactSection {
  id: string
  title: string
  paragraphs: string[]
}

export interface MedicationFactsResult {
  medicationName: string
  sections: MedicationFactSection[]
  effectiveTime?: string
  labelId?: string
  sourceUrl: string
  source: {
    name: 'FDA openFDA Drug Product Labeling'
    documentationUrl: string
    limitation: string
  }
}

export type MedicationFactsFetcher = (input: string) => Promise<Response>

interface JsonRecord {
  [key: string]: unknown
}

const DEFAULT_BASE_URL = 'https://api.fda.gov/drug/label.json'
const DOCUMENTATION_URL = 'https://open.fda.gov/apis/drug/label/how-to-use-the-endpoint/'
const LIMITATION =
  'This is the current FDA label for a product match. It does not account for your health history, other medicines, or the instructions from your prescriber.'

const sectionDefinitions: Array<{
  id: string
  title: string
  fields: string[]
}> = [
  { id: 'purpose', title: 'What it is for', fields: ['indications_and_usage', 'uses'] },
  {
    id: 'how-to-use',
    title: 'How it is used',
    fields: ['dosage_and_administration', 'directions'],
  },
  {
    id: 'warnings',
    title: 'Warnings and precautions',
    fields: ['boxed_warning', 'warnings_and_cautions', 'warnings', 'do_not_use', 'ask_doctor'],
  },
  { id: 'side-effects', title: 'Possible side effects', fields: ['adverse_reactions'] },
  { id: 'interactions', title: 'Interactions', fields: ['drug_interactions'] },
  { id: 'description', title: 'About this product', fields: ['description', 'active_ingredient'] },
]

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const text = String(value).trim()
  return text || undefined
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

function stringValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value]
  return values
    .map(stringValue)
    .filter((item): item is string => Boolean(item))
    .map(plainText)
    .filter(Boolean)
}

function nestedRecord(record: JsonRecord, key: string): JsonRecord | undefined {
  const value = record[key]
  return isRecord(value) ? value : undefined
}

function labelName(record: JsonRecord): string {
  const openfda = nestedRecord(record, 'openfda')
  return (
    stringValues(openfda?.generic_name)[0] ??
    stringValues(openfda?.brand_name)[0] ??
    'Medication label'
  )
}

function labelId(record: JsonRecord): string | undefined {
  const openfda = nestedRecord(record, 'openfda')
  return (
    stringValue(record.set_id) ??
    stringValue(record.id) ??
    stringValues(openfda?.spl_set_id)[0] ??
    stringValues(openfda?.spl_id)[0]
  )
}

function escapedPhrase(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export class OpenFdaMedicationFactsProvider {
  readonly name = 'FDA openFDA Drug Product Labeling'
  readonly endpoint: string
  private readonly fetcher: MedicationFactsFetcher

  constructor(options: { fetcher?: MedicationFactsFetcher; baseUrl?: string } = {}) {
    this.endpoint = options.baseUrl ?? DEFAULT_BASE_URL
    this.fetcher = options.fetcher ?? ((input) => fetch(input))
  }

  async getFacts(input: { name: string; rxcui?: string }): Promise<MedicationFactsResult | null> {
    const name = input.name.trim()
    const rxcui = input.rxcui?.trim()
    if (!name && !rxcui) return null

    const url = new URL(this.endpoint)
    if (rxcui && /^\d+$/.test(rxcui)) {
      url.searchParams.set('search', `openfda.rxcui.exact:${rxcui}`)
    } else {
      const phrase = escapedPhrase(name)
      url.searchParams.set(
        'search',
        `openfda.generic_name:"${phrase}" OR openfda.brand_name:"${phrase}"`,
      )
    }
    url.searchParams.set('limit', '5')

    let response: Response
    try {
      response = await this.fetcher(url.toString())
    } catch {
      throw new Error('FDA medication facts lookup failed')
    }
    if (response.status === 404) return null
    if (!response.ok)
      throw new Error(`FDA medication facts lookup failed with HTTP ${response.status}`)

    const body = (await response.json()) as { results?: unknown }
    const records = Array.isArray(body.results) ? body.results.filter(isRecord) : []
    const record = records.find((candidate) =>
      sectionDefinitions.some(({ fields }) =>
        fields.some((field) => stringValues(candidate[field]).length),
      ),
    )
    if (!record) return null

    const sections = sectionDefinitions.flatMap(({ id, title, fields }) => {
      const paragraphs = fields.flatMap((field) => stringValues(record[field])).slice(0, 3)
      return paragraphs.length > 0 ? [{ id, title, paragraphs }] : []
    })
    if (sections.length === 0) return null

    return {
      medicationName: labelName(record),
      sections,
      ...(stringValue(record.effective_time)
        ? { effectiveTime: stringValue(record.effective_time) }
        : {}),
      ...(labelId(record) ? { labelId: labelId(record) } : {}),
      sourceUrl: url.toString(),
      source: {
        name: this.name,
        documentationUrl: DOCUMENTATION_URL,
        limitation: LIMITATION,
      },
    }
  }
}
