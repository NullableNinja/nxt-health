import { describe, expect, it } from 'vitest'
import { OpenFoodFactsProvider } from './providers'

describe('Open Food Facts provider', () => {
  it('uses the supported full-text search route and normalizes string nutrients', async () => {
    let requestedUrl = ''
    const provider = new OpenFoodFactsProvider(async (url) => {
      requestedUrl = url
      return new Response(
        JSON.stringify({
          products: [
            {
              code: '123',
              product_name: 'Test oats',
              brands: 'Test',
              nutriments: { 'energy-kj_100g': '418.4', proteins_100g: '5' },
            },
          ],
        }),
        { status: 200 },
      )
    })

    const foods = await provider.search('oats')

    expect(requestedUrl).toContain('world.openfoodfacts.net/cgi/search.pl')
    expect(requestedUrl).toContain('search_terms=oats')
    expect(foods[0]).toMatchObject({ name: 'Test oats', proteinG: 5, source: 'open-food-facts' })
    expect(foods[0].calories).toBeCloseTo(100, 5)
  })

  it('uses the v2 product route for barcode lookup', async () => {
    let requestedUrl = ''
    const provider = new OpenFoodFactsProvider(async (url) => {
      requestedUrl = url
      return new Response(
        JSON.stringify({
          status: 1,
          product: {
            product_name: 'Barcode food',
            code: '456',
            nutriments: { 'energy-kcal_100g': 50 },
          },
        }),
        { status: 200 },
      )
    })

    const food = await provider.lookupBarcode(' 456 ')

    expect(requestedUrl).toContain('/api/v2/product/456.json')
    expect(food?.name).toBe('Barcode food')
    expect(food?.calories).toBe(50)
  })

  it('surfaces provider failures for the UI to render', async () => {
    const provider = new OpenFoodFactsProvider(async () => new Response('', { status: 503 }))
    await expect(provider.search('unavailable')).rejects.toThrow('Open Food Facts search failed')
  })
})
