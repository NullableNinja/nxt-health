import exerciseRecords from './exercises.json'

export interface ActivityCatalogItem {
  id: string
  name: string
  category: string
  equipment: string[]
  muscles: string[]
  description?: string
  imageUrl?: string
  source?: 'built-in' | 'wger'
  aliases?: string[]
  metValue?: number
}

export const ACTIVITY_CATALOG_SOURCE = {
  label: 'Google Fit activity types',
  href: 'https://developers.google.com/fit/rest/v1/reference/activity-types',
} as const

type WgerResult = {
  id: number
  category?: { name?: string }
  equipment?: Array<{ name?: string }>
  muscles?: Array<{ name_en?: string; name?: string }>
  images?: Array<{ image?: string; is_main?: boolean }>
  translations?: Array<{ language?: number; name?: string; description?: string }>
}

type WgerResponse = { results?: WgerResult[] }

// The canonical movement vocabulary follows Google's broad activity taxonomy;
// aliases add the class and consumer wording people actually type.
const BUILT_IN_ACTIVITY_CATALOG: ActivityCatalogItem[] = [
  {
    id: 'walking',
    name: 'Walking',
    category: 'Cardio',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'brisk-walking',
    name: 'Brisk walking',
    category: 'Cardio',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'hiking',
    name: 'Hiking',
    category: 'Outdoors',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'running',
    name: 'Running',
    category: 'Cardio',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'trail-running',
    name: 'Trail running',
    category: 'Cardio',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'cycling',
    name: 'Cycling',
    category: 'Cardio',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'swimming',
    name: 'Swimming',
    category: 'Cardio',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'rowing',
    name: 'Rowing',
    category: 'Cardio',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'elliptical',
    name: 'Elliptical',
    category: 'Cardio',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'strength-training',
    name: 'Strength training',
    category: 'Strength',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'weightlifting',
    name: 'Weightlifting',
    category: 'Strength',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'bodyweight-training',
    name: 'Bodyweight training',
    category: 'Strength',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'martial-arts',
    name: 'Martial arts',
    category: 'Combat sports',
    equipment: [],
    muscles: [],
    aliases: ['martial art', 'combat training', 'self defense', 'self-defence'],
    source: 'built-in',
  },
  {
    id: 'boxing',
    name: 'Boxing',
    category: 'Combat sports',
    equipment: [],
    muscles: [],
    aliases: ['boxing class', 'boxercise', 'cardio boxing'],
    source: 'built-in',
  },
  {
    id: 'kickboxing',
    name: 'Kickboxing',
    category: 'Combat sports',
    equipment: [],
    muscles: [],
    aliases: ['kick boxing', 'kick-boxing', 'kickboxing class'],
    source: 'built-in',
  },
  {
    id: 'cardio-kickboxing',
    name: 'Cardio kickboxing',
    category: 'Fitness classes',
    equipment: [],
    muscles: [],
    aliases: ['cardio kick boxing', 'cardio kick-boxing', 'kickboxing cardio'],
    source: 'built-in',
  },
  {
    id: 'jiu-jitsu',
    name: 'Jiu-jitsu',
    category: 'Combat sports',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'karate',
    name: 'Karate',
    category: 'Combat sports',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'taekwondo',
    name: 'Taekwondo',
    category: 'Combat sports',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'dance',
    name: 'Dance',
    category: 'Recreation',
    equipment: [],
    muscles: [],
    aliases: ['dance class', 'social dance'],
    source: 'built-in',
  },
  {
    id: 'zumba',
    name: 'Zumba',
    category: 'Fitness classes',
    equipment: [],
    muscles: [],
    aliases: ['zumba class', 'dance fitness', 'dance cardio'],
    source: 'built-in',
  },
  {
    id: 'aerobics',
    name: 'Aerobics',
    category: 'Fitness classes',
    equipment: [],
    muscles: [],
    aliases: ['aerobic class', 'step aerobics', 'low impact aerobics'],
    source: 'built-in',
  },
  {
    id: 'tae-bo',
    name: 'Tae Bo',
    category: 'Fitness classes',
    equipment: [],
    muscles: [],
    aliases: ['taebo', 'tae-bo class', 'cardio kickboxing workout'],
    source: 'built-in',
  },
  {
    id: 'hiit',
    name: 'HIIT',
    category: 'Fitness classes',
    equipment: [],
    muscles: [],
    aliases: ['high intensity interval training', 'interval training', 'tabata'],
    source: 'built-in',
  },
  {
    id: 'circuit-training',
    name: 'Circuit training',
    category: 'Fitness classes',
    equipment: [],
    muscles: [],
    aliases: ['circuit class', 'boot camp', 'bootcamp'],
    source: 'built-in',
  },
  {
    id: 'barre',
    name: 'Barre',
    category: 'Fitness classes',
    equipment: [],
    muscles: [],
    aliases: ['barre class'],
    source: 'built-in',
  },
  {
    id: 'yoga',
    name: 'Yoga',
    category: 'Mind-body',
    equipment: [],
    muscles: [],
    aliases: ['yoga class', 'vinyasa', 'hatha', 'ashtanga', 'hot yoga', 'power yoga'],
    source: 'built-in',
  },
  {
    id: 'pilates',
    name: 'Pilates',
    category: 'Mind-body',
    equipment: [],
    muscles: [],
    aliases: ['pilates class', 'reformer pilates'],
    source: 'built-in',
  },
  {
    id: 'stretching',
    name: 'Stretching',
    category: 'Mobility',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'mobility',
    name: 'Mobility work',
    category: 'Mobility',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'physical-therapy',
    name: 'Physical therapy exercises',
    category: 'Recovery',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'basketball',
    name: 'Basketball',
    category: 'Sports',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'soccer',
    name: 'Soccer',
    category: 'Sports',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'tennis',
    name: 'Tennis',
    category: 'Sports',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  { id: 'golf', name: 'Golf', category: 'Sports', equipment: [], muscles: [], source: 'built-in' },
  {
    id: 'gardening',
    name: 'Gardening',
    category: 'Everyday movement',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'housework',
    name: 'Housework',
    category: 'Everyday movement',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
  {
    id: 'play',
    name: 'Active play',
    category: 'Everyday movement',
    equipment: [],
    muscles: [],
    source: 'built-in',
  },
]

const LOCAL_EXERCISE_CATALOG = exerciseRecords as ActivityCatalogItem[]

let activityCatalogCache: Promise<ActivityCatalogItem[]> | undefined

async function loadActivityCatalog(): Promise<ActivityCatalogItem[]> {
  if (activityCatalogCache) return activityCatalogCache
  activityCatalogCache = fetch('https://wger.de/api/v2/exerciseinfo/?language=2&limit=1000')
    .then(async (response) => {
      if (!response.ok) throw new Error(`Activity catalog request failed: ${response.status}`)
      return (await response.json()) as WgerResponse
    })
    .then((data) =>
      (data.results ?? []).flatMap((item) => {
        const translation =
          item.translations?.find((entry) => entry.language === 2) ?? item.translations?.[0]
        const name = translation?.name?.trim()
        if (!name) return []
        return [
          {
            id: `wger-${item.id}`,
            name,
            category: item.category?.name ?? 'Movement',
            equipment: (item.equipment ?? []).flatMap((entry) => (entry.name ? [entry.name] : [])),
            muscles: (item.muscles ?? []).flatMap(
              (entry) => [entry.name_en ?? entry.name].filter(Boolean) as string[],
            ),
            description: translation?.description
              ?.replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim(),
            imageUrl: item.images?.find((image) => image.is_main)?.image ?? item.images?.[0]?.image,
            source: 'wger' as const,
          },
        ]
      }),
    )
    .catch((error) => {
      activityCatalogCache = undefined
      throw error
    })
  return activityCatalogCache ?? Promise.resolve([])
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function searchCatalogItems(catalog: ActivityCatalogItem[], query: string): ActivityCatalogItem[] {
  const normalizedQuery = normalizeSearchText(query)
  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  return catalog
    .map((item) => {
      const haystack = [
        item.name,
        ...(item.aliases ?? []),
        item.category,
        ...item.equipment,
        ...item.muscles,
        item.description ?? '',
      ].join(' ')
      const normalizedHaystack = normalizeSearchText(haystack)
      const name = normalizeSearchText(item.name)
      const score =
        name === normalizedQuery
          ? 0
          : name.startsWith(normalizedQuery)
            ? 1
            : normalizedHaystack.includes(normalizedQuery)
              ? 2
              : 3
      return { item, score }
    })
    .filter(({ item }) => {
      const normalizedHaystack = normalizeSearchText(
        [
          item.name,
          ...(item.aliases ?? []),
          item.category,
          ...item.equipment,
          ...item.muscles,
          item.description ?? '',
        ].join(' '),
      )
      return queryTokens.every((token) => normalizedHaystack.includes(token))
    })
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name))
    .map(({ item }) => item)
}

/** Search the broad local activity library, supplementing it with wger exercise details when useful. */
export async function searchActivityCatalog(query: string): Promise<ActivityCatalogItem[]> {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  const localCatalog = [...BUILT_IN_ACTIVITY_CATALOG, ...LOCAL_EXERCISE_CATALOG]
  const localResults = searchCatalogItems(localCatalog, normalized)
  // Keep broad activity searches focused and instant. The exercise API is only
  // useful when the local activity vocabulary has no match at all.
  if (localResults.length > 0) return localResults.slice(0, 24)

  try {
    const wgerResults = searchCatalogItems(await loadActivityCatalog(), normalized)
    const seen = new Set(localResults.map((item) => item.name.toLowerCase()))
    return [
      ...localResults,
      ...wgerResults.filter((item) => {
        const key = item.name.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }),
    ].slice(0, 24)
  } catch {
    return localResults.slice(0, 24)
  }
}

/** Estimate active calories from the catalog MET value when body weight is available. */
export function estimateExerciseCalories(
  metValue: number | undefined,
  weightKg: number | undefined,
  durationMinutes: number,
): number | undefined {
  if (!metValue || !weightKg || durationMinutes <= 0) return undefined
  return Math.round((metValue * 3.5 * weightKg * durationMinutes) / 200)
}
