export interface MyFitnessPalFoodRow {
  date: string
  meal: string
  foodName: string
  calories: number
  fatG: number
  carbsG: number
  proteinG: number
  fiberG: number
  note?: string
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const next = line[index + 1]
    if (character === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += character
    }
  }
  cells.push(cell.trim())
  return cells
}

function key(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function number(value: string | undefined): number {
  const parsed = Number((value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function date(value: string | undefined): string | undefined {
  const raw = value?.trim() ?? ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (!match) return undefined
  const year = match[3].length === 2 ? `20${match[3]}` : match[3]
  return `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
}

function findIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(key)
  return normalized.findIndex((header) => aliases.includes(header))
}

function value(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? '') : ''
}

/** Parses the food-level CSV produced by MyFitnessPal exports and tolerates header variations. */
export function parseMyFitnessPalCsv(csv: string): MyFitnessPalFoodRow[] {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0])
  const indexes = {
    date: findIndex(headers, ['date', 'entrydate']),
    meal: findIndex(headers, ['meal', 'diarymeal']),
    food: findIndex(headers, ['food', 'foodname', 'name', 'description']),
    calories: findIndex(headers, ['calories', 'energy']),
    fat: findIndex(headers, ['fatg', 'totalfatg', 'fat']),
    carbs: findIndex(headers, ['carbohydratesg', 'totalcarbohydratesg', 'carbsg', 'carbs']),
    protein: findIndex(headers, ['proteing', 'protein']),
    fiber: findIndex(headers, ['fiberg', 'dietaryfiber', 'dietaryfiberg', 'fiber']),
    note: findIndex(headers, ['note', 'notes']),
  }
  if (indexes.date < 0 || indexes.food < 0) return []
  return lines.slice(1).flatMap((line) => {
    const row = parseCsvLine(line)
    const foodName = value(row, indexes.food).trim()
    const parsedDate = date(value(row, indexes.date))
    if (!foodName || !parsedDate) return []
    return [
      {
        date: parsedDate,
        meal: value(row, indexes.meal).trim() || 'Imported meal',
        foodName,
        calories: number(value(row, indexes.calories)),
        fatG: number(value(row, indexes.fat)),
        carbsG: number(value(row, indexes.carbs)),
        proteinG: number(value(row, indexes.protein)),
        fiberG: number(value(row, indexes.fiber)),
        note: value(row, indexes.note).trim() || undefined,
      },
    ]
  })
}
