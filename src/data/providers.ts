import type { Food } from '../domain/models'

export interface FoodProvider {
  readonly name: string
  search(query: string): Promise<Food[]>
  lookupBarcode(barcode: string): Promise<Food | undefined>
}

type FetchLike = (input: string) => Promise<Response>

function numeric(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : 0
}

function nutrient(food: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = numeric(food[key])
    if (value !== 0) return value
  }
  return 0
}

export class OpenFoodFactsProvider implements FoodProvider {
  readonly name = 'Open Food Facts'
  private readonly productBaseUrl = 'https://world.openfoodfacts.net'
  private readonly fetcher: FetchLike

  constructor(fetcher: FetchLike = (input) => fetch(input)) {
    this.fetcher = fetcher
  }

  async search(query: string): Promise<Food[]> {
    const params = new URLSearchParams({
      search_terms: query,
      json: '1',
      page_size: '10',
      fields: 'code,product_name,brands,nutriments',
    })
    const response = await this.fetcher(`${this.productBaseUrl}/cgi/search.pl?${params.toString()}`)
    if (!response.ok) throw new Error('Open Food Facts search failed')
    const body = (await response.json()) as { products?: Array<Record<string, unknown>> }
    return (body.products ?? [])
      .map((product) => this.normalize(product))
      .filter((food) => food.name.length > 0)
  }

  async lookupBarcode(barcode: string): Promise<Food | undefined> {
    const normalizedBarcode = barcode.trim().replace(/\s+/g, '')
    const response = await this.fetcher(
      `${this.productBaseUrl}/api/v2/product/${encodeURIComponent(normalizedBarcode)}.json?fields=code,product_name,brands,nutriments`,
    )
    if (!response.ok) return undefined
    const body = (await response.json()) as { product?: Record<string, unknown>; status?: number }
    return body.status === 1 && body.product
      ? this.normalize({ ...body.product, code: barcode })
      : undefined
  }

  private normalize(product: Record<string, unknown>): Food {
    const nutrients = (product.nutriments ?? {}) as Record<string, unknown>
    const code = String(product.code ?? '').trim()
    const caloriesFromKcal = nutrient(nutrients, 'energy-kcal_100g', 'energy-kcal_value')
    const calories =
      caloriesFromKcal || nutrient(nutrients, 'energy-kj_100g', 'energy-kj_value') / 4.184
    return {
      id: `off-${code || `unknown-${Math.random().toString(16).slice(2)}`}`,
      name: String(product.product_name ?? 'Unnamed product'),
      brand: String(product.brands ?? '') || undefined,
      barcode: code || undefined,
      servingLabel: '100 g',
      servingGrams: 100,
      calories,
      proteinG: nutrient(nutrients, 'proteins_100g'),
      carbsG: nutrient(nutrients, 'carbohydrates_100g'),
      fatG: nutrient(nutrients, 'fat_100g'),
      fiberG: nutrient(nutrients, 'fiber_100g'),
      source: 'open-food-facts',
      sourceId: code,
      confidence: 'moderate',
    }
  }
}

export class UsdaProvider implements FoodProvider {
  readonly name = 'USDA FoodData Central'
  private readonly apiKey = import.meta.env.VITE_USDA_API_KEY as string | undefined
  private readonly baseUrl = 'https://api.nal.usda.gov/fdc/v1'

  async search(query: string): Promise<Food[]> {
    if (!this.apiKey) return []
    const response = await fetch(
      `${this.baseUrl}/foods/search?api_key=${encodeURIComponent(this.apiKey)}&query=${encodeURIComponent(query)}&pageSize=10`,
    )
    if (!response.ok) throw new Error('USDA search failed')
    const body = (await response.json()) as { foods?: Array<Record<string, unknown>> }
    return (body.foods ?? []).map((food) => this.normalize(food))
  }

  async lookupBarcode(barcode: string): Promise<Food | undefined> {
    const foods = await this.search(barcode)
    return foods[0]
  }

  private normalize(food: Record<string, unknown>): Food {
    const nutrients = Array.isArray(food.foodNutrients)
      ? (food.foodNutrients as Array<Record<string, unknown>>)
      : []
    const valueFor = (number: number): number =>
      Number(
        nutrients.find(
          (item) => item.nutrientNumber === String(number) || item.nutrientId === number,
        )?.value ?? 0,
      )
    return {
      id: `usda-${String(food.fdcId)}`,
      name: String(food.description ?? 'Unnamed food'),
      brand: String(food.brandOwner ?? '') || undefined,
      servingLabel: '100 g',
      servingGrams: 100,
      calories: valueFor(1008),
      proteinG: valueFor(1003),
      carbsG: valueFor(1005),
      fatG: valueFor(1004),
      fiberG: valueFor(1079),
      source: 'usda',
      sourceId: String(food.fdcId),
      confidence: 'high',
    }
  }
}
