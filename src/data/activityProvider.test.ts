import { describe, expect, it } from 'vitest'
import { searchActivityCatalog } from './activityProvider'

describe('activity catalog search', () => {
  it('finds broad activities that are not workout database exercises', async () => {
    const results = await searchActivityCatalog('martial arts')

    expect(results[0]).toMatchObject({
      name: 'Martial arts',
      category: 'Combat sports',
      source: 'built-in',
    })
  })

  it('ranks exact activity names ahead of related matches', async () => {
    const results = await searchActivityCatalog('walk')

    expect(results[0]?.name).toBe('Walking')
  })

  it.each([
    ['cardio kickboxing', 'Cardio kickboxing'],
    ['zumba class', 'Zumba'],
    ['taebo', 'Tae Bo'],
    ['vinyasa yoga', 'Yoga'],
  ])('understands common class wording: %s', async (query, expected) => {
    const results = await searchActivityCatalog(query)

    expect(results[0]?.name).toBe(expected)
  })
})
