import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import {
  Activity,
  ArrowUp,
  Bell,
  BellRing,
  BookOpen,
  Camera,
  Check,
  Copy,
  ChevronRight,
  CircleHelp,
  Download,
  Droplets,
  Edit3,
  Flame,
  Footprints,
  GripVertical,
  HeartPulse,
  Brain,
  LineChart,
  HeartHandshake,
  MoreHorizontal,
  Moon,
  PersonStanding,
  Plus,
  Pill,
  Search,
  Scale,
  Share2,
  Settings,
  SlidersHorizontal,
  Sparkles,
  SunMedium,
  Target,
  Trash2,
  Upload,
  UserRound,
  Utensils,
  X,
} from 'lucide-react'
import {
  buildMetabolicSummary,
  calculateWeightTrend,
  kgToPounds,
  projectGoalDate,
  round,
  sumNutrition,
} from '../domain/calculations'
import type {
  ActivityLevel,
  CaptureEntry,
  CaptureType,
  ConsentScope,
  DashboardCardId,
  DashboardConfiguration,
  DashboardModuleSize,
  BodyPhotoEntry,
  DreamJournalEntry,
  Food,
  Goal,
  GoalKind,
  GenderIdentity,
  HealthDomain,
  HealthMetricEntry,
  HealthMetricKind,
  IntegrationConnection,
  MedicationLog,
  MedicationSchedule,
  MedicationFrequency,
  Profile,
  PronounPreference,
  SexAssignedAtBirth,
  SupportStyle,
  SleepSession,
  SleepQuality,
  UnitSystem,
  WellbeingEntry,
} from '../domain/models'
import { captureDomain, numericSeries } from '../domain/analytics'
import {
  getActivityIntensityBalance,
  getRecentActivityTrend,
  getWeeklyActivityTotals,
  suggestActivityNextStep,
  type ActivityCategory,
  type ActivitySession,
} from '../domain/activity'
import { calculateDailyNutritionTotals, summarizeMeals } from '../domain/nutrition'
import { metricRegistry } from '../domain/metrics'
import { parseMyFitnessPalCsv } from '../domain/myfitnesspal'
import { fullMindPracticeCatalog } from '../domain/mind'
import { db, newId, removeDemoFoods } from '../data/db'
import { OpenFoodFactsProvider } from '../data/providers'
import { RxNormProvider, type MedicationLookupResult } from '../data/medicationProvider'
import {
  OpenFdaMedicationFactsProvider,
  type MedicationFactsResult,
} from '../data/medicationFactsProvider'
import {
  OpenFdaMedicationInteractionProvider,
  type MedicationInteractionResult,
} from '../data/medicationInteractionProvider'
import {
  ACTIVITY_CATALOG_SOURCE,
  searchActivityCatalog,
  type ActivityCatalogItem,
} from '../data/activityProvider'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import EmojiPicker, { Theme as EmojiTheme, type EmojiClickData } from 'emoji-picker-react'
import {
  exerciseRepository,
  foodLogRepository,
  foodRepository,
  goalRepository,
  healthMetricRepository,
  lifeEventRepository,
  profileRepository,
  wellbeingRepository,
  weightRepository,
  captureRepository,
  consentRepository,
  dashboardRepository,
  bodyPhotoRepository,
  medicationRepository,
  sleepRepository,
  dreamJournalRepository,
  integrationConnectionRepository,
} from '../data/repositories'
import { providerCapabilities } from '../data/integrationProviders'
import {
  formatSleepDuration,
  sleepDurationMinutes,
  sleepInsight,
  sleepSummary,
} from '../domain/sleep'

type WellbeingSignalKey =
  'mood' | 'stress' | 'energy' | 'anxiety' | 'motivation' | 'sleepQuality' | 'focus' | 'bodyTension'

type JournalCheckIn = Partial<Pick<WellbeingEntry, WellbeingSignalKey | 'note'>>

function parseJournalTags(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim()))
    }
  } catch {
    // Older entries stored tags as a comma-separated string.
  }
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function mergeJournalTags(current: string[], input: string): string[] {
  const incoming = input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  return incoming.reduce<string[]>(
    (tags, tag) => {
      if (!tags.some((existing) => existing.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
        tags.push(tag)
      }
      return tags
    },
    [...current],
  )
}

const wellbeingSignalDefinitions: Array<{
  key: WellbeingSignalKey
  label: string
  low: string
  high: string
  icon: string
}> = [
  { key: 'mood', label: 'Mood', low: 'Low', high: 'Bright', icon: '◔' },
  { key: 'stress', label: 'Stress', low: 'Settled', high: 'Pressed', icon: '≈' },
  { key: 'energy', label: 'Energy', low: 'Drained', high: 'Energized', icon: '✦' },
  { key: 'anxiety', label: 'Anxiety', low: 'Quiet', high: 'Loud', icon: '◌' },
  { key: 'motivation', label: 'Motivation', low: 'Low', high: 'Ready', icon: '→' },
  { key: 'sleepQuality', label: 'Sleep quality', low: 'Rough', high: 'Restful', icon: '☾' },
  { key: 'focus', label: 'Focus', low: 'Scattered', high: 'Clear', icon: '⊙' },
  { key: 'bodyTension', label: 'Body tension', low: 'Soft', high: 'Tight', icon: '◯' },
]

type MindRecordItem =
  | { kind: 'capture'; entry: CaptureEntry }
  | { kind: 'check-in'; entry: WellbeingEntry }
  | { kind: 'dream'; entry: DreamJournalEntry }

function isCaptureRecord(
  item: MindRecordItem,
): item is Extract<MindRecordItem, { kind: 'capture' }> {
  return item.kind === 'capture'
}

function mindRecordDate(item: MindRecordItem) {
  return item.kind === 'capture' ? item.entry.occurredAt : item.entry.date
}

function mindRecordKind(entry: CaptureEntry) {
  if (entry.context === 'journal') return { label: 'Journal', className: 'journal' }
  if (entry.title.startsWith('Skill practice')) return { label: 'Practice', className: 'practice' }
  if (entry.title.startsWith('Breathing rhythm'))
    return { label: 'Breathing', className: 'breathing' }
  return { label: 'Mindfulness', className: 'mindfulness' }
}

function plainRecordText(source: string | undefined) {
  return (source ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function wellbeingSignals(entry: WellbeingEntry) {
  return wellbeingSignalDefinitions
    .map(({ key, label }) => (entry[key] !== undefined ? `${label} ${entry[key]}/5` : null))
    .filter(Boolean) as string[]
}

const captureSignalPayloadKeys: Record<WellbeingSignalKey, string> = {
  mood: 'checkInMood',
  stress: 'checkInStress',
  energy: 'checkInEnergy',
  anxiety: 'checkInAnxiety',
  motivation: 'checkInMotivation',
  sleepQuality: 'checkInSleep',
  focus: 'checkInFocus',
  bodyTension: 'checkInBodyTension',
}

function captureSignalValue(entry: CaptureEntry, key: WellbeingSignalKey) {
  return entry.payload?.[key] ?? entry.payload?.[captureSignalPayloadKeys[key]]
}

function captureSignals(entry: CaptureEntry) {
  return wellbeingSignalDefinitions
    .map(({ key, label }) => {
      const value = captureSignalValue(entry, key)
      return value !== undefined && value !== null ? `${label} ${value}/5` : null
    })
    .filter(Boolean) as string[]
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'The workspace could not render this page.',
    }
  }

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    console.error('Workspace render error', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="app-error-state" role="alert">
        <p className="eyebrow">Workspace paused safely</p>
        <h1>That page hit a snag.</h1>
        <p>Nothing was deleted. Reload the workspace and try again.</p>
        <button className="primary-button" onClick={() => window.location.reload()}>
          Reload workspace
        </button>
        <small>{this.state.message}</small>
      </main>
    )
  }
}

function useDialogFocus<T extends HTMLElement>(
  dialogRef: { current: T | null },
  onClose: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return
    const dialog = dialogRef.current
    if (!dialog) return
    const previous = document.activeElement as HTMLElement | null
    const selector =
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusFirst = () => dialog.querySelector<HTMLElement>(selector)?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(selector))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', onKeyDown)
    requestAnimationFrame(focusFirst)
    return () => {
      dialog.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [dialogRef, onClose, enabled])
}

type DeleteConfirmationContextValue = {
  confirmDelete: (message: string) => Promise<boolean>
}

const DeleteConfirmationContext = createContext<DeleteConfirmationContextValue | null>(null)

function useDeleteConfirmation() {
  const context = useContext(DeleteConfirmationContext)
  if (!context) throw new Error('Delete confirmation must be used inside its provider.')
  return context.confirmDelete
}

function DeleteConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{
    message: string
    resolve: (confirmed: boolean) => void
  } | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const confirmDelete = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) => {
        setRequest({ message, resolve })
      }),
    [],
  )
  const close = useCallback(
    (confirmed: boolean) => {
      if (!request) return
      request.resolve(confirmed)
      setRequest(null)
    },
    [request],
  )
  useDialogFocus(dialogRef, () => close(false))
  return (
    <DeleteConfirmationContext.Provider value={{ confirmDelete }}>
      {children}
      {request && (
        <div
          className="delete-confirm-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close(false)
          }}
        >
          <section
            ref={dialogRef}
            className="delete-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            <p className="eyebrow">Delete item</p>
            <h2 id="delete-confirm-title">{request.message}</h2>
            <p className="muted">This cannot be undone.</p>
            <div className="button-row delete-confirm-actions">
              <button className="secondary-button" onClick={() => close(false)}>
                Cancel
              </button>
              <button className="danger-button" onClick={() => close(true)}>
                Delete
              </button>
            </div>
          </section>
        </div>
      )}
    </DeleteConfirmationContext.Provider>
  )
}

type Screen =
  | 'today'
  | 'patterns'
  | 'weight'
  | 'nutrition'
  | 'activity'
  | 'sleep'
  | 'mind'
  | 'medications'
  | 'profile'
  | 'settings'

const screenValues: readonly Screen[] = [
  'today',
  'patterns',
  'weight',
  'nutrition',
  'activity',
  'sleep',
  'mind',
  'medications',
  'profile',
  'settings',
]

function screenFromLocation(): Screen | undefined {
  const hashCandidate = window.location.hash.replace(/^#/, '')
  if (hashCandidate === 'body') return 'weight'
  if (screenValues.includes(hashCandidate as Screen)) return hashCandidate as Screen
  const pathCandidate = window.location.pathname.replace(/^\//, '').replace(/\/$/, '')
  if (pathCandidate === 'body') return 'weight'
  return screenValues.includes(pathCandidate as Screen) ? (pathCandidate as Screen) : undefined
}

function goalDestination(goal: Goal): Screen {
  switch (goal.kind) {
    case 'lose-weight':
    case 'gain-weight':
    case 'maintain-weight':
      return 'weight'
    case 'nutrition':
      return 'nutrition'
    case 'activity':
    case 'build-muscle':
    case 'cardio':
      return 'activity'
    case 'sleep':
      return 'sleep'
    case 'understand-mood':
    case 'manage-stress':
    case 'understand-anxiety':
    case 'spiritual-practice':
    case 'connection':
    case 'purpose':
      return 'mind'
    case 'understand-medication':
      return 'medications'
    case 'overall-health':
      return 'today'
    case 'understand-data':
    case 'track-symptoms':
    case 'custom':
      return 'patterns'
  }
}

type WorkspaceTheme = 'midnight' | 'dawn' | 'forest' | 'ocean' | 'clay' | 'mist'
type WorkspacePalette = 'gold' | 'blue' | 'coral' | 'violet' | 'sage' | 'copper'
type WorkspaceBackground = 'growth' | 'orbit' | 'haze' | 'bubbles' | 'contours' | 'plain'
type WorkspaceSidebarStyle = 'theme' | 'deep' | 'surface' | 'tinted' | 'quiet' | 'slate'

const workspaceThemes: Array<{ id: WorkspaceTheme; label: string; description: string }> = [
  { id: 'midnight', label: 'Midnight growth', description: 'The original calm, starry workspace.' },
  { id: 'dawn', label: 'Dawn paper', description: 'A warm, light reading surface.' },
  {
    id: 'forest',
    label: 'Forest dusk',
    description: 'A deeper green atmosphere with soft contrast.',
  },
  { id: 'ocean', label: 'Ocean current', description: 'Blue-green depth with a clearer horizon.' },
  {
    id: 'clay',
    label: 'Clay evening',
    description: 'Warm earth tones with a grounded, quiet weight.',
  },
  { id: 'mist', label: 'Morning mist', description: 'A pale, cool surface with quiet blue depth.' },
]
const workspacePalettes: Array<{ id: WorkspacePalette; label: string; description: string }> = [
  { id: 'gold', label: 'Harvest gold', description: 'Warm and grounded.' },
  { id: 'blue', label: 'Mineral blue', description: 'Clear, cool, and steady.' },
  { id: 'coral', label: 'Soft coral', description: 'Gentle energy without shouting.' },
  { id: 'violet', label: 'Evening violet', description: 'Reflective and slightly more luminous.' },
  { id: 'sage', label: 'Quiet sage', description: 'Natural, balanced, and low-pressure.' },
  { id: 'copper', label: 'Burnished copper', description: 'Warm, tactile, and a little brighter.' },
]
const workspaceSidebarStyles: Array<{
  id: WorkspaceSidebarStyle
  label: string
  description: string
}> = [
  { id: 'theme', label: 'Theme matched', description: 'Sidebar colors follow the selected theme.' },
  {
    id: 'deep',
    label: 'Deep contrast',
    description: 'Darker navigation with bright readable labels.',
  },
  {
    id: 'surface',
    label: 'Surface contrast',
    description: 'A lighter sidebar with stronger selected rows.',
  },
  {
    id: 'tinted',
    label: 'Accent tinted',
    description: 'A subtle wash of the selected accent color.',
  },
  {
    id: 'quiet',
    label: 'Quiet edge',
    description: 'A softer sidebar that recedes behind the content.',
  },
  {
    id: 'slate',
    label: 'Slate contrast',
    description: 'A cool blue-gray sidebar with clear separation.',
  },
]
const workspaceBackgrounds: Array<{
  id: WorkspaceBackground
  label: string
  description: string
}> = [
  { id: 'growth', label: 'Growth field', description: 'Leaves, arcs, and quiet paths.' },
  { id: 'orbit', label: 'Orbit lines', description: 'Visible arcs and sweeping paths.' },
  { id: 'haze', label: 'Soft haze', description: 'Abstract light and depth around the edges.' },
  { id: 'bubbles', label: 'Bubble field', description: 'Soft circles and gentle overlap.' },
  {
    id: 'contours',
    label: 'Contour paths',
    description: 'Topographic lines that suggest movement over time.',
  },
  { id: 'plain', label: 'Quiet plain', description: 'No decorative imagery.' },
]

function storedPreference<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  const value = window.localStorage.getItem(key)
  return value && allowed.includes(value as T) ? (value as T) : fallback
}

const today = () => {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function dateTimeLocalValue(value?: string) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function ageFromBirthDate(birthDate?: string) {
  if (!birthDate) return undefined
  const birth = new Date(`${birthDate}T12:00:00`)
  if (Number.isNaN(birth.getTime())) return undefined
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDelta = now.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1
  return age >= 0 && age <= 120 ? age : undefined
}

function effectiveProfileAge(profile: Pick<Profile, 'age' | 'birthDate'>) {
  return profile.age ?? ageFromBirthDate(profile.birthDate)
}

const foodProvider = new OpenFoodFactsProvider()
const defaultTodayCards: DashboardCardId[] = [
  'overview',
  'energy',
  'nutrition',
  'measurements',
  'trajectory',
  'insight',
  'quick-actions',
  'movement',
  'movement-minutes',
  'movement-steps',
  'movement-intensity',
  'sleep',
  'sleep-last',
  'sleep-average',
  'sleep-consistency',
]
const todayCardOptions: Array<{
  id: DashboardCardId
  label: string
  description: string
  nested?: boolean
}> = [
  {
    id: 'overview',
    label: 'Signal cards',
    description: 'Weight, food, protein, and movement snapshot',
  },
  { id: 'energy', label: 'Energy context', description: 'Transparent estimate and assumptions' },
  { id: 'nutrition', label: 'Nutrition summary', description: 'Macro balance for today' },
  { id: 'measurements', label: 'Measurements', description: 'Recent body and health observations' },
  { id: 'trajectory', label: 'Weight trajectory', description: 'Longitudinal trend context' },
  {
    id: 'insight',
    label: 'Early insight',
    description: 'A cautious interpretation of current data',
  },
  {
    id: 'quick-actions',
    label: 'Quick actions',
    description: 'Food, activity, and trend shortcuts',
  },
  { id: 'movement', label: 'Movement pulse', description: 'Sessions and move minutes today' },
  {
    id: 'movement-minutes',
    label: 'Move minutes',
    description: 'Move minutes signal inside Movement pulse',
    nested: true,
  },
  {
    id: 'movement-steps',
    label: 'Steps',
    description: 'Steps signal inside Movement pulse',
    nested: true,
  },
  {
    id: 'movement-intensity',
    label: 'Intense activity',
    description: 'High-effort minutes inside Movement pulse',
    nested: true,
  },
  {
    id: 'sleep',
    label: 'Sleep context',
    description: 'Last night, quality, and recent consistency',
  },
  {
    id: 'sleep-last',
    label: 'Last primary session',
    description: 'Latest sleep duration inside Sleep context',
    nested: true,
  },
  {
    id: 'sleep-average',
    label: 'Recent sleep average',
    description: 'Average sleep duration inside Sleep context',
    nested: true,
  },
  {
    id: 'sleep-consistency',
    label: 'Sleep consistency',
    description: 'Duration consistency inside Sleep context',
    nested: true,
  },
  {
    id: 'check-in',
    label: 'Mind check-in',
    description: 'Your latest mood, stress, energy, and sleep snapshot',
  },
  {
    id: 'reflection',
    label: 'Daily reflection',
    description: 'A quick link back to today’s journal and prompt',
  },
]
const formatWeight = (kg: number | undefined, unit: UnitSystem) =>
  kg === undefined
    ? '—'
    : unit === 'imperial'
      ? `${round(kgToPounds(kg), 1)} lb`
      : `${round(kg, 1)} kg`
const formatHeight = (cm: number | undefined, unit: UnitSystem) => {
  if (cm === undefined) return 'Not set'
  if (unit === 'metric') return `${round(cm, 1)} cm`
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = round(totalInches - feet * 12, 1)
  return `${feet}′ ${inches}″`
}

const goalOptions: Array<{
  kind: GoalKind
  label: string
  description: string
  domains: HealthDomain[]
}> = [
  {
    kind: 'lose-weight',
    label: 'Lose weight',
    description: 'Build a sustainable energy deficit with trend context.',
    domains: ['body', 'behavior'],
  },
  {
    kind: 'maintain-weight',
    label: 'Maintain weight',
    description: 'Understand the range that keeps you steady.',
    domains: ['body', 'behavior'],
  },
  {
    kind: 'gain-weight',
    label: 'Gain weight',
    description: 'Support intentional, measured weight gain.',
    domains: ['body', 'behavior'],
  },
  {
    kind: 'nutrition',
    label: 'Improve nutrition',
    description: 'Track food quality, macros, and consistency.',
    domains: ['body', 'behavior'],
  },
  {
    kind: 'activity',
    label: 'Become more active',
    description: 'Build a clearer picture of movement and exercise.',
    domains: ['body', 'behavior'],
  },
  {
    kind: 'build-muscle',
    label: 'Build strength or muscle',
    description: 'Track training, recovery, and the changes you care about.',
    domains: ['body', 'behavior'],
  },
  {
    kind: 'cardio',
    label: 'Support cardiovascular health',
    description: 'Bring heart rate, movement, recovery, and context together.',
    domains: ['body', 'behavior'],
  },
  {
    kind: 'understand-mood',
    label: 'Understand my mood',
    description: 'Notice emotional patterns without turning them into a score.',
    domains: ['mind'],
  },
  {
    kind: 'manage-stress',
    label: 'Manage stress',
    description: 'See what seems to support or strain your capacity.',
    domains: ['mind', 'behavior', 'environment'],
  },
  {
    kind: 'understand-anxiety',
    label: 'Understand anxiety patterns',
    description: 'Reflect on context and changes with appropriate uncertainty.',
    domains: ['mind', 'environment'],
  },
  {
    kind: 'sleep',
    label: 'Improve sleep',
    description: 'Connect rest, recovery, energy, and daily context.',
    domains: ['body', 'mind', 'behavior'],
  },
  {
    kind: 'track-symptoms',
    label: 'Track symptoms',
    description: 'Keep a private record you can understand or share when useful.',
    domains: ['body', 'mind'],
  },
  {
    kind: 'understand-medication',
    label: 'Understand medication effects',
    description: 'Record changes and observations without inferring causation.',
    domains: ['body', 'mind'],
  },
  {
    kind: 'spiritual-practice',
    label: 'Make space for spiritual practice',
    description: 'Notice the practices, beliefs, or rituals that help you feel grounded.',
    domains: ['spiritual'],
  },
  {
    kind: 'connection',
    label: 'Stay connected',
    description: 'Make room for relationships, community, and the people who matter.',
    domains: ['spiritual', 'environment'],
  },
  {
    kind: 'purpose',
    label: 'Explore purpose and meaning',
    description: 'Reflect on what gives your days direction without forcing an answer.',
    domains: ['spiritual', 'mind'],
  },
  {
    kind: 'overall-health',
    label: 'Understand my overall health',
    description: 'Bring the parts of your life that matter into one calm view.',
    domains: ['body', 'mind', 'behavior', 'environment'],
  },
  {
    kind: 'understand-data',
    label: 'Understand my data',
    description: 'Start with a neutral, longitudinal view.',
    domains: ['body', 'mind', 'behavior', 'environment'],
  },
]

const goalSections: Array<{
  key: string
  eyebrow: string
  title: string
  options: typeof goalOptions
}> = [
  {
    key: 'body',
    eyebrow: 'Body',
    title: 'Physical health',
    options: goalOptions.filter((option) =>
      ['lose-weight', 'gain-weight', 'maintain-weight', 'nutrition', 'build-muscle'].includes(
        option.kind,
      ),
    ),
  },
  {
    key: 'mind',
    eyebrow: 'Mind',
    title: 'Mental and emotional health',
    options: goalOptions.filter((option) =>
      [
        'understand-mood',
        'manage-stress',
        'understand-anxiety',
        'track-symptoms',
        'understand-medication',
      ].includes(option.kind),
    ),
  },
  {
    key: 'behavior',
    eyebrow: 'Daily life',
    title: 'Habits, movement, and sleep',
    options: goalOptions.filter((option) => ['activity', 'cardio', 'sleep'].includes(option.kind)),
  },
  {
    key: 'spiritual',
    eyebrow: 'Meaning',
    title: 'Spiritual health and connection',
    options: goalOptions.filter((option) => option.domains.includes('spiritual')),
  },
  {
    key: 'whole',
    eyebrow: 'Whole picture',
    title: 'A wider view',
    options: goalOptions.filter(
      (option) => option.kind === 'overall-health' || option.kind === 'understand-data',
    ),
  },
]

const starterProfileBio =
  'I am building a clearer picture of the habits, signals, and people that help me feel well — one small observation at a time.'

const pronounLabels: Record<PronounPreference, string> = {
  'she-her': 'she / her',
  'he-him': 'he / him',
  'they-them': 'they / them',
  'she-they': 'she / they',
  'he-they': 'he / they',
  'use-my-name': 'use my name',
  custom: 'custom',
  'prefer-not-to-say': 'not specified',
}

function profilePronounLabel(profile: Pick<Profile, 'pronouns' | 'customPronouns'>) {
  return profile.pronouns === 'custom'
    ? profile.customPronouns?.trim() || 'custom'
    : profile.pronouns
      ? pronounLabels[profile.pronouns]
      : 'not specified'
}

function AppContent() {
  const [profile, setProfile] = useState<Profile>()
  const [goals, setGoals] = useState<Goal[]>([])
  const [weights, setWeights] = useState<Awaited<ReturnType<typeof weightRepository.list>>>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof foodLogRepository.listForDate>>>([])
  const [allFoodLogs, setAllFoodLogs] = useState<
    Awaited<ReturnType<typeof foodLogRepository.list>>
  >([])
  const [exercises, setExercises] = useState<Awaited<ReturnType<typeof exerciseRepository.list>>>(
    [],
  )
  const [healthMetrics, setHealthMetrics] = useState<
    Awaited<ReturnType<typeof healthMetricRepository.list>>
  >([])
  const [captures, setCaptures] = useState<CaptureEntry[]>([])
  const [dashboard, setDashboard] = useState<DashboardConfiguration>({
    id: 'today',
    visible: defaultTodayCards,
    updatedAt: new Date().toISOString(),
  })
  const [bodyPhotos, setBodyPhotos] = useState<BodyPhotoEntry[]>([])
  const [medications, setMedications] = useState<MedicationSchedule[]>([])
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([])
  const [sleepSessions, setSleepSessions] = useState<SleepSession[]>([])
  const [dreamJournalEntries, setDreamJournalEntries] = useState<DreamJournalEntry[]>([])
  const [integrationConnections, setIntegrationConnections] = useState<IntegrationConnection[]>([])
  const initialScreen = screenFromLocation() ?? 'today'
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const screenRef = useRef<Screen>(initialScreen)
  const [workspaceTheme, setWorkspaceTheme] = useState<WorkspaceTheme>(() =>
    storedPreference(
      'nxt-workspace-theme',
      'midnight',
      workspaceThemes.map((theme) => theme.id),
    ),
  )
  const [workspacePalette, setWorkspacePalette] = useState<WorkspacePalette>(() =>
    storedPreference(
      'nxt-workspace-palette',
      'gold',
      workspacePalettes.map((palette) => palette.id),
    ),
  )
  const [workspaceBackground, setWorkspaceBackground] = useState<WorkspaceBackground>(() =>
    storedPreference(
      'nxt-workspace-background',
      'growth',
      workspaceBackgrounds.map((background) => background.id),
    ),
  )
  const [workspaceSidebarStyle, setWorkspaceSidebarStyle] = useState<WorkspaceSidebarStyle>(() =>
    storedPreference(
      'nxt-workspace-sidebar-style',
      'theme',
      workspaceSidebarStyles.map((style) => style.id),
    ),
  )
  const [birthdayMoment, setBirthdayMoment] = useState(false)
  const [loading, setLoading] = useState(true)
  const [captureOpen, setCaptureOpen] = useState(false)

  const navigate = useCallback((next: Screen) => {
    if (screenRef.current === next) return
    screenRef.current = next
    const basePath = window.location.pathname.endsWith('/')
      ? window.location.pathname
      : `${window.location.pathname}/`
    window.history.pushState({ screen: next }, '', `${basePath}#${next}`)
    setScreen(next)
  }, [])

  useEffect(() => {
    const handleHistoryChange = () => {
      const next = screenFromLocation()
      if (!next || next === screenRef.current) return
      screenRef.current = next
      setScreen(next)
    }
    window.addEventListener('popstate', handleHistoryChange)
    window.addEventListener('hashchange', handleHistoryChange)
    return () => {
      window.removeEventListener('popstate', handleHistoryChange)
      window.removeEventListener('hashchange', handleHistoryChange)
    }
  }, [])

  // Every top-level destination starts at its own page header. In-page section
  // hashes are intentionally left alone so browser back/forward and deep links work.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [screen])

  useEffect(() => {
    document.documentElement.dataset.theme = workspaceTheme
    document.documentElement.dataset.palette = workspacePalette
    document.documentElement.dataset.background = workspaceBackground
    document.documentElement.dataset.sidebar = workspaceSidebarStyle
    window.localStorage.setItem('nxt-workspace-theme', workspaceTheme)
    window.localStorage.setItem('nxt-workspace-palette', workspacePalette)
    window.localStorage.setItem('nxt-workspace-background', workspaceBackground)
    window.localStorage.setItem('nxt-workspace-sidebar-style', workspaceSidebarStyle)
  }, [workspaceBackground, workspacePalette, workspaceSidebarStyle, workspaceTheme])

  const refresh = useCallback(async () => {
    const [
      storedProfile,
      storedGoals,
      storedWeights,
      storedFoods,
      storedLogs,
      storedFoodLogs,
      storedExercises,
      storedHealthMetrics,
      storedCaptures,
      storedDashboard,
      storedBodyPhotos,
      storedMedications,
      storedMedicationLogs,
      storedSleepSessions,
      storedIntegrationConnections,
      storedDreamJournalEntries,
    ] = await Promise.all([
      profileRepository.get(),
      goalRepository.list(),
      weightRepository.list(),
      foodRepository.list(),
      foodLogRepository.listForDate(today()),
      foodLogRepository.list(),
      exerciseRepository.list(),
      healthMetricRepository.list(),
      captureRepository.list(),
      dashboardRepository.get(),
      bodyPhotoRepository.list(),
      medicationRepository.list(),
      medicationRepository.listLogsForDate(today()),
      sleepRepository.list(),
      integrationConnectionRepository.list(),
      dreamJournalRepository.list(),
    ])
    setProfile(storedProfile)
    setGoals(storedGoals)
    setWeights(storedWeights)
    setFoods(storedFoods)
    setLogs(storedLogs)
    setAllFoodLogs(storedFoodLogs)
    setExercises(storedExercises)
    setHealthMetrics(storedHealthMetrics)
    setCaptures(storedCaptures)
    const dashboardConfiguration = storedDashboard ?? {
      id: 'today' as const,
      visible: defaultTodayCards,
      updatedAt: new Date().toISOString(),
    }
    const migratedVisible = Array.from(
      new Set([
        ...dashboardConfiguration.visible,
        'movement' as DashboardCardId,
        'movement-minutes' as DashboardCardId,
        'movement-steps' as DashboardCardId,
        'movement-intensity' as DashboardCardId,
        'sleep' as DashboardCardId,
        'sleep-last' as DashboardCardId,
        'sleep-average' as DashboardCardId,
        'sleep-consistency' as DashboardCardId,
      ]),
    )
    const migratedOrder = Array.from(
      new Set([
        ...(dashboardConfiguration.order ?? defaultTodayCards),
        'movement-minutes' as DashboardCardId,
        'movement-steps' as DashboardCardId,
        'movement-intensity' as DashboardCardId,
        'sleep-last' as DashboardCardId,
        'sleep-average' as DashboardCardId,
        'sleep-consistency' as DashboardCardId,
      ]),
    )
    const needsMigration =
      migratedVisible.length !== dashboardConfiguration.visible.length ||
      migratedOrder.length !== (dashboardConfiguration.order?.length ?? 0)
    setDashboard(
      !needsMigration
        ? dashboardConfiguration
        : { ...dashboardConfiguration, visible: migratedVisible, order: migratedOrder },
    )
    setBodyPhotos(storedBodyPhotos)
    setMedications(storedMedications)
    setMedicationLogs(storedMedicationLogs)
    setSleepSessions(storedSleepSessions)
    setIntegrationConnections(storedIntegrationConnections)
    setDreamJournalEntries(storedDreamJournalEntries)
    setLoading(false)
  }, [])

  useEffect(() => {
    void removeDemoFoods()
      .then(refresh)
      .catch(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    if (!profile?.birthDate || profile.birthDate.slice(5) !== today().slice(5)) return undefined
    const celebrationKey = `nxt-birthday-celebrated:${today()}`
    if (window.localStorage.getItem(celebrationKey)) return undefined
    window.localStorage.setItem(celebrationKey, 'true')
    setBirthdayMoment(true)
    const timeout = window.setTimeout(() => setBirthdayMoment(false), 12000)
    return () => window.clearTimeout(timeout)
  }, [profile])

  if (loading)
    return (
      <div className="loading-screen">
        <div className="brand-mark">✦</div>
        <p>Preparing your private workspace…</p>
      </div>
    )
  if (!profile)
    return (
      <Onboarding
        onComplete={async () => refresh()}
        onThemeChange={setWorkspaceTheme}
        onPaletteChange={setWorkspacePalette}
        onBackgroundChange={setWorkspaceBackground}
        onSidebarStyleChange={setWorkspaceSidebarStyle}
      />
    )

  const activeGoal =
    goals.find(
      (goal) =>
        goal.active && ['lose-weight', 'gain-weight', 'maintain-weight'].includes(goal.kind),
    ) ?? goals.find((goal) => goal.active)
  const trend = calculateWeightTrend(weights)
  const latestWeight = weights.at(-1)?.weightKg
  const metabolic = buildMetabolicSummary(
    { ...profile, age: effectiveProfileAge(profile) },
    latestWeight,
    activeGoal,
  )
  const nutrition = sumNutrition(logs)
  const projection = projectGoalDate(latestWeight, activeGoal, trend)
  const todayExercises = exercises.filter((entry) => entry.date === today())
  const activityStats = {
    minutes: todayExercises.reduce((sum, entry) => sum + entry.durationMinutes, 0),
    intenseMinutes: todayExercises
      .filter((entry) => entry.intensity === 'hard')
      .reduce((sum, entry) => sum + entry.durationMinutes, 0),
    steps: todayExercises.reduce((sum, entry) => sum + (entry.steps ?? 0), 0),
  }

  async function addWeight(weightKg: number, note?: string) {
    const weightId = await weightRepository.add({ date: today(), weightKg, source: 'manual', note })
    await captureRepository.add({
      type: 'weight',
      occurredAt: new Date().toISOString(),
      title: 'Weight',
      value: weightKg,
      unit: 'kg',
      source: 'manual',
      note,
      payload: { recordId: String(weightId) },
    })
    await refresh()
  }

  async function removeWeight(id: string) {
    await weightRepository.remove(id)
    await db.captures.filter((entry) => entry.payload?.recordId === id).delete()
    await refresh()
  }

  async function addFood(food: Food, servings: number, meal: string, date = today()) {
    await foodRepository.save(food)
    const logId = await foodLogRepository.add({
      date,
      foodId: food.id,
      foodName: food.name,
      meal,
      servings,
      calories: food.calories * servings,
      proteinG: food.proteinG * servings,
      carbsG: food.carbsG * servings,
      fatG: food.fatG * servings,
      fiberG: food.fiberG * servings,
    })
    await captureRepository.add({
      type: 'food',
      occurredAt: `${date}T12:00:00.000Z`,
      title: food.name,
      value: food.calories * servings,
      unit: 'kcal',
      source: food.source === 'open-food-facts' || food.source === 'usda' ? 'provider' : 'manual',
      context: meal,
      payload: {
        recordId: String(logId),
        foodId: food.id,
        servings,
        proteinG: food.proteinG * servings,
        carbsG: food.carbsG * servings,
        fatG: food.fatG * servings,
        fiberG: food.fiberG * servings,
      },
    })
    await refresh()
  }

  async function saveFood(food: Food) {
    await foodRepository.save(food)
    await refresh()
  }

  async function removeFood(id: string) {
    await foodRepository.remove(id)
    await refresh()
  }

  async function removeFoodLog(id: string) {
    await foodLogRepository.remove(id)
    const linkedCapture = captures.find(
      (entry) => entry.type === 'food' && entry.payload?.recordId === id,
    )
    if (linkedCapture) await captureRepository.remove(linkedCapture.id)
    await refresh()
  }

  async function importMyFitnessPal(file: File) {
    const rows = parseMyFitnessPalCsv(await file.text())
    if (!rows.length) {
      window.alert('No food rows were found in that MyFitnessPal CSV.')
      return
    }
    const now = new Date().toISOString()
    await db.transaction('rw', db.foods, db.foodLogs, db.captures, async () => {
      for (const row of rows) {
        const foodId = newId()
        const logId = newId()
        const food: Food = {
          id: foodId,
          name: row.foodName,
          servingLabel: 'Imported from MyFitnessPal',
          calories: row.calories,
          proteinG: row.proteinG,
          carbsG: row.carbsG,
          fatG: row.fatG,
          fiberG: row.fiberG,
          source: 'user-entered',
          confidence: 'low',
        }
        await db.foods.put(food)
        await db.foodLogs.put({
          id: logId,
          date: row.date,
          foodId,
          foodName: row.foodName,
          meal: row.meal,
          servings: 1,
          calories: row.calories,
          proteinG: row.proteinG,
          carbsG: row.carbsG,
          fatG: row.fatG,
          fiberG: row.fiberG,
        })
        await db.captures.put({
          id: newId(),
          type: 'food',
          occurredAt: `${row.date}T12:00:00.000Z`,
          title: row.foodName,
          value: row.calories,
          unit: 'kcal',
          source: 'imported',
          context: row.meal,
          note: row.note,
          payload: {
            recordId: logId,
            foodId,
            servings: 1,
            proteinG: row.proteinG,
            carbsG: row.carbsG,
            fatG: row.fatG,
            fiberG: row.fiberG,
          },
          createdAt: now,
          updatedAt: now,
        })
      }
    })
    await refresh()
    window.alert(`Imported ${rows.length} food ${rows.length === 1 ? 'entry' : 'entries'}.`)
  }

  async function saveDashboard(configuration: DashboardConfiguration) {
    await dashboardRepository.save(configuration)
    setDashboard(configuration)
  }

  async function saveProfile(changes: Partial<Profile>) {
    if (!profile) return
    await profileRepository.save({
      ...profile,
      ...changes,
      updatedAt: new Date().toISOString(),
    })
    await refresh()
  }

  async function toggleGoal(goal: Goal) {
    await goalRepository.save({ ...goal, active: !goal.active })
    await refresh()
  }

  async function saveBodyPhoto(entry: Omit<BodyPhotoEntry, 'id'>) {
    await bodyPhotoRepository.add(entry)
    await refresh()
  }

  async function removeBodyPhoto(id: string) {
    await bodyPhotoRepository.remove(id)
    await refresh()
  }

  async function saveMedication(entry: MedicationSchedule) {
    await medicationRepository.save(entry)
    await refresh()
  }

  async function removeMedication(id: string) {
    await medicationRepository.remove(id)
    await refresh()
  }

  async function logMedication(entry: Omit<MedicationLog, 'id'>) {
    await medicationRepository.addLog(entry)
    await refresh()
  }

  async function saveSleepSession(entry: Omit<SleepSession, 'id'>) {
    const recordId = await sleepRepository.add(entry)
    await captureRepository.add({
      type: 'sleep',
      occurredAt: entry.endAt,
      title: entry.kind === 'nap' ? 'Sleep nap' : 'Sleep session',
      value: entry.durationMinutes,
      unit: 'minutes',
      source: entry.source === 'manual' ? 'manual' : 'imported',
      note: entry.notes,
      payload: {
        kind: entry.kind,
        quality: entry.quality ?? null,
        rested: entry.rested ?? null,
        awakenings: entry.awakenings ?? null,
        recordId: String(recordId),
      },
    })
    await refresh()
  }

  async function removeSleepSession(id: string) {
    await sleepRepository.remove(id)
    const linkedCapture = captures.find(
      (entry) => entry.type === 'sleep' && entry.payload?.recordId === id,
    )
    if (linkedCapture) await captureRepository.remove(linkedCapture.id)
    await refresh()
  }

  async function saveDreamJournalEntry(entry: Omit<DreamJournalEntry, 'id'>) {
    await dreamJournalRepository.save({ ...entry, id: newId() })
    await refresh()
  }

  async function removeDreamJournalEntry(id: string) {
    await dreamJournalRepository.remove(id)
    await refresh()
  }

  async function saveJournalEntry(
    note: string,
    tags: string[],
    date: string,
    checkIn?: JournalCheckIn,
  ) {
    const time = new Date().toISOString().slice(11, 23)
    const journalEntryId = newId()
    const hasCheckIn = Boolean(
      checkIn &&
      (wellbeingSignalDefinitions.some(({ key }) => checkIn[key] !== undefined) ||
        checkIn.note?.trim()),
    )
    const checkInId = hasCheckIn ? newId() : undefined
    const createdAt = new Date().toISOString()

    await db.transaction('rw', db.captures, db.wellbeingEntries, async () => {
      await db.captures.put({
        id: journalEntryId,
        type: 'custom',
        occurredAt: `${date}T${time}Z`,
        title: 'Journal entry',
        source: 'manual',
        context: 'journal',
        note,
        payload: {
          tags: tags.length ? JSON.stringify(tags) : '',
          checkInDate: hasCheckIn ? date : null,
          checkInId: checkInId ?? null,
          checkInMood: checkIn?.mood ?? null,
          checkInStress: checkIn?.stress ?? null,
          checkInEnergy: checkIn?.energy ?? null,
          checkInAnxiety: checkIn?.anxiety ?? null,
          checkInMotivation: checkIn?.motivation ?? null,
          checkInSleep: checkIn?.sleepQuality ?? null,
          checkInFocus: checkIn?.focus ?? null,
          checkInBodyTension: checkIn?.bodyTension ?? null,
        },
        createdAt,
        updatedAt: createdAt,
      })

      if (checkInId && checkIn) {
        await db.wellbeingEntries.put({
          id: checkInId,
          date,
          journalEntryId,
          mood: checkIn.mood,
          stress: checkIn.stress,
          energy: checkIn.energy,
          anxiety: checkIn.anxiety,
          motivation: checkIn.motivation,
          sleepQuality: checkIn.sleepQuality,
          focus: checkIn.focus,
          bodyTension: checkIn.bodyTension,
          note: checkIn.note?.trim() || undefined,
          source: 'manual',
          createdAt,
        })
      }
    })
    await refresh()
  }

  async function saveMindSkillPractice(title: string, answers: string[]) {
    const note = answers.map((answer, index) => `**${index + 1}.** ${answer.trim()}`).join('\n\n')
    await captureRepository.add({
      type: 'custom',
      occurredAt: new Date().toISOString(),
      title: `Skill practice · ${title}`,
      source: 'manual',
      context: 'mindfulness',
      note,
      payload: { kind: 'guided-skill', technique: title },
    })
    await refresh()
  }

  async function saveBreathingSession(mode: string, seconds: number) {
    await captureRepository.add({
      type: 'custom',
      occurredAt: new Date().toISOString(),
      title: `Breathing rhythm · ${mode}`,
      source: 'manual',
      context: 'mindfulness',
      note: 'A self-guided breathing rhythm session.',
      payload: { mode, seconds },
    })
    await refresh()
  }

  async function addExercise(entry: Omit<Parameters<typeof exerciseRepository.add>[0], 'id'>) {
    await exerciseRepository.add(entry)
    await captureRepository.add({
      type: 'movement',
      occurredAt: `${entry.date}T12:00:00.000Z`,
      title: entry.activityType,
      value: entry.durationMinutes,
      unit: 'minutes',
      source: 'manual',
      note: entry.note,
      payload: {
        intensity: entry.intensity,
        estimatedCalories: entry.estimatedCalories ?? null,
        steps: entry.steps ?? null,
        flightsClimbed: entry.flightsClimbed ?? null,
      },
    })
    await refresh()
  }

  async function addHealthMetric(
    entry: Omit<HealthMetricEntry, 'id' | 'createdAt'>,
  ): Promise<void> {
    await healthMetricRepository.add({ ...entry, createdAt: new Date().toISOString() })
    await captureRepository.add({
      type:
        entry.kind === 'resting-heart-rate'
          ? 'heart-rate'
          : entry.kind === 'fasting-glucose'
            ? 'glucose'
            : entry.kind.includes('cholesterol') || entry.kind === 'triglycerides'
              ? 'cholesterol'
              : 'metric',
      occurredAt: `${entry.date}T12:00:00.000Z`,
      title: entry.label,
      value: entry.value,
      unit: entry.unit,
      source: entry.source,
      note: entry.note,
    })
    await refresh()
  }

  async function removeHealthMetric(id: string) {
    await healthMetricRepository.remove(id)
    await refresh()
  }

  async function addCapture(entry: Omit<CaptureEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    const date = entry.occurredAt.slice(0, 10)
    const source = ['manual', 'screening', 'imported'].includes(entry.source)
      ? (entry.source as 'manual' | 'screening' | 'imported')
      : 'imported'
    if (entry.type === 'weight' && typeof entry.value === 'number') {
      const id = await weightRepository.add({
        date,
        weightKg: entry.value,
        source: source === 'screening' ? 'measured' : source === 'imported' ? 'imported' : 'manual',
        note: entry.note,
      })
      entry.payload = { ...(entry.payload ?? {}), recordId: String(id) }
    } else if (
      [
        'metric',
        'heart-rate',
        'oxygen-saturation',
        'steps',
        'glucose',
        'a1c',
        'cholesterol',
        'hdl-cholesterol',
        'ldl-cholesterol',
        'triglycerides',
      ].includes(entry.type) &&
      typeof entry.value === 'number'
    ) {
      const kind: HealthMetricKind =
        entry.type === 'heart-rate'
          ? 'resting-heart-rate'
          : entry.type === 'oxygen-saturation'
            ? 'oxygen-saturation'
            : entry.type === 'steps'
              ? 'steps'
              : entry.type === 'glucose'
                ? 'fasting-glucose'
                : entry.type === 'a1c'
                  ? 'a1c'
                  : entry.type === 'cholesterol'
                    ? 'total-cholesterol'
                    : entry.type === 'hdl-cholesterol'
                      ? 'hdl-cholesterol'
                      : entry.type === 'ldl-cholesterol'
                        ? 'ldl-cholesterol'
                        : entry.type === 'triglycerides'
                          ? 'triglycerides'
                          : 'custom'
      const id = await healthMetricRepository.add({
        date,
        kind,
        label: entry.title,
        value: entry.value,
        unit: entry.unit ?? 'unit',
        source,
        note: entry.note,
        createdAt: new Date().toISOString(),
      })
      entry.payload = { ...(entry.payload ?? {}), recordId: String(id) }
    } else if (
      entry.type === 'blood-pressure' &&
      typeof entry.value === 'number' &&
      typeof entry.payload?.diastolic === 'number'
    ) {
      const id = await healthMetricRepository.add({
        date,
        kind: 'blood-pressure',
        label: 'Blood pressure',
        value: entry.value,
        unit: entry.unit ?? 'mmHg',
        source,
        compoundValues: { systolic: entry.value, diastolic: Number(entry.payload.diastolic) },
        note: entry.note,
        createdAt: new Date().toISOString(),
      })
      entry.payload = { ...(entry.payload ?? {}), recordId: String(id) }
    } else if (entry.type === 'movement' && typeof entry.value === 'number') {
      const id = await exerciseRepository.add({
        date,
        activityType: entry.title,
        durationMinutes: entry.value,
        intensity:
          entry.payload?.intensity === 'hard' || entry.payload?.intensity === 'easy'
            ? entry.payload.intensity
            : 'moderate',
        note: entry.note,
      })
      entry.payload = { ...(entry.payload ?? {}), recordId: String(id) }
    } else if (entry.type === 'wellbeing') {
      const payload = entry.payload ?? {}
      const id = await wellbeingRepository.add({
        date,
        mood: typeof payload.mood === 'number' ? payload.mood : undefined,
        stress: typeof payload.stress === 'number' ? payload.stress : undefined,
        energy: typeof payload.energy === 'number' ? payload.energy : undefined,
        anxiety: typeof payload.anxiety === 'number' ? payload.anxiety : undefined,
        motivation: typeof payload.motivation === 'number' ? payload.motivation : undefined,
        sleepQuality: typeof payload.sleepQuality === 'number' ? payload.sleepQuality : undefined,
        focus: typeof payload.focus === 'number' ? payload.focus : undefined,
        bodyTension: typeof payload.bodyTension === 'number' ? payload.bodyTension : undefined,
        note: entry.note,
        source: source === 'screening' ? 'imported' : source,
        createdAt: new Date().toISOString(),
      })
      entry.payload = { ...payload, recordId: String(id) }
    } else if (entry.type === 'food') {
      const calories = typeof entry.value === 'number' ? entry.value : 0
      const food: Food = {
        id: newId(),
        name: entry.title,
        servingLabel: '1 entry',
        calories,
        proteinG: Number(entry.payload?.proteinG ?? 0),
        carbsG: Number(entry.payload?.carbsG ?? 0),
        fatG: Number(entry.payload?.fatG ?? 0),
        fiberG: Number(entry.payload?.fiberG ?? 0),
        source: 'user-entered',
        confidence: 'low',
      }
      await foodRepository.save(food)
      const id = await foodLogRepository.add({
        date,
        foodId: food.id,
        foodName: food.name,
        meal: entry.context ?? 'Meal',
        servings: 1,
        calories: food.calories,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
        fiberG: food.fiberG,
      })
      entry.payload = { ...(entry.payload ?? {}), recordId: String(id), foodId: food.id }
    } else if (entry.type === 'life-event') {
      const id = newId()
      await lifeEventRepository.save({
        id,
        kind: 'custom',
        title: entry.title,
        startDate: date,
        domains: ['environment'],
        note: entry.note,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      entry.payload = { ...(entry.payload ?? {}), recordId: id }
    } else if (entry.type === 'sleep' && typeof entry.value === 'number') {
      const durationMinutes =
        entry.unit === 'minutes' ? Math.round(entry.value) : Math.round(entry.value * 60)
      const end = new Date(entry.occurredAt)
      const start = new Date(end.getTime() - durationMinutes * 60000)
      const id = await sleepRepository.add({
        date,
        kind: 'primary',
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        durationMinutes,
        timeInBedMinutes: durationMinutes,
        notes: entry.note,
        source: entry.source === 'manual' ? 'manual' : 'imported',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      entry.payload = { ...(entry.payload ?? {}), recordId: String(id) }
    }
    await captureRepository.add(entry)
    await refresh()
    setCaptureOpen(false)
  }

  async function removeCapture(id: string) {
    const entry = await db.captures.get(id)
    const recordId = entry?.payload?.recordId
    const checkInId = entry?.payload?.checkInId
    if (entry?.context === 'journal' && typeof checkInId === 'string') {
      await wellbeingRepository.remove(checkInId)
    }
    if (typeof recordId === 'string') {
      if (entry?.type === 'weight') await db.weights.delete(recordId)
      if (
        [
          'metric',
          'heart-rate',
          'oxygen-saturation',
          'steps',
          'glucose',
          'a1c',
          'cholesterol',
          'hdl-cholesterol',
          'ldl-cholesterol',
          'triglycerides',
          'blood-pressure',
        ].includes(entry?.type ?? '')
      )
        await db.healthMetrics.delete(recordId)
      if (entry?.type === 'movement') await db.exercises.delete(recordId)
      if (entry?.type === 'wellbeing') await db.wellbeingEntries.delete(recordId)
      if (entry?.type === 'life-event') await db.lifeEvents.delete(recordId)
      if (entry?.type === 'food') await db.foodLogs.delete(recordId)
      if (entry?.type === 'sleep') await db.sleepSessions.delete(recordId)
    }
    await captureRepository.remove(id)
    await refresh()
  }

  async function editCapture(entry: CaptureEntry) {
    await captureRepository.update(entry)
    await refresh()
  }

  async function exportWorkspace(format: 'json' | 'csv') {
    const data = {
      exportedAt: new Date().toISOString(),
      profiles: await db.profiles.toArray(),
      goals: await db.goals.toArray(),
      weights: await db.weights.toArray(),
      healthMetrics: await db.healthMetrics.toArray(),
      foods: await db.foods.toArray(),
      foodLogs: await db.foodLogs.toArray(),
      exercises: await db.exercises.toArray(),
      wellbeingEntries: await db.wellbeingEntries.toArray(),
      lifeEvents: await db.lifeEvents.toArray(),
      consentPreferences: await db.consentPreferences.toArray(),
      captures: await db.captures.toArray(),
      dashboardConfigs: await db.dashboardConfigs.toArray(),
      bodyPhotos: await db.bodyPhotos.toArray(),
      medications: await db.medications.toArray(),
      medicationLogs: await db.medicationLogs.toArray(),
      sleepSessions: await db.sleepSessions.toArray(),
      dreamJournalEntries: await db.dreamJournalEntries.toArray(),
      healthRecords: await db.healthRecords.toArray(),
      integrationConnections: await db.integrationConnections.toArray(),
      integrationSyncStates: await db.integrationSyncStates.toArray(),
      integrationSyncRuns: await db.integrationSyncRuns.toArray(),
      sourcePreferences: await db.sourcePreferences.toArray(),
    }
    const body =
      format === 'json'
        ? JSON.stringify(data, null, 2)
        : [
            'occurredAt,type,title,value,unit,source,context,note',
            ...data.captures.map((entry) =>
              [
                entry.occurredAt,
                entry.type,
                entry.title,
                entry.value ?? '',
                entry.unit ?? '',
                entry.source,
                entry.context ?? '',
                entry.note ?? '',
              ]
                .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                .join(','),
            ),
          ].join('\n')
    const blob = new Blob([body], { type: format === 'json' ? 'application/json' : 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `health-workspace-${today()}.${format}`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function deleteCaptureCategory(type: CaptureType) {
    const entries = await db.captures.where('type').equals(type).toArray()
    for (const entry of entries)
      if (typeof entry.payload?.recordId === 'string') await removeCapture(entry.id)
    await db.captures.where('type').equals(type).delete()
    if (type === 'wellbeing') await db.wellbeingEntries.clear()
    if (type === 'life-event') await db.lifeEvents.clear()
    if (type === 'sleep') {
      await db.sleepSessions.clear()
      await db.dreamJournalEntries.clear()
    }
    await refresh()
  }

  async function importWorkspace(file: File) {
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>
      if (!data || typeof data !== 'object') throw new Error('Invalid workspace export')
      await db.transaction(
        'rw',
        [
          db.profiles,
          db.goals,
          db.weights,
          db.healthMetrics,
          db.foods,
          db.foodLogs,
          db.exercises,
          db.wellbeingEntries,
          db.lifeEvents,
          db.consentPreferences,
          db.captures,
          db.dashboardConfigs,
          db.bodyPhotos,
          db.medications,
          db.medicationLogs,
          db.sleepSessions,
          db.dreamJournalEntries,
          db.healthRecords,
          db.integrationConnections,
          db.integrationSyncStates,
          db.integrationSyncRuns,
          db.sourcePreferences,
        ],
        async () => {
          const tables = [
            ['profiles', db.profiles],
            ['goals', db.goals],
            ['weights', db.weights],
            ['healthMetrics', db.healthMetrics],
            ['foods', db.foods],
            ['foodLogs', db.foodLogs],
            ['exercises', db.exercises],
            ['wellbeingEntries', db.wellbeingEntries],
            ['lifeEvents', db.lifeEvents],
            ['consentPreferences', db.consentPreferences],
            ['captures', db.captures],
            ['dashboardConfigs', db.dashboardConfigs],
            ['bodyPhotos', db.bodyPhotos],
            ['medications', db.medications],
            ['medicationLogs', db.medicationLogs],
            ['sleepSessions', db.sleepSessions],
            ['dreamJournalEntries', db.dreamJournalEntries],
            ['healthRecords', db.healthRecords],
            ['integrationConnections', db.integrationConnections],
            ['integrationSyncStates', db.integrationSyncStates],
            ['integrationSyncRuns', db.integrationSyncRuns],
            ['sourcePreferences', db.sourcePreferences],
          ] as const
          for (const [name, table] of tables)
            if (data[name] !== undefined) {
              if (!Array.isArray(data[name])) throw new Error(`Invalid ${name} data`)
              await (table.bulkPut as unknown as (rows: unknown[]) => Promise<unknown>)(
                data[name] as unknown[],
              )
            }
        },
      )
      await refresh()
    } catch {
      window.alert('That file could not be restored. Nothing was changed.')
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <strong>N//XT</strong>
            <span>whole health</span>
          </div>
        </div>
        <nav className="nav" aria-label="Primary navigation">
          <NavButton
            icon={<SunMedium size={18} />}
            label="My Day"
            active={screen === 'today'}
            onClick={() => navigate('today')}
          />
          <NavButton
            icon={<PersonStanding size={18} />}
            label="Body"
            active={screen === 'weight'}
            onClick={() => navigate('weight')}
          />
          <NavButton
            icon={<Pill size={18} />}
            label="Medications"
            active={screen === 'medications'}
            onClick={() => navigate('medications')}
          />
          <NavButton
            icon={<LineChart size={18} />}
            label="Patterns"
            active={screen === 'patterns'}
            onClick={() => navigate('patterns')}
          />
          <NavButton
            icon={<Utensils size={18} />}
            label="Nutrition"
            active={screen === 'nutrition'}
            onClick={() => navigate('nutrition')}
          />
          <NavButton
            icon={<Activity size={18} />}
            label="Activity"
            active={screen === 'activity'}
            onClick={() => navigate('activity')}
          />
          <NavButton
            icon={<Moon size={18} />}
            label="Sleep"
            active={screen === 'sleep'}
            onClick={() => navigate('sleep')}
          />
          <NavButton
            icon={<Brain size={18} />}
            label="Mind"
            active={screen === 'mind'}
            onClick={() => navigate('mind')}
          />
        </nav>
        <div className="sidebar-bottom">
          <NavButton
            icon={<Settings size={18} />}
            label="Settings"
            active={screen === 'settings'}
            onClick={() => navigate('settings')}
          />
          <NavButton
            icon={
              profile.avatarDataUrl ? (
                <img className="nav-profile-avatar" src={profile.avatarDataUrl} alt="" />
              ) : (
                <UserRound size={18} />
              )
            }
            label={profile.displayName || 'Profile'}
            active={screen === 'profile'}
            onClick={() => navigate('profile')}
          />
          <div className="privacy-note">
            <Check size={14} /> Data stays on this device
          </div>
        </div>
      </aside>
      <main className="main-content" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <h1>
              {screen === 'today'
                ? 'Your day, in context'
                : screen === 'weight'
                  ? 'Body journal'
                  : screen === 'sleep'
                    ? 'Sleep journal'
                    : screen === 'medications'
                      ? 'Medication journal'
                      : screen[0].toUpperCase() + screen.slice(1)}
            </h1>
          </div>
          <button type="button" className="topbar-log-button" onClick={() => setCaptureOpen(true)}>
            <Plus size={18} /> Record health data
          </button>
        </header>
        {screen === 'today' && (
          <Today
            profile={profile}
            goals={goals}
            trend={trend}
            metabolic={metabolic}
            nutrition={nutrition}
            healthMetrics={healthMetrics}
            captures={captures}
            logsCount={logs.length}
            exercisesCount={todayExercises.length}
            activityStats={activityStats}
            sleepSessions={sleepSessions}
            projection={projection}
            onNavigate={navigate}
            onOpenCheckIn={() => navigate('mind')}
            dashboard={dashboard}
            onSaveDashboard={saveDashboard}
            onSaveProfile={saveProfile}
          />
        )}
        {screen === 'patterns' && (
          <PatternsPage captures={captures} onDelete={removeCapture} onEdit={editCapture} />
        )}
        {screen === 'weight' && (
          <WeightPage
            profile={profile}
            weights={weights}
            trend={trend}
            healthMetrics={healthMetrics}
            bodyPhotos={bodyPhotos}
            onAddWeight={addWeight}
            onRemoveWeight={removeWeight}
            onAddHealthMetric={addHealthMetric}
            onRemoveHealthMetric={removeHealthMetric}
            onSaveBodyPhoto={saveBodyPhoto}
            onRemoveBodyPhoto={removeBodyPhoto}
            onOpenCheckIn={() => navigate('mind')}
          />
        )}
        {screen === 'nutrition' && (
          <NutritionPage
            foods={foods}
            logs={allFoodLogs}
            target={metabolic.calorieTarget}
            onAddFood={addFood}
            onSaveFood={saveFood}
            onRemoveFood={removeFood}
            onRemoveFoodLog={removeFoodLog}
            onImportMyFitnessPal={importMyFitnessPal}
            onNavigate={navigate}
          />
        )}
        {screen === 'activity' && (
          <ActivityPage exercises={exercises} onAddExercise={addExercise} />
        )}
        {screen === 'sleep' && (
          <SleepPage
            sessions={sleepSessions}
            dreamEntries={dreamJournalEntries}
            onSave={saveSleepSession}
            onRemove={removeSleepSession}
            onSaveDream={saveDreamJournalEntry}
            onRemoveDream={removeDreamJournalEntry}
          />
        )}
        {screen === 'mind' && (
          <MindPreview
            supportStyle={profile.supportStyle ?? 'gentle'}
            workspaceTheme={workspaceTheme}
            onJournal={saveJournalEntry}
            onBreathingSession={saveBreathingSession}
            onSkillPractice={saveMindSkillPractice}
            onDeleteCapture={removeCapture}
            onUpdateCapture={editCapture}
            captures={captures}
            dreamEntries={dreamJournalEntries}
            onDeleteDream={removeDreamJournalEntry}
          />
        )}
        {screen === 'medications' && (
          <MedicationsPage
            medications={medications}
            medicationLogs={medicationLogs}
            onSaveMedication={saveMedication}
            onRemoveMedication={removeMedication}
            onLogMedication={logMedication}
          />
        )}
        {screen === 'profile' && (
          <ProfilePage
            profile={profile}
            goals={goals}
            integrationConnections={integrationConnections}
            onNavigate={navigate}
            onToggleGoal={toggleGoal}
            onSaveProfile={saveProfile}
          />
        )}
        {screen === 'settings' && (
          <SettingsPage
            captures={captures}
            onExport={exportWorkspace}
            onDeleteCategory={deleteCaptureCategory}
            onImport={importWorkspace}
            workspaceTheme={workspaceTheme}
            workspacePalette={workspacePalette}
            workspaceBackground={workspaceBackground}
            workspaceSidebarStyle={workspaceSidebarStyle}
            onThemeChange={setWorkspaceTheme}
            onPaletteChange={setWorkspacePalette}
            onBackgroundChange={setWorkspaceBackground}
            onSidebarStyleChange={setWorkspaceSidebarStyle}
            onReset={async () => {
              await db.delete()
              window.location.reload()
            }}
          />
        )}
      </main>
      <MobileNav screen={screen} onNavigate={navigate} />
      <button
        className="mobile-capture-button"
        aria-label="Record health data"
        onClick={() => setCaptureOpen(true)}
      >
        <Plus size={22} />
        <span>Record</span>
      </button>
      <ScrollToTop />
      {captureOpen && (
        <UniversalCapture onClose={() => setCaptureOpen(false)} onSave={addCapture} />
      )}
      {birthdayMoment && (
        <BirthdayMoment name={profile.displayName} onClose={() => setBirthdayMoment(false)} />
      )}
    </div>
  )
}

export function App() {
  return (
    <AppErrorBoundary>
      <DeleteConfirmationProvider>
        <AppContent />
      </DeleteConfirmationProvider>
    </AppErrorBoundary>
  )
}

function BirthdayMoment({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <aside className="birthday-moment" role="status" aria-live="polite">
      <div className="birthday-confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <i key={index} style={{ '--i': index } as CSSProperties} />
        ))}
      </div>
      <div>
        <p className="eyebrow">A little celebration</p>
        <strong>Happy birthday, {name.split(/\s+/)[0]}.</strong>
        <span>Today can be noticed without needing to be measured.</span>
      </div>
      <button className="icon-button" aria-label="Dismiss birthday message" onClick={onClose}>
        <X size={17} />
      </button>
    </aside>
  )
}

function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 420)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  if (!visible) return null
  return (
    <button
      className="to-top-button"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ArrowUp size={17} />
      <span>Top</span>
    </button>
  )
}

function SectionJumpNav({
  items,
  ariaLabel = 'Page sections',
  customizer,
}: {
  items: Array<[string, string]>
  ariaLabel?: string
  customizer?: ReactNode
}) {
  const [active, setActive] = useState(items[0]?.[0] ?? '')
  useEffect(() => {
    const sections = items
      .map(([id]) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section))
    if (!sections.length) return undefined
    const jumpTopOffset = window.matchMedia('(max-width: 720px)').matches ? -68 : -96
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: `${jumpTopOffset}px 0px -62% 0px`, threshold: [0, 0.2, 0.6] },
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [items])
  return (
    <nav className="section-jump-nav" aria-label={ariaLabel}>
      <span>Jump to</span>
      <div className="section-jump-links">
        {items.map(([id, label]) => (
          <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined}>
            {label}
          </a>
        ))}
      </div>
      {customizer && <div className="section-jump-customizer">{customizer}</div>}
    </nav>
  )
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`nav-button ${active ? 'active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      {active && <ChevronRight size={15} className="nav-arrow" />}
    </button>
  )
}

function MobileNav({
  screen,
  onNavigate,
}: {
  screen: Screen
  onNavigate: (screen: Screen) => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  useEffect(() => {
    setMoreOpen(false)
  }, [screen])
  const moreItems: Array<{ screen: Screen; label: string; icon: ReactNode }> = [
    { screen: 'patterns', label: 'Patterns', icon: <LineChart size={17} /> },
    { screen: 'sleep', label: 'Sleep', icon: <Moon size={17} /> },
    { screen: 'medications', label: 'Medications', icon: <Pill size={17} /> },
    { screen: 'profile', label: 'Profile', icon: <HeartHandshake size={17} /> },
    { screen: 'settings', label: 'Settings', icon: <Settings size={17} /> },
  ]
  const items: Array<{ screen: Screen; label: string; icon: ReactNode }> = [
    { screen: 'today', label: 'My Day', icon: <SunMedium size={19} /> },
    { screen: 'weight', label: 'Body', icon: <PersonStanding size={19} /> },
    { screen: 'nutrition', label: 'Food', icon: <Utensils size={19} /> },
    { screen: 'activity', label: 'Move', icon: <Activity size={19} /> },
    { screen: 'mind', label: 'Mind', icon: <Brain size={19} /> },
  ]
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {items.map((item) => (
        <button
          key={item.screen}
          type="button"
          className={screen === item.screen ? 'active' : ''}
          aria-current={screen === item.screen ? 'page' : undefined}
          onClick={() => {
            onNavigate(item.screen)
            setMoreOpen(false)
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
      <button
        type="button"
        className={
          moreOpen
            ? 'active'
            : ['patterns', 'sleep', 'medications', 'profile', 'settings'].includes(screen)
              ? 'has-current'
              : ''
        }
        onClick={() => setMoreOpen((open) => !open)}
        aria-expanded={moreOpen}
        aria-current={
          ['patterns', 'sleep', 'medications', 'profile', 'settings'].includes(screen)
            ? 'page'
            : undefined
        }
      >
        <MoreHorizontal size={19} />
        <span>More</span>
      </button>
      {moreOpen && (
        <div className="mobile-more-menu">
          {moreItems.map((item) => (
            <button
              key={item.screen}
              type="button"
              className={screen === item.screen ? 'active' : ''}
              onClick={() => {
                onNavigate(item.screen)
                setMoreOpen(false)
              }}
              aria-current={screen === item.screen ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </nav>
  )
}

function Onboarding({
  onComplete,
  onThemeChange,
  onPaletteChange,
  onBackgroundChange,
  onSidebarStyleChange,
}: {
  onComplete: () => Promise<void>
  onThemeChange: (theme: WorkspaceTheme) => void
  onPaletteChange: (palette: WorkspacePalette) => void
  onBackgroundChange: (background: WorkspaceBackground) => void
  onSidebarStyleChange: (style: WorkspaceSidebarStyle) => void
}) {
  const totalSteps = 5
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [avatarDataUrl, setAvatarDataUrl] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [headline, setHeadline] = useState('')
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial')
  const [age] = useState('')
  const [sexAssignedAtBirth] = useState<SexAssignedAtBirth>()
  const [genderIdentity, setGenderIdentity] = useState<GenderIdentity>()
  const [pronouns, setPronouns] = useState<PronounPreference>()
  const [customPronouns, setCustomPronouns] = useState('')
  const [activity, setActivity] = useState<ActivityLevel>('moderate')
  const [supportStyle, setSupportStyle] = useState<SupportStyle>('gentle')
  const [dataDisplay, setDataDisplay] = useState<'simple' | 'detailed'>('simple')
  const [selectedGoals, setSelectedGoals] = useState<GoalKind[]>(['understand-data'])
  const [workspaceTheme, setWorkspaceTheme] = useState<WorkspaceTheme>(() =>
    storedPreference(
      'nxt-workspace-theme',
      'midnight',
      workspaceThemes.map((item) => item.id),
    ),
  )
  const [workspacePalette, setWorkspacePalette] = useState<WorkspacePalette>(() =>
    storedPreference(
      'nxt-workspace-palette',
      'gold',
      workspacePalettes.map((item) => item.id),
    ),
  )
  const [workspaceBackground, setWorkspaceBackground] = useState<WorkspaceBackground>(() =>
    storedPreference(
      'nxt-workspace-background',
      'growth',
      workspaceBackgrounds.map((item) => item.id),
    ),
  )
  const [workspaceSidebarStyle, setWorkspaceSidebarStyle] = useState<WorkspaceSidebarStyle>(() =>
    storedPreference(
      'nxt-workspace-sidebar-style',
      'theme',
      workspaceSidebarStyles.map((item) => item.id),
    ),
  )

  useEffect(() => {
    document.documentElement.dataset.theme = workspaceTheme
    document.documentElement.dataset.palette = workspacePalette
    document.documentElement.dataset.background = workspaceBackground
    document.documentElement.dataset.sidebar = workspaceSidebarStyle
  }, [workspaceBackground, workspacePalette, workspaceSidebarStyle, workspaceTheme])

  function chooseTheme(value: WorkspaceTheme) {
    setWorkspaceTheme(value)
    onThemeChange(value)
  }
  function choosePalette(value: WorkspacePalette) {
    setWorkspacePalette(value)
    onPaletteChange(value)
  }
  function chooseBackground(value: WorkspaceBackground) {
    setWorkspaceBackground(value)
    onBackgroundChange(value)
  }
  function chooseSidebarStyle(value: WorkspaceSidebarStyle) {
    setWorkspaceSidebarStyle(value)
    onSidebarStyleChange(value)
  }
  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('That image is larger than 5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      setAvatarDataUrl(reader.result)
      setAvatarError('')
    }
    reader.onerror = () => setAvatarError('That image could not be read.')
    reader.readAsDataURL(file)
  }
  function toggleGoal(kind: GoalKind) {
    setSelectedGoals((current) =>
      current.includes(kind)
        ? current.filter((candidate) => candidate !== kind)
        : [...current, kind],
    )
  }
  function canAdvance() {
    if (step === 1) return name.trim().length > 0
    if (step === 4) return selectedGoals.length > 0
    return true
  }
  async function finish() {
    const now = new Date().toISOString()
    const impliedEquationSex: Profile['sexForEquation'] =
      sexAssignedAtBirth === 'female'
        ? 'female'
        : sexAssignedAtBirth === 'male'
          ? 'male'
          : 'unspecified'
    const profile: Profile = {
      id: newId(),
      displayName: name.trim(),
      avatarDataUrl: avatarDataUrl || undefined,
      headline: headline.trim() || undefined,
      age: Number(age) || undefined,
      sexAssignedAtBirth,
      genderIdentity,
      pronouns,
      customPronouns: pronouns === 'custom' ? customPronouns.trim() || undefined : undefined,
      sexForEquation: impliedEquationSex,
      unitSystem,
      activityLevel: activity,
      supportStyle,
      dataDisplay,
      todayFocus: Array.from(
        new Set(
          selectedGoals.flatMap(
            (kind) => goalOptions.find((option) => option.kind === kind)?.domains ?? [],
          ),
        ),
      ),
      createdAt: now,
      updatedAt: now,
    }
    await profileRepository.save(profile)
    await Promise.all(
      selectedGoals.map((kind) => {
        const option = goalOptions.find((candidate) => candidate.kind === kind)
        return goalRepository.save({
          id: newId(),
          kind,
          label: option?.label ?? 'Understand my data',
          domains: option?.domains,
          why: option?.description,
          priority: 'medium',
          active: true,
          createdAt: now,
        })
      }),
    )
    await onComplete()
  }

  const currentStepLabel = ['Profile', 'About you', 'Appearance', 'Focus', 'Ready'][step - 1]
  return (
    <div className="onboarding-shell">
      <div className="onboarding-card onboarding-card-redesign">
        <div className="onboarding-brand">
          <div className="brand-mark">N</div>
          <span>N//XT · whole health</span>
        </div>
        <div className="onboarding-progress" aria-label={`Setup step ${step} of ${totalSteps}`}>
          <div className="onboarding-progress-meta">
            <span>Set up your workspace</span>
            <strong>
              Step {step} of {totalSteps} · {currentStepLabel}
            </strong>
          </div>
          <div className="progress onboarding-progress-track">
            <span className="progress-fill" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>
          <div className="onboarding-progress-dots" aria-hidden="true">
            {Array.from({ length: totalSteps }, (_, index) => (
              <span key={index} className={index + 1 <= step ? 'active' : ''} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <section className="onboarding-step">
            <p className="eyebrow">Start with you</p>
            <h1>A health workspace that feels like yours.</h1>
            <p className="lede">
              We’ll start with the person using the app—not a spreadsheet of measurements. You can
              add body context later, whenever it is useful to you.
            </p>
            <div className="onboarding-welcome-grid">
              <div className="onboarding-welcome-card">
                <UserRound size={20} />
                <strong>Build your profile</strong>
                <span>Name, identity, and the kind of support you want.</span>
              </div>
              <div className="onboarding-welcome-card">
                <Sparkles size={20} />
                <strong>Shape the atmosphere</strong>
                <span>Choose colors, imagery, and a navigation style.</span>
              </div>
              <div className="onboarding-welcome-card">
                <HeartPulse size={20} />
                <strong>Choose what matters</strong>
                <span>Point My Day toward the parts of health you want to notice.</span>
              </div>
            </div>
            <label>
              What should we call you? <small>Required · you can change this later</small>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name or nickname"
                autoFocus
              />
            </label>
            <div className="button-row onboarding-actions">
              <span className="onboarding-privacy-note">
                <Check size={15} /> Private on this device
              </span>
              <button
                className="primary-button"
                disabled={!canAdvance()}
                onClick={() => setStep(2)}
              >
                Continue <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="onboarding-step">
            <p className="eyebrow">Your profile</p>
            <h1>Give your workspace a little more context.</h1>
            <p className="lede">
              Everything here is optional except your name. Nothing asks you to prove anything about
              your body.
            </p>
            <div className="onboarding-profile-topline">
              <div className="profile-avatar-preview onboarding-avatar-preview">
                {avatarDataUrl ? (
                  <img src={avatarDataUrl} alt="Profile preview" />
                ) : (
                  <UserRound size={28} aria-hidden="true" />
                )}
              </div>
              <div>
                <span className="field-label">Profile picture</span>
                <div className="button-row">
                  <label className="secondary-button profile-upload-button">
                    {avatarDataUrl ? 'Replace picture' : 'Add a picture'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleAvatarChange}
                    />
                  </label>
                  {avatarDataUrl && (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setAvatarDataUrl('')}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <small>Optional · PNG, JPG, or WebP · 5 MB max</small>
                {avatarError && <small className="form-error">{avatarError}</small>}
              </div>
            </div>
            <label>
              Profile headline <small>Optional · what season of life are you in?</small>
              <input
                value={headline}
                maxLength={80}
                onChange={(event) => setHeadline(event.target.value)}
                placeholder="Building a steadier, more connected life"
              />
            </label>
            <div className="two-col">
              <label>
                Pronouns <small>Optional</small>
                <select
                  value={pronouns ?? ''}
                  onChange={(event) =>
                    setPronouns((event.target.value || undefined) as PronounPreference | undefined)
                  }
                >
                  <option value="">Prefer not to say</option>
                  <option value="she-her">She / her</option>
                  <option value="he-him">He / him</option>
                  <option value="they-them">They / them</option>
                  <option value="she-they">She / they</option>
                  <option value="he-they">He / they</option>
                  <option value="use-my-name">Use my name</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label>
                How should N//XT sound? <small>Choose your default support style</small>
                <select
                  value={supportStyle}
                  onChange={(event) => setSupportStyle(event.target.value as SupportStyle)}
                >
                  <option value="gentle">Gentle · spacious and low-pressure</option>
                  <option value="direct">Clear · practical and concise</option>
                  <option value="reflective">Reflective · curious and spacious</option>
                </select>
              </label>
            </div>
            {pronouns === 'custom' && (
              <label>
                Custom pronouns
                <input
                  value={customPronouns}
                  onChange={(event) => setCustomPronouns(event.target.value)}
                  placeholder="e.g. ze / zir"
                />
              </label>
            )}
            <div className="two-col">
              <label>
                Gender identity <small>Optional</small>
                <select
                  value={genderIdentity ?? ''}
                  onChange={(event) =>
                    setGenderIdentity(
                      (event.target.value || undefined) as GenderIdentity | undefined,
                    )
                  }
                >
                  <option value="">Prefer not to say</option>
                  <option value="woman">Woman</option>
                  <option value="man">Man</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="genderqueer">Genderqueer</option>
                  <option value="questioning">Questioning</option>
                  <option value="self-described">Self-described</option>
                </select>
              </label>
              <label>
                Units <small>Only affects how future entries are displayed</small>
                <select
                  value={unitSystem}
                  onChange={(event) => setUnitSystem(event.target.value as UnitSystem)}
                >
                  <option value="imperial">Imperial · lb / ft</option>
                  <option value="metric">Metric · kg / cm</option>
                </select>
              </label>
            </div>
            <p className="field-help">
              You can edit these details anytime from Profile. Sex assigned at birth and body
              measurements are intentionally not part of setup.
            </p>
            <div className="button-row">
              <button className="secondary-button" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="primary-button" onClick={() => setStep(3)}>
                Continue <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="onboarding-step">
            <p className="eyebrow">Make it yours</p>
            <h1>How should your workspace feel?</h1>
            <p className="lede">
              Try a few combinations. Your choices update the preview immediately and can always be
              changed in Settings.
            </p>
            <div className="appearance-group">
              <span className="field-label">Atmosphere</span>
              <div className="theme-choice-grid">
                {workspaceThemes.map((theme) => (
                  <button
                    type="button"
                    key={theme.id}
                    className={`theme-choice theme-choice-${theme.id} ${workspaceTheme === theme.id ? 'selected' : ''}`}
                    aria-pressed={workspaceTheme === theme.id}
                    onClick={() => chooseTheme(theme.id)}
                  >
                    <span className="theme-choice-preview" aria-hidden="true" />
                    <strong>{theme.label}</strong>
                    <small>{theme.description}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="appearance-group">
              <span className="field-label">Accent color</span>
              <div className="palette-choice-grid">
                {workspacePalettes.map((palette) => (
                  <button
                    type="button"
                    key={palette.id}
                    className={`palette-choice palette-choice-${palette.id} ${workspacePalette === palette.id ? 'selected' : ''}`}
                    aria-pressed={workspacePalette === palette.id}
                    onClick={() => choosePalette(palette.id)}
                  >
                    <span className="palette-swatch" aria-hidden="true" />
                    <span>
                      <strong>{palette.label}</strong>
                      <small>{palette.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="appearance-group">
              <span className="field-label">Background detail</span>
              <div className="imagery-choice-grid">
                {workspaceBackgrounds.map((background) => (
                  <button
                    type="button"
                    key={background.id}
                    className={`imagery-choice imagery-choice-${background.id} ${workspaceBackground === background.id ? 'selected' : ''}`}
                    aria-pressed={workspaceBackground === background.id}
                    onClick={() => chooseBackground(background.id)}
                  >
                    <span className="imagery-choice-preview" aria-hidden="true" />
                    <strong>{background.label}</strong>
                    <small>{background.description}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="appearance-group">
              <span className="field-label">Navigation contrast</span>
              <div className="sidebar-style-choice-grid">
                {workspaceSidebarStyles.map((style) => (
                  <button
                    type="button"
                    key={style.id}
                    className={`sidebar-style-choice sidebar-style-choice-${style.id} ${workspaceSidebarStyle === style.id ? 'selected' : ''}`}
                    aria-pressed={workspaceSidebarStyle === style.id}
                    onClick={() => chooseSidebarStyle(style.id)}
                  >
                    <span className="sidebar-style-preview" aria-hidden="true" />
                    <span>
                      <strong>{style.label}</strong>
                      <small>{style.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="button-row">
              <button className="secondary-button" onClick={() => setStep(2)}>
                Back
              </button>
              <button className="primary-button" onClick={() => setStep(4)}>
                Continue <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="onboarding-step">
            <p className="eyebrow">Your starting point</p>
            <h1>What would you like to notice?</h1>
            <p className="lede">
              Pick anything that feels relevant. This shapes My Day; it does not lock you into a
              goal or a diagnosis.
            </p>
            <div className="goal-sections onboarding-goal-sections">
              {goalSections.map((section) => (
                <section className="goal-section" key={section.key}>
                  <div className="goal-section-heading">
                    <div>
                      <p className="eyebrow">{section.eyebrow}</p>
                      <h3>{section.title}</h3>
                    </div>
                    <span>
                      {
                        section.options.filter((option) => selectedGoals.includes(option.kind))
                          .length
                      }{' '}
                      selected
                    </span>
                  </div>
                  <div className="goal-grid">
                    {section.options.map((option) => (
                      <button
                        type="button"
                        key={option.kind}
                        className={`goal-choice ${selectedGoals.includes(option.kind) ? 'selected' : ''}`}
                        aria-pressed={selectedGoals.includes(option.kind)}
                        onClick={() => toggleGoal(option.kind)}
                      >
                        <span>
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                        <span className="goal-choice-indicator">
                          {selectedGoals.includes(option.kind) ? <Check size={17} /> : '+'}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="two-col onboarding-preferences">
              <label>
                Typical activity <small>Optional context for future suggestions</small>
                <select
                  value={activity}
                  onChange={(event) => setActivity(event.target.value as ActivityLevel)}
                >
                  <option value="sedentary">Sedentary</option>
                  <option value="light">Lightly active</option>
                  <option value="moderate">Moderately active</option>
                  <option value="very">Very active</option>
                  <option value="extra">Extra active</option>
                </select>
              </label>
              <label>
                Data detail <small>How much context should summaries show?</small>
                <select
                  value={dataDisplay}
                  onChange={(event) => setDataDisplay(event.target.value as 'simple' | 'detailed')}
                >
                  <option value="simple">Simple summaries</option>
                  <option value="detailed">Detailed context</option>
                </select>
              </label>
            </div>
            <div className="button-row">
              <button className="secondary-button" onClick={() => setStep(3)}>
                Back
              </button>
              <button
                className="primary-button"
                disabled={!canAdvance()}
                onClick={() => setStep(5)}
              >
                Review setup <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="onboarding-step">
            <p className="eyebrow">Ready when you are</p>
            <h1>{name || 'Your'} workspace is ready to grow with you.</h1>
            <p className="lede">
              Nothing is missing. You can start recording context now and add measurements later
              only if they help you.
            </p>
            <div className="onboarding-review-grid">
              <div>
                <span>Profile</span>
                <strong>{name}</strong>
                <small>
                  {headline || 'No headline yet'}
                  {pronouns ? ` · ${pronounLabels[pronouns] ?? customPronouns}` : ''}
                </small>
              </div>
              <div>
                <span>My Day focus</span>
                <strong>
                  {selectedGoals.length} area{selectedGoals.length === 1 ? '' : 's'} selected
                </strong>
                <small>
                  {dataDisplay === 'simple' ? 'Simple summaries' : 'Detailed context'} ·{' '}
                  {unitSystem === 'imperial' ? 'Imperial units' : 'Metric units'}
                </small>
              </div>
              <div>
                <span>Look and feel</span>
                <strong>{workspaceThemes.find((item) => item.id === workspaceTheme)?.label}</strong>
                <small>
                  {workspacePalettes.find((item) => item.id === workspacePalette)?.label} ·{' '}
                  {workspaceBackgrounds.find((item) => item.id === workspaceBackground)?.label}
                </small>
              </div>
            </div>
            <div className="onboarding-no-metrics">
              <HeartHandshake size={22} />
              <div>
                <strong>No metrics required</strong>
                <p>
                  Your first day can be a blank slate. Add weight, measurements, sleep, food,
                  movement, or nothing at all when it feels right.
                </p>
              </div>
            </div>
            <div className="button-row">
              <button className="secondary-button" onClick={() => setStep(4)}>
                Back
              </button>
              <button className="primary-button" onClick={() => void finish()}>
                Create my workspace <Sparkles size={17} />
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Today({
  profile,
  goals,
  trend,
  metabolic,
  nutrition,
  healthMetrics,
  captures,
  logsCount,
  exercisesCount,
  activityStats,
  sleepSessions,
  projection,
  onNavigate,
  onOpenCheckIn,
  dashboard,
  onSaveDashboard,
  onSaveProfile,
}: {
  profile: Profile
  goals: Goal[]
  trend: ReturnType<typeof calculateWeightTrend>
  metabolic: ReturnType<typeof buildMetabolicSummary>
  nutrition: ReturnType<typeof sumNutrition>
  healthMetrics: Awaited<ReturnType<typeof healthMetricRepository.list>>
  captures: CaptureEntry[]
  logsCount: number
  exercisesCount: number
  activityStats: { minutes: number; intenseMinutes: number; steps: number }
  sleepSessions: SleepSession[]
  projection?: string
  onNavigate: (screen: Screen) => void
  onOpenCheckIn: () => void
  dashboard: DashboardConfiguration
  onSaveDashboard: (configuration: DashboardConfiguration) => Promise<void>
  onSaveProfile: (changes: Partial<Profile>) => Promise<void>
}) {
  const [showCustomize, setShowCustomize] = useState(false)
  const [showAllIntentions, setShowAllIntentions] = useState(false)
  const [showIntentionChooser, setShowIntentionChooser] = useState(false)
  const visible = new Set(dashboard.visible)
  const dashboardOrderIndex = (id: DashboardCardId) => {
    const configuredIndex = dashboard.order?.indexOf(id) ?? -1
    return configuredIndex >= 0
      ? configuredIndex
      : todayCardOptions.findIndex((option) => option.id === id)
  }
  const moduleStyle = (id: DashboardCardId): CSSProperties => ({
    order: dashboardOrderIndex(id),
  })
  const innerCardStyle = (id: DashboardCardId): CSSProperties => ({
    order: dashboardOrderIndex(id),
  })
  const moduleSizeClass = (id: DashboardCardId) => `module-${dashboard.sizes?.[id] ?? 'standard'}`
  const moduleClass = (id: DashboardCardId, base: string) => `${base} ${moduleSizeClass(id)}`
  const focus = profile.todayFocus ?? ['body', 'mind', 'behavior']
  const activeIntentions = goals.filter((goal) => goal.active)
  const focusLabels: Record<HealthDomain, string> = {
    body: 'Body',
    mind: 'Mind',
    behavior: 'Behavior',
    spiritual: 'Meaning',
    environment: 'Environment',
  }
  const selectedIntentionIds =
    profile.myDayIntentions ?? activeIntentions.slice(0, 3).map((goal) => goal.id)
  const visibleIntentions = activeIntentions.filter((goal) =>
    selectedIntentionIds.includes(goal.id),
  )
  const hiddenIntentionCount = activeIntentions.length - visibleIntentions.length

  async function toggleIntentionVisibility(goalId: string) {
    const next = new Set(selectedIntentionIds)
    if (next.has(goalId)) next.delete(goalId)
    else next.add(goalId)
    await onSaveProfile({ myDayIntentions: Array.from(next) })
  }
  const latestCheckIn = [...captures]
    .filter((entry) => entry.title === 'Wellbeing check-in')
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
  const latestReflection = [...captures]
    .filter((entry) => entry.context === 'journal')
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
  const recentSleep = [...sleepSessions].sort((a, b) => b.endAt.localeCompare(a.endAt))
  const latestSleep = recentSleep.find((session) => session.kind === 'primary')
  const sleepStats = sleepSummary(sleepSessions)
  const sleepDurationRange =
    sleepStats.durations.length > 1
      ? Math.max(...sleepStats.durations) - Math.min(...sleepStats.durations)
      : undefined
  const sleepConsistency =
    sleepStats.primary.length < 2
      ? { value: sleepStats.primary.length ? 'Building' : '—', detail: 'Log 2+ nights to compare' }
      : sleepDurationRange !== undefined && sleepDurationRange <= 60
        ? { value: 'Steady', detail: `${sleepDurationRange}m duration range` }
        : sleepDurationRange !== undefined && sleepDurationRange <= 120
          ? { value: 'Mixed', detail: `${sleepDurationRange}m duration range` }
          : { value: 'Variable', detail: `${sleepDurationRange ?? 0}m duration range` }
  const weightDisplay = formatWeight(trend.latestKg, profile.unitSystem)
  const rate =
    trend.rateKgPerWeek === undefined
      ? 'Collecting trend'
      : `${trend.rateKgPerWeek > 0 ? '+' : ''}${round(profile.unitSystem === 'imperial' ? kgToPounds(trend.rateKgPerWeek) : trend.rateKgPerWeek, 1)} ${profile.unitSystem === 'imperial' ? 'lb' : 'kg'}/wk`
  return (
    <div className="page today-page">
      <section className="welcome-row">
        <div>
          <p className="today-greeting">Good morning, {profile.displayName}.</p>
          <DailyAffirmation />
          <div className="today-focus-context" aria-label="My Day focus context">
            <span className="today-focus-label">Your day is shaped by</span>
            <div className="today-focus-chips">
              {focus.map((area) => (
                <span className="today-focus-chip" key={area}>
                  {focusLabels[area]}
                </span>
              ))}
            </div>
            {activeIntentions.length > 0 && (
              <div className="today-intentions">
                <div className="today-intentions-header">
                  <span className="today-priority-label">Active intentions</span>
                  <button
                    className="today-intentions-toggle"
                    aria-expanded={showIntentionChooser}
                    onClick={() => setShowIntentionChooser((open) => !open)}
                  >
                    <SlidersHorizontal size={13} /> Choose
                  </button>
                </div>
                <div className="today-intention-preview">
                  {(showAllIntentions ? activeIntentions : visibleIntentions).map((goal) => (
                    <button
                      className="today-intention-chip"
                      key={goal.id}
                      onClick={() => onNavigate(goalDestination(goal))}
                    >
                      {goal.label}
                      <ChevronRight size={13} />
                    </button>
                  ))}
                  {!showAllIntentions && hiddenIntentionCount > 0 && (
                    <button
                      className="today-intentions-more"
                      onClick={() => setShowAllIntentions(true)}
                    >
                      +{hiddenIntentionCount} more
                    </button>
                  )}
                  {showAllIntentions && hiddenIntentionCount > 0 && (
                    <button
                      className="today-intentions-more"
                      onClick={() => setShowAllIntentions(false)}
                    >
                      Show less
                    </button>
                  )}
                  {!visibleIntentions.length && (
                    <span className="today-intentions-empty">Choose intentions to pin here.</span>
                  )}
                </div>
                {showIntentionChooser && (
                  <div className="today-intention-picker">
                    <div className="today-intention-picker-heading">
                      <strong>Show on My Day</strong>
                      <span>{visibleIntentions.length} selected</span>
                    </div>
                    <div className="today-intention-picker-options">
                      {activeIntentions.map((goal) => (
                        <label className="today-intention-option" key={goal.id}>
                          <input
                            type="checkbox"
                            checked={selectedIntentionIds.includes(goal.id)}
                            onChange={() => void toggleIntentionVisibility(goal.id)}
                          />
                          <span>{goal.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
      <SectionJumpNav
        ariaLabel="My Day sections"
        items={[
          ['today-overview', 'Overview'],
          ['today-context', 'Context'],
          ['today-trends', 'Trends'],
          ['today-movement', 'Movement'],
        ]}
        customizer={
          <button
            className="secondary-button customizer-toggle"
            aria-expanded={showCustomize}
            aria-label={`${showCustomize ? 'Close' : 'Open'} My Day customization`}
            onClick={() => setShowCustomize((open) => !open)}
          >
            {showCustomize ? 'Close customize //' : 'Customize //'}
          </button>
        }
      />
      {showCustomize && (
        <div className="page-feature-customizer is-open">
          <DashboardCustomizer
            dashboard={dashboard}
            onSave={async (next) => {
              await onSaveDashboard(next)
              setShowCustomize(false)
            }}
          />
        </div>
      )}
      {metabolic.estimatedTdee === undefined && (
        <div className="notice">
          <CircleHelp size={18} />
          <div>
            <strong>One more detail will unlock estimates.</strong>
            <span>Add age and height in Profile to see transparent metabolic starting points.</span>
          </div>
          <button onClick={() => onNavigate('profile')}>Review profile</button>
        </div>
      )}
      <div className="today-dashboard-stack">
        {visible.has('overview') && (
          <div
            className={moduleClass('overview', 'metric-grid')}
            id="today-overview"
            style={moduleStyle('overview')}
          >
            {focus.includes('body') && (
              <MetricCard
                label="Weight trend"
                value={rate}
                detail={weightDisplay}
                icon={<Scale size={18} />}
                accent="sage"
              />
            )}
            <MetricCard
              label="Calories"
              value={`${Math.round(nutrition.calories)} kcal`}
              detail={
                metabolic.calorieTarget
                  ? `Target ${metabolic.calorieTarget.toLocaleString()} kcal`
                  : 'Set up your profile'
              }
              icon={<Flame size={18} />}
              accent="amber"
            />
            <MetricCard
              label="Protein"
              value={`${round(nutrition.proteinG)} g`}
              detail="Logged today"
              icon={<HeartPulse size={18} />}
              accent="blue"
            />
            {focus.includes('behavior') && (
              <MetricCard
                label="Movement"
                value={`${exercisesCount} session${exercisesCount === 1 ? '' : 's'}`}
                detail={`${logsCount} food log${logsCount === 1 ? '' : 's'} today`}
                icon={<Footprints size={18} />}
                accent="purple"
              />
            )}
          </div>
        )}
        <div
          className={moduleClass('energy', 'today-detail-grid')}
          id="today-context"
          style={moduleStyle('energy')}
        >
          {visible.has('energy') && (
            <section className="panel energy-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Energy context</p>
                  <h3>How today’s target starts</h3>
                </div>
                <span className="estimate-badge">Estimate</span>
              </div>
              {metabolic.estimatedTdee === undefined ? (
                <p className="muted compact-copy">
                  Complete the available profile context to see the equation ensemble and activity
                  baseline.
                </p>
              ) : (
                <>
                  <div className="energy-stats">
                    <div>
                      <span>Resting estimate</span>
                      <strong>
                        {Math.round(metabolic.ensembleRmr?.valueKcal ?? 0).toLocaleString()} kcal
                      </strong>
                    </div>
                    <div>
                      <span>Baseline TDEE</span>
                      <strong>{Math.round(metabolic.estimatedTdee).toLocaleString()} kcal</strong>
                    </div>
                    <div className="energy-target">
                      <span>Practical target</span>
                      <strong>
                        {Math.round(metabolic.calorieTarget ?? 0).toLocaleString()} kcal
                      </strong>
                    </div>
                  </div>
                  <p className="method-note">
                    <CircleHelp size={13} /> Based on {metabolic.rmr.length} population equations
                    and your activity baseline. Observed data will matter more as it accumulates.
                  </p>
                </>
              )}
            </section>
          )}
          {visible.has('nutrition') && (
            <section className="panel logged-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Logged today</p>
                  <h3>Macro balance</h3>
                </div>
                <button className="text-button" onClick={() => onNavigate('nutrition')}>
                  Add food <ChevronRight size={15} />
                </button>
              </div>
              <MacroBalance nutrition={nutrition} />
            </section>
          )}
          {visible.has('measurements') && (
            <section className="panel metrics-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">More of the picture</p>
                  <h3>Recent measurements</h3>
                </div>
                <button className="text-button" onClick={() => onNavigate('weight')}>
                  Open body journal <ChevronRight size={15} />
                </button>
              </div>
              {healthMetrics.length === 0 ? (
                <p className="muted compact-copy">
                  Blood pressure, cholesterol, glucose, heart rate, and custom observations can live
                  here when you choose to record them.
                </p>
              ) : (
                <div className="metric-observation-list">
                  {[...healthMetrics]
                    .slice(-4)
                    .reverse()
                    .map((metric) => (
                      <div className="metric-observation" key={metric.id}>
                        <span>{metric.label}</span>
                        <strong>
                          {round(metric.value)} {metric.unit}
                        </strong>
                        <small>
                          {metric.date} · {metric.source}
                        </small>
                      </div>
                    ))}
                </div>
              )}
            </section>
          )}
        </div>
        {visible.has('sleep') && (
          <section
            className={moduleClass('sleep', 'panel today-sleep-card')}
            id="today-sleep"
            style={moduleStyle('sleep')}
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Sleep context</p>
                <h3>
                  {latestSleep ? 'Last night, understood in context.' : 'Give rest a place here.'}
                </h3>
              </div>
              <Moon size={20} />
            </div>
            <div className="sleep-snapshot-grid">
              {visible.has('sleep-last') && (
                <div className={moduleSizeClass('sleep-last')} style={innerCardStyle('sleep-last')}>
                  <span>Last primary session</span>
                  <strong>{formatSleepDuration(latestSleep?.durationMinutes)}</strong>
                  <small>
                    {latestSleep?.quality
                      ? `Quality ${latestSleep.quality}/5`
                      : 'No quality rating yet'}
                  </small>
                </div>
              )}
              {visible.has('sleep-average') && (
                <div
                  className={moduleSizeClass('sleep-average')}
                  style={innerCardStyle('sleep-average')}
                >
                  <span>Recent average</span>
                  <strong>{formatSleepDuration(sleepStats.averageMinutes)}</strong>
                  <small>
                    {sleepStats.primary.length
                      ? `${sleepStats.primary.length} recorded nights`
                      : 'Start with one night'}
                  </small>
                </div>
              )}
              {visible.has('sleep-consistency') && (
                <div
                  className={moduleSizeClass('sleep-consistency')}
                  style={innerCardStyle('sleep-consistency')}
                >
                  <span>Sleep consistency</span>
                  <strong>{sleepConsistency.value}</strong>
                  <small>{sleepConsistency.detail}</small>
                </div>
              )}
            </div>
            <p className="muted compact-copy">{sleepInsight(sleepStats)}</p>
            <button className="text-button" onClick={() => onNavigate('sleep')}>
              Open sleep journal <ChevronRight size={15} />
            </button>
          </section>
        )}
        {(visible.has('check-in') || visible.has('reflection')) && (
          <div
            className={moduleClass('check-in', 'today-context-grid')}
            style={moduleStyle('check-in')}
          >
            {visible.has('check-in') && (
              <section
                className={moduleClass('check-in', 'panel today-context-card')}
                style={moduleStyle('check-in')}
              >
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Mind check-in</p>
                    <h3>
                      {latestCheckIn ? 'A snapshot you chose to keep.' : 'How are things feeling?'}
                    </h3>
                  </div>
                  <HeartPulse size={20} />
                </div>
                {latestCheckIn?.note ? (
                  <p className="compact-copy">{latestCheckIn.note}</p>
                ) : (
                  <p className="muted compact-copy">
                    Notice mood, stress, energy, sleep, focus, or body tension without turning any
                    of them into a verdict.
                  </p>
                )}
                <button className="text-button" onClick={onOpenCheckIn}>
                  Open journal check-in <ChevronRight size={15} />
                </button>
              </section>
            )}
            {visible.has('reflection') && (
              <section
                className={moduleClass('reflection', 'panel today-context-card')}
                style={moduleStyle('reflection')}
              >
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Daily reflection</p>
                    <h3>
                      {latestReflection
                        ? 'Your latest words are here.'
                        : 'Make a little room to notice.'}
                    </h3>
                  </div>
                  <BookOpen size={20} />
                </div>
                <p className="muted compact-copy">
                  {latestReflection
                    ? 'Your private journal is linked to the Mind tab and stays on this device.'
                    : 'Use the rotating prompt or write freely. There is no required format.'}
                </p>
                <button className="text-button" onClick={() => onNavigate('mind')}>
                  Open journal <ChevronRight size={15} />
                </button>
              </section>
            )}
          </div>
        )}
        <div
          className={moduleClass('trajectory', 'content-grid')}
          id="today-trends"
          style={moduleStyle('trajectory')}
        >
          {visible.has('trajectory') && (
            <section className="panel trend-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Longitudinal view</p>
                  <h3>Weight trajectory</h3>
                </div>
                <button className="text-button" onClick={() => onNavigate('weight')}>
                  Open history <ChevronRight size={15} />
                </button>
              </div>
              <MiniWeightChart entries={trend} />
              <div className="trend-footer">
                <div>
                  <span>Latest</span>
                  <strong>{weightDisplay}</strong>
                </div>
                <div>
                  <span>Change</span>
                  <strong>
                    {trend.changeKg === undefined
                      ? '—'
                      : `${trend.changeKg > 0 ? '+' : ''}${round(profile.unitSystem === 'imperial' ? kgToPounds(trend.changeKg) : trend.changeKg, 1)} ${profile.unitSystem === 'imperial' ? 'lb' : 'kg'}`}
                  </strong>
                </div>
                <div>
                  <span>Confidence</span>
                  <strong className="capitalize">{trend.confidence}</strong>
                </div>
              </div>
            </section>
          )}
          {visible.has('insight') && (
            <section className="panel insight-panel">
              <div className="insight-icon">
                <Sparkles size={20} />
              </div>
              <p className="eyebrow">Early insight</p>
              <h3>
                {trend.confidence === 'insufficient' || trend.confidence === 'early'
                  ? 'Your baseline is taking shape.'
                  : 'Your trajectory is becoming clearer.'}
              </h3>
              <p>
                {projection
                  ? `At your current trend, your selected target may be reachable around ${projection}. This is a projection, not a promise.`
                  : 'Keep logging a few more measurements. We’ll avoid overreacting to a single reading.'}
              </p>
              <div className="confidence">
                <span className="confidence-dot" /> Confidence:{' '}
                {trend.confidence === 'strong' ? 'strong' : 'building'}
              </div>
            </section>
          )}
        </div>
        {visible.has('movement') && (
          <section
            className={moduleClass('movement', 'panel lifestyle-card')}
            id="today-movement"
            style={moduleStyle('movement')}
          >
            <p className="eyebrow">Movement pulse</p>
            <h3>
              {exercisesCount
                ? `${exercisesCount} movement session${exercisesCount === 1 ? '' : 's'} today`
                : 'No movement logged yet'}
            </h3>
            <p className="muted">
              Capture walking, training, stairs, or the physical work that counts in your life.
            </p>
            <div className="today-ring-row">
              {visible.has('movement-minutes') && (
                <ActivitySignal
                  label="Move"
                  value={activityStats.minutes}
                  target={30}
                  unit="min"
                  color="blue"
                  className={moduleSizeClass('movement-minutes')}
                  style={innerCardStyle('movement-minutes')}
                />
              )}
              {visible.has('movement-steps') && (
                <ActivitySignal
                  label="Steps"
                  value={activityStats.steps}
                  target={8000}
                  unit="steps"
                  color="green"
                  className={moduleSizeClass('movement-steps')}
                  style={innerCardStyle('movement-steps')}
                />
              )}
              {visible.has('movement-intensity') && (
                <ActivitySignal
                  label="Intense activity"
                  value={activityStats.intenseMinutes}
                  target={20}
                  unit="min"
                  color="gold"
                  className={moduleSizeClass('movement-intensity')}
                  style={innerCardStyle('movement-intensity')}
                />
              )}
            </div>
            <button className="text-button" onClick={() => onNavigate('activity')}>
              Open movement <ChevronRight size={15} />
            </button>
          </section>
        )}
        {visible.has('quick-actions') && (
          <section
            className={moduleClass('quick-actions', 'quick-actions')}
            style={moduleStyle('quick-actions')}
          >
            <button onClick={() => onNavigate('nutrition')}>
              <Utensils size={18} />
              <span>
                <strong>Log food</strong>
                <small>Add a meal or snack</small>
              </span>
              <ChevronRight size={16} />
            </button>
            <button onClick={() => onNavigate('activity')}>
              <Activity size={18} />
              <span>
                <strong>Log activity</strong>
                <small>Walking, training, or movement</small>
              </span>
              <ChevronRight size={16} />
            </button>
          </section>
        )}
      </div>
    </div>
  )
}

const fallbackDailyAffirmations = [
  'You are allowed to take the next step at a pace that respects your life.',
  'Your worth is not a measurement you need to improve.',
  'Small acts of care still count, especially on difficult days.',
  'You can notice what is true today without turning it into a verdict.',
  'There is room for progress and rest in the same day.',
  'You do not have to understand everything before you begin caring for yourself.',
  'A gentle return is still a return.',
]

type DailyAffirmationData = {
  quote: string
  author: string
}

function DailyAffirmation() {
  const date = today()
  const fallback: DailyAffirmationData = {
    quote:
      fallbackDailyAffirmations[
        Math.abs(date.split('-').reduce((total, part) => total * 31 + Number(part), 0)) %
          fallbackDailyAffirmations.length
      ],
    author: 'N//XT',
  }
  const [affirmation, setAffirmation] = useState<DailyAffirmationData>(fallback)

  useEffect(() => {
    const cacheKey = `nxt-daily-affirmation:${date}`
    const cached = window.localStorage.getItem(cacheKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Partial<DailyAffirmationData>
        if (parsed.quote && parsed.author) {
          setAffirmation({ quote: parsed.quote, author: parsed.author })
          return
        }
      } catch {
        window.localStorage.removeItem(cacheKey)
      }
    }

    const controller = new AbortController()
    void fetch('https://dummyjson.com/quotes/random', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Daily affirmation request failed')
        const data = (await response.json()) as { quote?: string; author?: string }
        if (!data.quote || !data.author) throw new Error('Daily affirmation was incomplete')
        const next = { quote: data.quote, author: data.author }
        window.localStorage.setItem(cacheKey, JSON.stringify(next))
        setAffirmation(next)
      })
      .catch(() => {
        // Keep the local fallback when the workspace is offline or the service is unavailable.
      })

    return () => controller.abort()
  }, [date])

  return (
    <aside className="daily-affirmation" aria-label="A word for today">
      <span className="daily-affirmation-mark" aria-hidden="true">
        “
      </span>
      <div>
        <p className="eyebrow">A word for today</p>
        <p className="daily-affirmation-text">{affirmation.quote}</p>
        <small>— {affirmation.author}</small>
      </div>
    </aside>
  )
}

function useSectionVisibility(storageKey: string, defaults: string[]) {
  const [visible, setVisible] = useState<string[]>(() => {
    try {
      return JSON.parse(
        window.localStorage.getItem(storageKey) ?? JSON.stringify(defaults),
      ) as string[]
    } catch {
      return defaults
    }
  })
  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(visible))
  }, [storageKey, visible])
  return [visible, setVisible] as const
}

function PageFeatureCustomizer({
  id,
  label,
  title,
  jumpItems,
  jumpAriaLabel,
  options,
  visible,
  onToggle,
}: {
  id?: string
  label: string
  title: string
  jumpItems?: Array<[string, string]>
  jumpAriaLabel?: string
  options: Array<[string, string]>
  visible: string[]
  onToggle: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {jumpItems && (
        <SectionJumpNav
          ariaLabel={jumpAriaLabel ?? `${label} sections`}
          items={jumpItems}
          customizer={
            <button
              className="secondary-button customizer-toggle"
              aria-expanded={open}
              aria-label={`${open ? 'Close' : 'Open'} ${label} customization`}
              onClick={() => setOpen((current) => !current)}
            >
              {open ? 'Close customize //' : 'Customize //'}
            </button>
          }
        />
      )}
      {open && (
        <div id={id} className="page-feature-customizer is-open">
          <section className="panel workspace-customizer dashboard-customizer page-feature-options-panel">
            <div className="panel-heading customizer-bar">
              <div>
                <p className="eyebrow">Customize {label}</p>
                <h3>{title}</h3>
              </div>
              <span className="source-pill">Saved locally</span>
            </div>
            <p className="muted compact-copy">
              Choose what stays in view. Your choices are saved on this device.
            </p>
            <div className="dashboard-card-options page-feature-options">
              {options.map(([key, optionLabel]) => (
                <label
                  key={key}
                  className={`dashboard-card-option ${visible.includes(key) ? 'is-visible' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={visible.includes(key)}
                    onChange={() => onToggle(key)}
                    aria-label={`Show ${optionLabel}`}
                  />
                  <span>
                    <strong>{optionLabel}</strong>
                    <small>Show this section in the workspace.</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function DashboardCustomizer({
  dashboard,
  onSave,
}: {
  dashboard: DashboardConfiguration
  onSave: (configuration: DashboardConfiguration) => Promise<void>
}) {
  const [visible, setVisible] = useState<DashboardCardId[]>(dashboard.visible)
  const [order, setOrder] = useState<DashboardCardId[]>(() =>
    Array.from(
      new Set([...(dashboard.order ?? []), ...todayCardOptions.map((option) => option.id)]),
    ),
  )
  const [sizes, setSizes] = useState<Partial<Record<DashboardCardId, DashboardModuleSize>>>(
    dashboard.sizes ?? {},
  )
  const [draggingId, setDraggingId] = useState<DashboardCardId | null>(null)
  const [dragOverId, setDragOverId] = useState<DashboardCardId | null>(null)
  function move(id: DashboardCardId, direction: -1 | 1) {
    setOrder((current) => {
      const index = current.indexOf(id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }
  function reset() {
    setVisible(defaultTodayCards)
    setOrder(todayCardOptions.map((option) => option.id))
    setSizes({})
  }
  function dropBefore(targetId: DashboardCardId) {
    if (!draggingId || draggingId === targetId) return
    setOrder((current) => {
      const next = [...current]
      const fromIndex = next.indexOf(draggingId)
      const targetIndex = next.indexOf(targetId)
      if (fromIndex < 0 || targetIndex < 0) return current
      next.splice(fromIndex, 1)
      next.splice(next.indexOf(targetId), 0, draggingId)
      return next
    })
    setDraggingId(null)
    setDragOverId(null)
  }
  return (
    <section className="panel workspace-customizer dashboard-customizer">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">My Day layout</p>
          <h3>Show the parts you actually use.</h3>
        </div>
        <span className="source-pill">Saved locally</span>
      </div>
      <p className="muted compact-copy">
        Choose what appears, how each piece fills the available space, and the order that matches
        your actual day. Drag any item to sort it; your underlying records stay intact.
      </p>
      <div className="dashboard-card-options">
        {order.map((id, index) => {
          const option = todayCardOptions.find((candidate) => candidate.id === id)
          if (!option) return null
          return (
            <div
              className={`dashboard-card-option ${visible.includes(option.id) ? 'is-visible' : ''} ${option.nested ? 'is-nested' : ''} ${draggingId === option.id ? 'is-dragging' : ''} ${dragOverId === option.id ? 'is-drag-over' : ''}`}
              key={option.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', option.id)
                setDraggingId(option.id)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setDragOverId(option.id)
              }}
              onDrop={(event) => {
                event.preventDefault()
                dropBefore(option.id)
              }}
              onDragEnd={() => {
                setDraggingId(null)
                setDragOverId(null)
              }}
              title="Drag to reorder"
            >
              <GripVertical className="dashboard-drag-handle" size={16} aria-hidden="true" />
              <input
                aria-label={`Show ${option.label}`}
                type="checkbox"
                checked={visible.includes(option.id)}
                onChange={() =>
                  setVisible((current) =>
                    current.includes(option.id)
                      ? current.filter((id) => id !== option.id)
                      : [...current, option.id],
                  )
                }
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              <select
                aria-label={`${option.label} size`}
                value={sizes[option.id] ?? 'standard'}
                onChange={(event) =>
                  setSizes((current) => ({
                    ...current,
                    [option.id]: event.target.value as DashboardModuleSize,
                  }))
                }
              >
                <option value="compact">Compact</option>
                <option value="standard">Standard</option>
                <option value="wide">Wide</option>
              </select>
              <div className="dashboard-order-controls">
                <button
                  type="button"
                  aria-label={`Move ${option.label} up`}
                  disabled={index === 0}
                  onClick={() => move(option.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${option.label} down`}
                  disabled={index === order.length - 1}
                  onClick={() => move(option.id, 1)}
                >
                  ↓
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="dashboard-customizer-footer">
        <div className="button-row">
          <button className="secondary-button" onClick={reset}>
            Reset recommended
          </button>
          <button
            className="primary-button"
            onClick={() =>
              void onSave({
                id: 'today',
                visible,
                order,
                sizes,
                updatedAt: new Date().toISOString(),
              })
            }
          >
            Save My Day layout
          </button>
        </div>
      </div>
    </section>
  )
}

function MacroBalance({ nutrition }: { nutrition: ReturnType<typeof sumNutrition> }) {
  const macroCalories = [nutrition.proteinG * 4, nutrition.carbsG * 4, nutrition.fatG * 9]
  const total = macroCalories.reduce((sum, value) => sum + value, 0)
  const rows = [
    {
      label: 'Protein',
      value: nutrition.proteinG,
      unit: 'g',
      share: macroCalories[0],
      color: 'protein',
    },
    {
      label: 'Carbohydrates',
      value: nutrition.carbsG,
      unit: 'g',
      share: macroCalories[1],
      color: 'carbs',
    },
    { label: 'Fat', value: nutrition.fatG, unit: 'g', share: macroCalories[2], color: 'fat' },
  ]
  return (
    <div className="macro-bars">
      {rows.map((row) => (
        <div className="macro-row" key={row.label}>
          <div>
            <span>{row.label}</span>
            <strong>
              {round(row.value)}
              {row.unit}
            </strong>
          </div>
          <div className="macro-track">
            <span
              className={row.color}
              style={{ width: `${total ? (row.share / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
      <p className="macro-note">
        Bars show the share of logged macro calories, not a recommended target.
      </p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string
  value: string
  detail: string
  icon: ReactNode
  accent: string
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${accent}`}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function QuickWeightForm({
  unit,
  onSave,
  onCancel,
}: {
  unit: UnitSystem
  onSave: (kg: number) => Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  return (
    <div className="inline-form">
      <label>
        Recorded weight ({unit === 'imperial' ? 'lb' : 'kg'})
        <input
          autoFocus
          type="number"
          min="1"
          step="0.1"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Enter a measurement"
        />
      </label>
      <button
        className="primary-button"
        disabled={Number(value) <= 0}
        onClick={() => onSave(unit === 'imperial' ? Number(value) * 0.45359237 : Number(value))}
      >
        Save
      </button>
      <button className="icon-button" onClick={onCancel} aria-label="Cancel">
        <X size={18} />
      </button>
    </div>
  )
}

function MiniWeightChart({ entries }: { entries: ReturnType<typeof calculateWeightTrend> }) {
  return (
    <div className="chart-empty">
      <div className="chart-line">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>
          {entries.rateKgPerWeek === undefined
            ? 'Trend needs more data'
            : 'Trend is calculated from your entries'}
        </strong>
        <p>
          We use a smoothed relationship over time instead of treating every scale reading as a
          verdict.
        </p>
      </div>
    </div>
  )
}

function BodyTrendChart({
  weights,
  unit,
}: {
  weights: Awaited<ReturnType<typeof weightRepository.list>>
  unit: UnitSystem
}) {
  const recent = weights.slice(-12)
  if (recent.length === 0) {
    return <EmptyState text="Record a few weigh-ins to see your body trend here." />
  }
  if (recent.length === 1) {
    return (
      <div className="body-trend-chart body-chart-not-ready">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Weight trend</p>
            <h4>One reading saved</h4>
          </div>
          <strong>{formatWeight(recent[0].weightKg, unit)}</strong>
        </div>
        <div className="single-chart-point" aria-hidden="true">
          <span />
        </div>
        <p className="muted compact-copy">
          Add one more weigh-in on another date and this will become a trend instead of implying a
          change from one point.
        </p>
      </div>
    )
  }
  const values = recent.map((entry) => entry.weightKg)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(0.5, max - min)
  const points = values
    .map((value, index) => {
      const x = recent.length === 1 ? 50 : (index / (recent.length - 1)) * 100
      const y = 92 - ((value - min) / span) * 74
      return `${x},${y}`
    })
    .join(' ')
  return (
    <div className="body-trend-chart">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Weight trend</p>
          <h4>Recent body readings</h4>
        </div>
        <span className="muted">
          {recent.length} reading{recent.length === 1 ? '' : 's'}
        </span>
      </div>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="Recent weight trend chart"
        preserveAspectRatio="none"
      >
        <path className="body-chart-gridline" d="M0 18H100 M0 55H100 M0 92H100" />
        <polyline points={points} />
        {recent.map((entry, index) => {
          const x = recent.length === 1 ? 50 : (index / (recent.length - 1)) * 100
          const y = 92 - ((entry.weightKg - min) / span) * 74
          return <circle key={entry.id} cx={x} cy={y} r="1.7" />
        })}
      </svg>
      <div className="body-chart-axis">
        <span>{recent[0].date}</span>
        <strong>{formatWeight(recent.at(-1)?.weightKg, unit)}</strong>
        <span>{recent.at(-1)?.date}</span>
      </div>
      <details className="chart-data-details">
        <summary>View recorded values</summary>
        <ul>
          {recent.map((entry) => (
            <li key={entry.id}>
              <span>{entry.date}</span>
              <strong>{formatWeight(entry.weightKg, unit)}</strong>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function WeightPage({
  profile,
  weights,
  trend,
  healthMetrics,
  bodyPhotos,
  onAddWeight,
  onRemoveWeight,
  onAddHealthMetric,
  onRemoveHealthMetric,
  onSaveBodyPhoto,
  onRemoveBodyPhoto,
  onOpenCheckIn,
}: {
  profile: Profile
  weights: Awaited<ReturnType<typeof weightRepository.list>>
  trend: ReturnType<typeof calculateWeightTrend>
  healthMetrics: Awaited<ReturnType<typeof healthMetricRepository.list>>
  bodyPhotos: BodyPhotoEntry[]
  onAddWeight: (kg: number) => Promise<void>
  onRemoveWeight: (id: string) => Promise<void>
  onAddHealthMetric: (entry: Omit<HealthMetricEntry, 'id' | 'createdAt'>) => Promise<void>
  onRemoveHealthMetric: (id: string) => Promise<void>
  onSaveBodyPhoto: (entry: Omit<BodyPhotoEntry, 'id'>) => Promise<void>
  onRemoveBodyPhoto: (id: string) => Promise<void>
  onOpenCheckIn: () => void
}) {
  const confirmDelete = useDeleteConfirmation()
  const [show, setShow] = useState(false)
  const [showMetric, setShowMetric] = useState(false)
  const [showPhoto, setShowPhoto] = useState(false)
  const [comparePhotoIds, setComparePhotoIds] = useState<string[]>([])
  const [visibleFeatures, setVisibleFeatures] = useState<string[]>(() => {
    try {
      return JSON.parse(
        window.localStorage.getItem('nxt-body-visible-features') ??
          '["overview","trends","measurements","history","photos"]',
      ) as string[]
    } catch {
      return ['overview', 'trends', 'measurements', 'history', 'photos']
    }
  })
  useEffect(() => {
    window.localStorage.setItem('nxt-body-visible-features', JSON.stringify(visibleFeatures))
  }, [visibleFeatures])
  useEffect(() => {
    if (!show && !showMetric && !showPhoto) return
    const frame = window.requestAnimationFrame(() => {
      const target = ['body-capture-weight', 'body-capture-metric', 'body-capture-photo']
        .map((id) => document.getElementById(id))
        .find((element): element is HTMLElement => Boolean(element))
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [show, showMetric, showPhoto])
  const recentMeasurements = [...healthMetrics]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
  function toggleFeature(feature: string) {
    setVisibleFeatures((current) =>
      current.includes(feature)
        ? current.filter((item) => item !== feature)
        : [...current, feature],
    )
  }
  return (
    <div className="page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Body journal</p>
          <h2>Your physical health, in context.</h2>
          <p className="muted">
            Weight is one signal among measurements, photos, and how your body feels day to day.
          </p>
        </div>
        <div className="button-row">
          <button className="primary-button" onClick={() => setShow(true)}>
            <Plus size={17} /> Record weigh-in
          </button>
          <button className="secondary-button" onClick={() => setShowMetric((value) => !value)}>
            <Plus size={17} /> Body measurement
          </button>
          <button className="secondary-button" onClick={() => setShowPhoto((value) => !value)}>
            <Camera size={17} /> Body photo
          </button>
          <button className="secondary-button" onClick={onOpenCheckIn}>
            <HeartPulse size={17} /> Journal check-in
          </button>
        </div>
      </section>
      <PageFeatureCustomizer
        id="body-customizer"
        label="Body"
        title="Keep the signals that matter to you in view."
        jumpAriaLabel="Body sections"
        jumpItems={
          [
            visibleFeatures.includes('overview') && ['body-overview', 'Overview'],
            visibleFeatures.includes('trends') && ['body-trends', 'Charts'],
            visibleFeatures.includes('measurements') && ['body-measurements', 'Measurements'],
            visibleFeatures.includes('history') && ['body-history', 'History'],
            visibleFeatures.includes('photos') && ['body-photos', 'Photos'],
          ].filter(Boolean) as Array<[string, string]>
        }
        options={[
          ['overview', 'Overview'],
          ['trends', 'Charts'],
          ['measurements', 'Measurements'],
          ['history', 'Reading history'],
          ['photos', 'Progress photos'],
        ]}
        visible={visibleFeatures}
        onToggle={toggleFeature}
      />
      {show && (
        <div id="body-capture-weight">
          <QuickWeightForm
            unit={profile.unitSystem}
            onSave={async (value) => {
              await onAddWeight(value)
              setShow(false)
            }}
            onCancel={() => setShow(false)}
          />
        </div>
      )}
      {showMetric && (
        <section className="panel form-panel body-tool-panel" id="body-capture-metric">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Body measurements</p>
              <h3>Track more than the scale.</h3>
            </div>
            <span className="source-pill">Optional</span>
          </div>
          <p className="muted compact-copy">
            Waist, hip, body-fat, and other observations can add context. They are not a score.
          </p>
          <MetricQuickAdd
            unit={profile.unitSystem}
            onSave={async (entry) => {
              await onAddHealthMetric(entry)
              setShowMetric(false)
            }}
            onCancel={() => setShowMetric(false)}
          />
        </section>
      )}
      {showPhoto && (
        <div id="body-capture-photo">
          <BodyPhotoCapture
            onSave={async (entry) => {
              await onSaveBodyPhoto(entry)
              setShowPhoto(false)
            }}
            onCancel={() => setShowPhoto(false)}
          />
        </div>
      )}
      {visibleFeatures.includes('overview') && (
        <div className="summary-strip" id="body-overview">
          <div>
            <span>Latest</span>
            <strong>{formatWeight(trend.latestKg, profile.unitSystem)}</strong>
          </div>
          <div>
            <span>Average logged</span>
            <strong>{formatWeight(trend.averageKg, profile.unitSystem)}</strong>
          </div>
          <div>
            <span>Change</span>
            <strong>
              {weights.length < 2 || trend.changeKg === undefined
                ? '—'
                : formatWeight(trend.changeKg, profile.unitSystem)}
            </strong>
          </div>
          <div>
            <span>Trend confidence</span>
            <strong className="capitalize">
              {weights.length < 2 ? 'Not enough yet' : trend.confidence}
            </strong>
          </div>
        </div>
      )}
      {(visibleFeatures.includes('trends') || visibleFeatures.includes('measurements')) && (
        <div className="body-overview-grid">
          {visibleFeatures.includes('trends') && (
            <section className="panel body-chart-panel" id="body-trends">
              <BodyTrendChart weights={weights} unit={profile.unitSystem} />
            </section>
          )}
          <div className="body-overview-side">
            {visibleFeatures.includes('measurements') && (
              <section className="panel recent-measurements-panel" id="body-measurements">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Latest measurements</p>
                    <h3>Recent body signals</h3>
                  </div>
                  <button className="text-button" onClick={() => setShowMetric(true)}>
                    Record measurement <Plus size={15} />
                  </button>
                </div>
                {recentMeasurements.length === 0 ? (
                  <EmptyState text="Add a measurement when it is useful to you." />
                ) : (
                  <div className="body-measurement-cards">
                    {recentMeasurements.map((metric) => (
                      <div key={metric.id} className="body-measurement-card">
                        <div>
                          <span>{metric.label}</span>
                          <strong>
                            {round(metric.value)} {metric.unit}
                          </strong>
                          <small>{metric.date}</small>
                        </div>
                        <button
                          className="icon-button danger"
                          aria-label={`Delete ${metric.label} measurement`}
                          onClick={async () => {
                            if (await confirmDelete(`Delete this ${metric.label} measurement?`))
                              await onRemoveHealthMetric(metric.id)
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}
      {visibleFeatures.includes('history') && (
        <section className="panel table-panel" id="body-history">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Body journal</p>
              <h3>
                {weights.length} weight reading{weights.length === 1 ? '' : 's'}
              </h3>
            </div>
            <span className="source-pill">
              <Check size={13} /> Local only
            </span>
          </div>
          {weights.length === 0 ? (
            <EmptyState text="No weight entries yet." />
          ) : (
            <div className="entry-list">
              {[...weights].reverse().map((entry) => (
                <div className="entry-row" key={entry.id}>
                  <div className="entry-date">
                    <strong>
                      {new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </strong>
                    <span>{entry.source} entry</span>
                  </div>
                  <strong>{formatWeight(entry.weightKg, profile.unitSystem)}</strong>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete ${formatWeight(entry.weightKg, profile.unitSystem)} reading`}
                    onClick={async () => {
                      if (await confirmDelete('Delete this weight reading?'))
                        await onRemoveWeight(entry.id)
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {visibleFeatures.includes('photos') && (
        <section className="panel table-panel" id="body-photos">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Body context</p>
              <h3>Measurements and photos</h3>
            </div>
            <span className="source-pill">Private · local</span>
          </div>
          {bodyPhotos.length === 0 ? (
            <EmptyState text="Add a private progress photo when visual context is useful to you." />
          ) : (
            <>
              {comparePhotoIds.length === 2 && (
                <div className="photo-compare-grid">
                  {comparePhotoIds.map((id) => {
                    const photo = bodyPhotos.find((entry) => entry.id === id)
                    if (!photo) return null
                    return (
                      <figure key={photo.id}>
                        <img src={photo.dataUrl} alt={photo.date} />
                        <figcaption>{photo.date}</figcaption>
                      </figure>
                    )
                  })}
                </div>
              )}
              {bodyPhotos.length > 0 && (
                <div className="body-photo-grid">
                  {[...bodyPhotos].reverse().map((photo) => (
                    <figure
                      className={comparePhotoIds.includes(photo.id) ? 'selected' : ''}
                      key={photo.id}
                    >
                      <img src={photo.dataUrl} alt={`Private body photo from ${photo.date}`} />
                      <figcaption>
                        <span>
                          <button
                            className="text-button"
                            aria-pressed={comparePhotoIds.includes(photo.id)}
                            onClick={() =>
                              setComparePhotoIds((current) =>
                                current.includes(photo.id)
                                  ? current.filter((id) => id !== photo.id)
                                  : current.length < 2
                                    ? [...current, photo.id]
                                    : [current[1], photo.id],
                              )
                            }
                          >
                            {comparePhotoIds.includes(photo.id) ? 'Selected' : 'Compare'}
                          </button>{' '}
                          {photo.date} · {photo.pose ?? 'custom'}
                        </span>
                        <button
                          className="text-button danger-text"
                          onClick={async () => {
                            if (await confirmDelete('Delete this private body photo?'))
                              await onRemoveBodyPhoto(photo.id)
                          }}
                        >
                          Delete
                        </button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

function BodyPhotoCapture({
  onSave,
  onCancel,
}: {
  onSave: (entry: Omit<BodyPhotoEntry, 'id'>) => Promise<void>
  onCancel: () => void
}) {
  const [date, setDate] = useState(today())
  const [journalDate, setJournalDate] = useState(today())
  const [dataUrl, setDataUrl] = useState('')
  const [note, setNote] = useState('')
  const [pose, setPose] = useState<BodyPhotoEntry['pose']>('front')
  const [error, setError] = useState('')
  function readPhoto(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setDataUrl(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
  }
  return (
    <section className="panel form-panel body-photo-capture">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Private body photo</p>
          <h3>Keep visual context on this device.</h3>
        </div>
        <span className="source-pill">Never uploaded</span>
      </div>
      <p className="muted compact-copy">
        Choose an image from this device or take one on a supported phone. Photos are stored locally
        with your workspace and are not sent to a provider.
      </p>
      <div className="two-col">
        <label>
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          Associate with journal date
          <input
            type="date"
            value={journalDate}
            onChange={(event) => setJournalDate(event.target.value)}
          />
        </label>
      </div>
      <div className="two-col">
        <label>
          Pose
          <select
            value={pose}
            onChange={(event) => setPose(event.target.value as BodyPhotoEntry['pose'])}
          >
            <option value="front">Front</option>
            <option value="side">Side</option>
            <option value="back">Back</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      </div>
      <div className="two-col">
        <label>
          Photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => readPhoto(event.target.files?.[0])}
          />
        </label>
      </div>
      <label>
        Note (optional)
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Context only"
        />
      </label>
      {dataUrl && (
        <img
          className="body-photo-preview"
          src={dataUrl}
          alt="Selected private body photo preview"
        />
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="button-row">
        <button
          className="primary-button"
          disabled={!dataUrl}
          onClick={() =>
            void onSave({
              date: date || today(),
              journalDate: journalDate || undefined,
              dataUrl,
              note: note.trim() || undefined,
              pose,
              createdAt: new Date().toISOString(),
            })
          }
        >
          Save photo locally
        </button>
        <button className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}

function SleepPage({
  sessions,
  dreamEntries,
  onSave,
  onRemove,
  onSaveDream,
  onRemoveDream,
}: {
  sessions: SleepSession[]
  dreamEntries: DreamJournalEntry[]
  onSave: (entry: Omit<SleepSession, 'id'>) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onSaveDream: (entry: Omit<DreamJournalEntry, 'id'>) => Promise<void>
  onRemoveDream: (id: string) => Promise<void>
}) {
  const confirmDelete = useDeleteConfirmation()
  const [formOpen, setFormOpen] = useState(false)
  const [kind, setKind] = useState<'primary' | 'nap'>('primary')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [quality, setQuality] = useState<SleepQuality | undefined>()
  const [rested, setRested] = useState<SleepQuality | undefined>()
  const [awakenings, setAwakenings] = useState('')
  const [notes, setNotes] = useState('')
  const [dreamTitle, setDreamTitle] = useState('')
  const [dreamContent, setDreamContent] = useState('')
  const [dreamSessionId, setDreamSessionId] = useState('')
  const summary = sleepSummary(sessions)
  const recent = [...sessions].sort((a, b) => b.endAt.localeCompare(a.endAt))
  function openForm() {
    const now = new Date()
    const prior = new Date(now.getTime() - 8 * 60 * 60 * 1000)
    const localValue = (value: Date) => {
      const offset = value.getTimezoneOffset() * 60000
      return new Date(value.getTime() - offset).toISOString().slice(0, 16)
    }
    setStartAt(localValue(prior))
    setEndAt(localValue(now))
    setKind('primary')
    setQuality(undefined)
    setRested(undefined)
    setAwakenings('')
    setNotes('')
    setFormOpen(true)
  }
  async function submit() {
    const durationMinutes = sleepDurationMinutes(startAt, endAt)
    if (!startAt || !endAt || durationMinutes < 1) return
    await onSave({
      date: endAt.slice(0, 10),
      kind,
      startAt,
      endAt,
      durationMinutes,
      timeInBedMinutes: durationMinutes,
      quality,
      rested,
      awakenings: awakenings === '' ? undefined : Math.max(0, Number(awakenings)),
      notes: notes.trim() || undefined,
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setFormOpen(false)
  }
  return (
    <div className="page sleep-page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Sleep journal</p>
          <h2>Rest, without pretending it is a score.</h2>
          <p className="muted">
            Record what happened, how restorative it felt, and the timing around it. Stages only
            appear when a connected source provides them.
          </p>
        </div>
        <button className="primary-button" onClick={openForm}>
          <Plus size={17} /> Record sleep
        </button>
      </section>
      <SectionJumpNav
        ariaLabel="Sleep sections"
        items={[
          ['sleep-overview', 'Overview'],
          ['sleep-entry', 'Record'],
          ['dream-journal', 'Dream journal'],
          ['sleep-history', 'History'],
        ]}
      />
      <section className="summary-strip sleep-summary-strip" id="sleep-overview">
        <div>
          <span>Recent average</span>
          <strong>{formatSleepDuration(summary.averageMinutes)}</strong>
        </div>
        <div>
          <span>Average quality</span>
          <strong>{summary.averageQuality ? `${summary.averageQuality}/5` : '—'}</strong>
        </div>
        <div>
          <span>Timing range</span>
          <strong>
            {summary.bedtimeRange === undefined ? '—' : `${Math.round(summary.bedtimeRange / 60)}h`}
          </strong>
        </div>
        <div>
          <span>Recorded nights</span>
          <strong>{summary.primary.length}</strong>
        </div>
      </section>
      <section className="sleep-entry-anchor" id="sleep-entry">
        {formOpen ? (
          <div className="panel form-panel sleep-entry-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Manual sleep entry</p>
                <h3>What kind of rest are you recording?</h3>
              </div>
              <span className="source-pill">Local only</span>
            </div>
            <div className="segmented-control" role="group" aria-label="Sleep session type">
              {(['primary', 'nap'] as const).map((option) => (
                <button
                  key={option}
                  className={kind === option ? 'selected' : ''}
                  aria-pressed={kind === option}
                  onClick={() => setKind(option)}
                >
                  {option === 'primary' ? 'Overnight' : 'Nap'}
                </button>
              ))}
            </div>
            <div className="two-col">
              <label>
                Started
                <input
                  type="datetime-local"
                  value={startAt}
                  aria-label="Sleep start time"
                  onChange={(event) => setStartAt(event.target.value)}
                />
              </label>
              <label>
                Ended
                <input
                  type="datetime-local"
                  value={endAt}
                  aria-label="Sleep end time"
                  onChange={(event) => setEndAt(event.target.value)}
                />
              </label>
            </div>
            <div className="sleep-rating-grid">
              <SleepRating label="Quality" value={quality} onChange={setQuality} />
              <SleepRating label="Rested" value={rested} onChange={setRested} />
            </div>
            <div className="two-col">
              <label>
                Awakenings <span className="muted">(optional)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={awakenings}
                  aria-label="Number of awakenings"
                  onChange={(event) => setAwakenings(event.target.value)}
                  placeholder="0"
                />
              </label>
              <label>
                Notes <span className="muted">(optional)</span>
                <input
                  value={notes}
                  aria-label="Sleep notes"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="What affected rest?"
                />
              </label>
            </div>
            <p className="form-hint">
              Duration: <strong>{formatSleepDuration(sleepDurationMinutes(startAt, endAt))}</strong>
            </p>
            <div className="button-row">
              <button
                className="primary-button"
                disabled={!startAt || !endAt}
                onClick={() => void submit()}
              >
                Save sleep entry
              </button>
              <button className="secondary-button" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="sleep-entry-prompt">
            <div>
              <p className="eyebrow">Record</p>
              <p className="muted compact-copy">
                Add an overnight session or a nap whenever you’re ready.
              </p>
            </div>
            <button className="secondary-button" onClick={openForm}>
              <Plus size={16} /> Record sleep
            </button>
          </div>
        )}
      </section>
      <section className="panel sleep-insight-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Pattern, not judgment</p>
            <h3>What the current record suggests</h3>
          </div>
          <Moon size={20} />
        </div>
        <p>{sleepInsight(summary)}</p>
        <p className="muted compact-copy">
          Timing range is calculated from your recorded sessions. It is not a recommendation or a
          diagnosis.
        </p>
      </section>
      <section className="panel dream-journal-panel" id="dream-journal">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Dream journal</p>
            <h3>Keep the felt experience, without turning it into a score.</h3>
          </div>
          <span className="source-pill">Private</span>
        </div>
        <p className="muted compact-copy">
          Dream notes are optional personal reflections. They are not medical evidence or an
          interpretation of your sleep.
        </p>
        <div className="dream-journal-form">
          <label>
            Title <span className="muted">(optional)</span>
            <input
              value={dreamTitle}
              aria-label="Dream note title"
              onChange={(event) => setDreamTitle(event.target.value)}
              placeholder="A word or image to remember"
            />
          </label>
          <label>
            Link to sleep entry <span className="muted">(optional)</span>
            <select
              value={dreamSessionId}
              aria-label="Link dream note to sleep entry"
              onChange={(event) => setDreamSessionId(event.target.value)}
            >
              <option value="">Keep it date-only</option>
              {recent.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.kind === 'nap' ? 'Nap' : 'Overnight'} ·{' '}
                  {new Date(session.endAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>
          <label className="dream-journal-content">
            What do you remember?
            <textarea
              value={dreamContent}
              aria-label="Dream note"
              onChange={(event) => setDreamContent(event.target.value)}
              placeholder="Write as much or as little as feels useful."
              rows={4}
            />
          </label>
          <div className="button-row">
            <button
              className="primary-button"
              disabled={!dreamContent.trim()}
              onClick={() => {
                void onSaveDream({
                  sleepSessionId: dreamSessionId || undefined,
                  date: dreamSessionId
                    ? (sessions.find((session) => session.id === dreamSessionId)?.date ?? today())
                    : today(),
                  title: dreamTitle.trim() || undefined,
                  content: dreamContent.trim(),
                  privacy: 'private',
                  source: 'manual',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })
                setDreamTitle('')
                setDreamContent('')
                setDreamSessionId('')
              }}
            >
              Save private note
            </button>
          </div>
        </div>
        {dreamEntries.length > 0 && (
          <div className="dream-entry-list">
            {dreamEntries.slice(0, 5).map((entry) => (
              <article className="dream-entry" key={entry.id}>
                <div>
                  <strong>{entry.title || 'Untitled dream note'}</strong>
                  <small>{new Date(`${entry.date}T12:00:00`).toLocaleDateString()}</small>
                </div>
                <p>{entry.content}</p>
                <button
                  className="icon-button danger"
                  aria-label="Delete dream journal note"
                  onClick={async () => {
                    if (await confirmDelete('Delete this private dream note?'))
                      await onRemoveDream(entry.id)
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="panel table-panel" id="sleep-history">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Recent sleep</p>
            <h3>Your rest record</h3>
          </div>
          <span className="source-pill">
            <Check size={13} /> Local first
          </span>
        </div>
        {recent.length === 0 ? (
          <EmptyState text="No sleep entries yet. Start with a simple overnight record or nap." />
        ) : (
          <div className="entry-list">
            {recent.map((session) => (
              <div className="entry-row sleep-entry-row" key={session.id}>
                <div className="entry-date">
                  <strong>{session.kind === 'nap' ? 'Nap' : 'Overnight sleep'}</strong>
                  <span>
                    {new Date(session.endAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="sleep-entry-detail">
                  <strong>{formatSleepDuration(session.durationMinutes)}</strong>
                  <span>
                    {session.quality ? `Quality ${session.quality}/5` : 'No rating'}
                    {session.awakenings !== undefined ? ` · ${session.awakenings} awakenings` : ''}
                  </span>
                </div>
                <button
                  className="icon-button danger"
                  aria-label="Delete sleep entry"
                  onClick={async () => {
                    if (await confirmDelete('Delete this sleep entry?')) await onRemove(session.id)
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SleepRating({
  label,
  value,
  onChange,
}: {
  label: string
  value: SleepQuality | undefined
  onChange: (value: SleepQuality) => void
}) {
  return (
    <fieldset className="sleep-rating">
      <legend>{label}</legend>
      <div>
        {([1, 2, 3, 4, 5] as SleepQuality[]).map((rating) => (
          <button
            key={rating}
            type="button"
            className={value === rating ? 'selected' : ''}
            aria-pressed={value === rating}
            onClick={() => onChange(rating)}
          >
            {rating}
          </button>
        ))}
      </div>
      <small>1 low · 5 high</small>
    </fieldset>
  )
}

function NutritionPage({
  foods,
  logs,
  target,
  onAddFood,
  onSaveFood,
  onRemoveFood,
  onRemoveFoodLog,
  onImportMyFitnessPal,
  onNavigate,
}: {
  foods: Food[]
  logs: Awaited<ReturnType<typeof foodLogRepository.list>>
  target?: number
  onAddFood: (food: Food, servings: number, meal: string, date?: string) => Promise<void>
  onSaveFood: (food: Food) => Promise<void>
  onRemoveFood: (id: string) => Promise<void>
  onRemoveFoodLog: (id: string) => Promise<void>
  onImportMyFitnessPal: (file: File) => Promise<void>
  onNavigate: (screen: Screen) => void
}) {
  const confirmDelete = useDeleteConfirmation()
  const [query, setQuery] = useState('')
  const [barcode, setBarcode] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [remoteFoods, setRemoteFoods] = useState<Food[]>([])
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [providerState, setProviderState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [providerMessage, setProviderMessage] = useState('')
  const [providerSearched, setProviderSearched] = useState(false)
  const [providerAllowed, setProviderAllowed] = useState(false)
  const [customFoodOpen, setCustomFoodOpen] = useState(false)
  const [customFood, setCustomFood] = useState({
    name: '',
    servingLabel: '1 serving',
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    fiberG: '',
  })
  const [selected, setSelected] = useState<Food>()
  const [servings, setServings] = useState('1')
  const [meal, setMeal] = useState('Snack')
  const [selectedDate, setSelectedDate] = useState(today())
  const [visibleSections, setVisibleSections] = useSectionVisibility('nxt-nutrition-sections', [
    'planner',
    'search',
    'log',
  ])
  const visibleRemoteFoods = submittedQuery === query.trim() ? remoteFoods : []
  const filtered = [...visibleRemoteFoods, ...foods].filter(
    (food, index, all) =>
      all.findIndex((candidate) => candidate.id === food.id) === index &&
      food.name.toLowerCase().includes(query.toLowerCase()),
  )
  const dateLogs = logs.filter((log) => log.date === selectedDate)
  const totals = calculateDailyNutritionTotals(logs, selectedDate)
  const mealSummaries = summarizeMeals(logs, selectedDate)
  useEffect(() => {
    void consentRepository
      .list()
      .then((saved) =>
        setProviderAllowed(
          saved.some((preference) => preference.scope === 'provider-lookups' && preference.granted),
        ),
      )
  }, [])
  async function searchOnline() {
    if (query.trim().length < 2) return
    if (!providerAllowed) {
      setProviderState('error')
      setProviderMessage(
        'Provider lookup is off. Enable “Provider lookups” in Settings before sending a search to Open Food Facts.',
      )
      return
    }
    setProviderState('loading')
    setProviderMessage('')
    try {
      const normalizedQuery = query.trim()
      setRemoteFoods(await foodProvider.search(normalizedQuery))
      setSubmittedQuery(normalizedQuery)
      setProviderSearched(true)
      setProviderState('idle')
    } catch {
      setProviderState('error')
      setProviderMessage(
        'The food database could not be reached. Your saved foods still work offline.',
      )
    }
  }
  async function lookupBarcode(value = barcode) {
    if (!value.trim()) return
    if (!providerAllowed) {
      setProviderState('error')
      setProviderMessage(
        'Provider lookup is off. Enable “Provider lookups” in Settings before sending a barcode.',
      )
      return
    }
    setProviderState('loading')
    setProviderMessage('')
    try {
      const food = await foodProvider.lookupBarcode(value.trim())
      setRemoteFoods(food ? [food] : [])
      setSubmittedQuery('')
      setProviderSearched(true)
      setSelected(food)
      setProviderState(food ? 'idle' : 'error')
      if (!food)
        setProviderMessage(
          'No product was found for that barcode. You can still add a custom food later.',
        )
    } catch {
      setProviderState('error')
      setProviderMessage('Barcode lookup failed. Nothing from your health profile was sent.')
    }
  }
  return (
    <div className="page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Nutrition · Journal and planner</p>
          <h2>Fuel, with context.</h2>
          <p className="muted">
            Review past days, plan future meals, and keep the provenance of every food visible.
          </p>
        </div>
        <div className="calorie-ring">
          <strong>{Math.round(totals.calories)}</strong>
          <span>kcal{target ? ` / ${target}` : ''}</span>
        </div>
      </section>
      <PageFeatureCustomizer
        label="Nutrition"
        title="Keep the planning tools that fit your routine in view."
        jumpAriaLabel="Nutrition sections"
        jumpItems={
          [
            visibleSections.includes('planner') && ['nutrition-planner', 'Planner'],
            visibleSections.includes('search') && ['nutrition-search', 'Food search'],
            visibleSections.includes('log') && ['nutrition-log', 'Day log'],
          ].filter(Boolean) as Array<[string, string]>
        }
        options={[
          ['planner', 'Planner'],
          ['search', 'Food search'],
          ['log', 'Day log'],
        ]}
        visible={visibleSections}
        onToggle={(key) =>
          setVisibleSections((current) =>
            current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
          )
        }
      />
      {visibleSections.includes('planner') && (
        <section className="panel nutrition-date-panel" id="nutrition-planner">
          <div>
            <p className="eyebrow">Food journal</p>
            <h3>
              {selectedDate === today()
                ? 'Today'
                : selectedDate < today()
                  ? 'Past day'
                  : 'Planned day'}
            </h3>
          </div>
          <div className="date-controls">
            <button
              className="secondary-button"
              onClick={() => {
                const date = new Date(`${selectedDate}T12:00:00`)
                date.setDate(date.getDate() - 1)
                setSelectedDate(date.toISOString().slice(0, 10))
              }}
            >
              Previous day
            </button>
            <input
              type="date"
              aria-label="Food journal date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
            <button className="secondary-button" onClick={() => setSelectedDate(today())}>
              Today
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                const date = new Date(`${selectedDate}T12:00:00`)
                date.setDate(date.getDate() + 1)
                setSelectedDate(date.toISOString().slice(0, 10))
              }}
            >
              Next day
            </button>
          </div>
          <p className="muted compact-copy">
            Choose a future date to plan meals. Planned entries remain dated and do not inflate
            today’s totals.
          </p>
        </section>
      )}
      {visibleSections.includes('search') && (
        <section className="panel food-logger" id="nutrition-search">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Quick log</p>
              <h3>{selected ? selected.name : 'Search your foods'}</h3>
            </div>
            {selected && (
              <button className="text-button" onClick={() => setSelected(undefined)}>
                Change food
              </button>
            )}
          </div>
          {!selected ? (
            <>
              <div className="food-search-primary">
                <div className="food-search-label">
                  <div>
                    <strong>Find a saved food</strong>
                    <small>Search your personal library first</small>
                  </div>
                  <span className="food-action-hint">Offline ready</span>
                </div>
                <div className="food-search-row">
                  <div className="search-input food-search-input">
                    <Search size={18} aria-hidden="true" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void searchOnline()
                      }}
                      placeholder="Search saved foods"
                      aria-label="Search saved foods"
                    />
                    {query && (
                      <button
                        className="food-search-clear"
                        type="button"
                        aria-label="Clear food search"
                        onClick={() => setQuery('')}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <button
                    className="primary-button food-search-submit"
                    disabled={providerState === 'loading' || query.trim().length < 2}
                    onClick={searchOnline}
                  >
                    <Search size={16} />
                    {providerState === 'loading' ? 'Searching…' : 'Search database'}
                  </button>
                </div>
              </div>
              <div className="food-secondary-tools">
                <div className="food-tool-card barcode-tool-card">
                  <div className="food-tool-heading">
                    <span className="food-tool-icon">
                      <Camera size={17} />
                    </span>
                    <div>
                      <strong>Use a barcode</strong>
                      <small>Look up a packaged food quickly</small>
                    </div>
                  </div>
                  <div className="barcode-entry">
                    <input
                      value={barcode}
                      onChange={(event) => setBarcode(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void lookupBarcode()
                      }}
                      placeholder="Enter barcode"
                      aria-label="Barcode"
                      inputMode="numeric"
                    />
                    <button
                      className="secondary-button"
                      disabled={providerState === 'loading'}
                      onClick={() => void lookupBarcode()}
                    >
                      Look up
                    </button>
                    <button
                      className="secondary-button barcode-scan-button"
                      onClick={() => setScannerOpen((value) => !value)}
                    >
                      <Camera size={16} /> Scan
                    </button>
                  </div>
                </div>
                <div className="food-utility-grid">
                  <div className="food-tool-card food-utility-card">
                    <div className="food-tool-heading">
                      <span className="food-tool-icon">
                        <Upload size={17} />
                      </span>
                      <div>
                        <strong>Bring your history</strong>
                        <small>Import food-level MyFitnessPal CSV data</small>
                      </div>
                    </div>
                    <label className="secondary-button food-utility-button">
                      Choose CSV file
                      <input
                        className="sr-only"
                        type="file"
                        accept=".csv,text/csv"
                        aria-label="Import MyFitnessPal CSV"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void onImportMyFitnessPal(file)
                          event.currentTarget.value = ''
                        }}
                      />
                    </label>
                  </div>
                  <div className="food-tool-card food-utility-card">
                    <div className="food-tool-heading">
                      <span className="food-tool-icon">
                        <Plus size={17} />
                      </span>
                      <div>
                        <strong>Add something custom</strong>
                        <small>Save a food that is unique to you</small>
                      </div>
                    </div>
                    <button
                      className="secondary-button food-utility-button"
                      onClick={() => setCustomFoodOpen((open) => !open)}
                    >
                      {customFoodOpen ? 'Close custom food' : 'Create custom food'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="food-privacy-note">
                <CircleHelp size={16} aria-hidden="true" />
                <p>
                  Online lookup is optional and currently{' '}
                  <strong>{providerAllowed ? 'enabled' : 'off'}</strong>.
                  {providerAllowed
                    ? ' Only the search term or barcode is sent to Open Food Facts.'
                    : ' Enable provider lookups in Settings to search Open Food Facts.'}
                </p>
                {!providerAllowed && (
                  <button className="text-button" onClick={() => onNavigate('settings')}>
                    Open Settings
                  </button>
                )}
              </div>
              {customFoodOpen && (
                <div className="custom-food-form">
                  <p className="provider-note">
                    Custom foods stay on this device and are marked as user-entered. They are not
                    verified database values.
                  </p>
                  <div className="two-col">
                    <label>
                      Name
                      <input
                        value={customFood.name}
                        onChange={(event) =>
                          setCustomFood({ ...customFood, name: event.target.value })
                        }
                        placeholder="Food name"
                      />
                    </label>
                    <label>
                      Serving label
                      <input
                        value={customFood.servingLabel}
                        onChange={(event) =>
                          setCustomFood({ ...customFood, servingLabel: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="three-col">
                    {(['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'] as const).map(
                      (field) => (
                        <label key={field}>
                          {field === 'calories' ? 'Calories' : field.replace('G', ' (g)')}
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={customFood[field]}
                            onChange={(event) =>
                              setCustomFood({ ...customFood, [field]: event.target.value })
                            }
                          />
                        </label>
                      ),
                    )}
                  </div>
                  <button
                    className="secondary-button"
                    disabled={
                      !customFood.name.trim() ||
                      ![
                        customFood.calories,
                        customFood.proteinG,
                        customFood.carbsG,
                        customFood.fatG,
                        customFood.fiberG,
                      ].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)
                    }
                    onClick={() =>
                      void (async () => {
                        const food: Food = {
                          id: newId(),
                          name: customFood.name.trim(),
                          servingLabel: customFood.servingLabel.trim() || '1 serving',
                          calories: Number(customFood.calories) || 0,
                          proteinG: Number(customFood.proteinG) || 0,
                          carbsG: Number(customFood.carbsG) || 0,
                          fatG: Number(customFood.fatG) || 0,
                          fiberG: Number(customFood.fiberG) || 0,
                          source: 'user-entered',
                          confidence: 'low',
                        }
                        await onSaveFood(food)
                        setCustomFoodOpen(false)
                        setSelected(food)
                        setCustomFood({
                          name: '',
                          servingLabel: '1 serving',
                          calories: '',
                          proteinG: '',
                          carbsG: '',
                          fatG: '',
                          fiberG: '',
                        })
                      })()
                    }
                  >
                    Save custom food
                  </button>
                </div>
              )}
              {scannerOpen && (
                <BarcodeScanner
                  onDetected={(value) => {
                    setBarcode(value)
                    setScannerOpen(false)
                    void lookupBarcode(value)
                  }}
                  onClose={() => setScannerOpen(false)}
                />
              )}
              {providerState === 'loading' && (
                <p className="provider-note" role="status" aria-live="polite">
                  Looking up food information…
                </p>
              )}
              {providerMessage && (
                <p className="form-error" role="alert">
                  {providerMessage}
                </p>
              )}
              <div className="food-results-heading" aria-live="polite">
                <div>
                  <p className="eyebrow">Your food library</p>
                  <strong>
                    {filtered.length ? `${filtered.length} foods ready to log` : 'Saved foods'}
                  </strong>
                </div>
                <small>
                  {query ? `Showing matches for “${query}”` : 'Select a food to add it to your day'}
                </small>
              </div>
              <div className="food-results">
                {filtered.map((food) => (
                  <div className="food-result-card" key={food.id}>
                    <button className="food-result-select" onClick={() => setSelected(food)}>
                      <span>
                        <strong>{food.name}</strong>
                        <small>
                          {food.servingLabel} · {food.source.replaceAll('-', ' ')}
                        </small>
                      </span>
                      <span>{food.calories} kcal</span>
                    </button>
                    {foods.some((savedFood) => savedFood.id === food.id) && (
                      <button
                        className="icon-button danger food-result-remove"
                        aria-label={`Remove ${food.name} from your food library`}
                        title="Remove from food library"
                        onClick={async (event) => {
                          event.stopPropagation()
                          if (
                            await confirmDelete(
                              `Remove ${food.name} from your food library? Existing food log entries will stay.`,
                            )
                          )
                            await onRemoveFood(food.id)
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {query.trim() && filtered.length === 0 && (
                  <div className="empty-inline">
                    {providerSearched && submittedQuery === query.trim()
                      ? 'No matching foods came back. Try a broader name, a barcode, or create a custom food.'
                      : 'No saved food matches yet. Search the database or create a custom food.'}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="food-confirm">
              <div className="food-meta">
                <span className="source-pill">{selected.source.replaceAll('-', ' ')}</span>
                <small>
                  {selected.servingLabel} · {selected.calories} kcal · P {selected.proteinG}g · C{' '}
                  {selected.carbsG}g · F {selected.fatG}g · Fiber {selected.fiberG}g
                </small>
              </div>
              <div className="three-col">
                <label>
                  Servings
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={servings}
                    onChange={(event) => setServings(event.target.value)}
                  />
                </label>
                <label>
                  Meal
                  <select value={meal} onChange={(event) => setMeal(event.target.value)}>
                    <option>Breakfast</option>
                    <option>Lunch</option>
                    <option>Dinner</option>
                    <option>Snack</option>
                    <option>Drink</option>
                    <option>Other</option>
                  </select>
                </label>
                <button
                  className="primary-button"
                  disabled={Number(servings) <= 0}
                  onClick={async () => {
                    await onAddFood(selected, Number(servings), meal, selectedDate)
                    setSelected(undefined)
                    setQuery('')
                  }}
                >
                  <Plus size={17} /> Add to log
                </button>
              </div>
            </div>
          )}
        </section>
      )}
      {visibleSections.includes('log') && (
        <section className="panel table-panel" id="nutrition-log">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{selectedDate === today() ? 'Today' : selectedDate}</p>
              <h3>
                {dateLogs.length
                  ? `${dateLogs.length} item${dateLogs.length === 1 ? '' : 's'} planned or logged`
                  : 'Nothing logged yet'}
              </h3>
            </div>
            <div className="macro-summary">
              <span>P {round(totals.proteinG)}g</span>
              <span>C {round(totals.carbsG)}g</span>
              <span>F {round(totals.fatG)}g</span>
            </div>
          </div>
          {dateLogs.length === 0 ? (
            <EmptyState text="Start with a familiar food. You can edit and expand your food library over time." />
          ) : (
            <div className="entry-list">
              {dateLogs.map((log) => (
                <div className="entry-row" key={log.id}>
                  <div className="entry-date">
                    <strong>{log.foodName}</strong>
                    <span>
                      {log.meal} · {log.servings} serving{log.servings === 1 ? '' : 's'} ·{' '}
                      <span className="nutrition-log-status">
                        {selectedDate > today() ? 'Planned' : 'Logged'}
                      </span>
                    </span>
                  </div>
                  <div className="entry-actions">
                    <strong>{Math.round(log.calories)} kcal</strong>
                    <button
                      className="icon-button danger"
                      aria-label={`Remove ${log.foodName} from ${selectedDate}`}
                      onClick={async () => {
                        if (await confirmDelete(`Remove ${log.foodName} from this day?`))
                          await onRemoveFoodLog(log.id)
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {mealSummaries.length > 0 && (
            <div className="meal-summary-list">
              <p className="eyebrow">By meal</p>
              {mealSummaries.map((summary) => (
                <div className="meal-summary-row" key={summary.meal}>
                  <span>{summary.meal}</span>
                  <strong>{Math.round(summary.totals.calories)} kcal</strong>
                  <small>
                    P {round(summary.totals.proteinG)}g · C {round(summary.totals.carbsG)}g · F{' '}
                    {round(summary.totals.fatG)}g
                  </small>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function BreathingRhythm({
  onSessionEnd,
}: {
  onSessionEnd: (mode: string, seconds: number) => Promise<void>
}) {
  type BreathingMode =
    | 'calm'
    | 'box'
    | 'coherent'
    | 'triangle'
    | 'extended'
    | 'fourSevenEight'
    | 'resonant'
    | 'equal'
    | 'sigh'
  type BreathPhase = { label: string; duration: number }

  const [mode, setMode] = useState<BreathingMode>('calm')
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recordedSeconds = useRef(0)
  const phaseSets: Record<BreathingMode, BreathPhase[]> = {
    calm: [
      { label: 'Inhale', duration: 4 },
      { label: 'Exhale', duration: 6 },
    ],
    box: [
      { label: 'Inhale', duration: 4 },
      { label: 'Hold', duration: 4 },
      { label: 'Exhale', duration: 4 },
      { label: 'Hold', duration: 4 },
    ],
    coherent: [
      { label: 'Inhale', duration: 5 },
      { label: 'Exhale', duration: 5 },
    ],
    triangle: [
      { label: 'Inhale', duration: 4 },
      { label: 'Hold', duration: 4 },
      { label: 'Exhale', duration: 4 },
    ],
    extended: [
      { label: 'Inhale', duration: 4 },
      { label: 'Exhale', duration: 8 },
    ],
    fourSevenEight: [
      { label: 'Inhale', duration: 4 },
      { label: 'Hold', duration: 7 },
      { label: 'Exhale', duration: 8 },
    ],
    resonant: [
      { label: 'Inhale', duration: 6 },
      { label: 'Exhale', duration: 6 },
    ],
    equal: [
      { label: 'Inhale', duration: 4 },
      { label: 'Exhale', duration: 4 },
    ],
    sigh: [
      { label: 'Inhale', duration: 2 },
      { label: 'Top-up', duration: 1 },
      { label: 'Exhale', duration: 6 },
    ],
  }
  const phases = phaseSets[mode]
  const cycleLength = phases.reduce((sum, phaseItem) => sum + phaseItem.duration, 0)
  const cycleSecond = seconds % cycleLength
  let phaseCursor = 0
  let phaseIndex = 0
  let phase = phases[0].label
  let phaseLength = phases[0].duration
  for (const [index, phaseItem] of phases.entries()) {
    if (cycleSecond < phaseCursor + phaseItem.duration) {
      phaseIndex = index
      phase = phaseItem.label
      phaseLength = phaseItem.duration
      break
    }
    phaseCursor += phaseItem.duration
  }
  const phaseSeconds = cycleSecond - phaseCursor
  const phaseProgress = Math.min(1, (phaseSeconds + 1) / Math.max(phaseLength, 1))
  const phaseScale =
    phase === 'Inhale'
      ? 0.72 + phaseProgress * 0.22
      : phase === 'Top-up'
        ? 0.94 + phaseProgress * 0.1
        : phase === 'Exhale'
          ? mode === 'sigh'
            ? 1.04 - phaseProgress * 0.32
            : 0.94 - phaseProgress * 0.22
          : phaseIndex === 1
            ? 0.94
            : 0.72
  const phaseRotation = phase === 'Exhale' ? 2 - phaseProgress * 4 : -2 + phaseProgress * 4

  useEffect(() => {
    if (!running) return undefined
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [running])

  function changeMode(next: BreathingMode) {
    if (seconds > recordedSeconds.current) {
      recordedSeconds.current = seconds
      void onSessionEnd(mode, seconds)
    }
    setMode(next)
    setSeconds(0)
    setRunning(false)
    recordedSeconds.current = 0
  }

  function endSession() {
    if (seconds > recordedSeconds.current) {
      recordedSeconds.current = seconds
      void onSessionEnd(mode, seconds)
    }
    setRunning(false)
  }

  function resetSession() {
    endSession()
    setSeconds(0)
    recordedSeconds.current = 0
  }

  return (
    <section className="breathing-rhythm">
      <div className="breathing-rhythm-heading">
        <div className="mind-toolkit-kicker" aria-label="Breath Rhythm">
          <span>Breath Rhythm</span>
        </div>
        <h3>A gentle visual pace for coming back to the moment.</h3>
      </div>
      <div className="breathing-rhythm-layout">
        <div className="breathing-guide">
          <div className="breathing-rhythm-picker">
            <p className="eyebrow">Choose a rhythm</p>
            <div className="segmented-control">
              <button
                className={mode === 'calm' ? 'active' : ''}
                onClick={() => changeMode('calm')}
              >
                Calm 4–6
              </button>
              <button className={mode === 'box' ? 'active' : ''} onClick={() => changeMode('box')}>
                Box 4–4
              </button>
              <button
                className={mode === 'coherent' ? 'active' : ''}
                onClick={() => changeMode('coherent')}
              >
                Coherent 5–5
              </button>
              <button
                className={mode === 'triangle' ? 'active' : ''}
                onClick={() => changeMode('triangle')}
              >
                Triangle 4–4–4
              </button>
              <button
                className={mode === 'extended' ? 'active' : ''}
                onClick={() => changeMode('extended')}
              >
                Extended 4–8
              </button>
              <button
                className={mode === 'sigh' ? 'active' : ''}
                onClick={() => changeMode('sigh')}
              >
                Physiological sigh
              </button>
              <button
                className={mode === 'fourSevenEight' ? 'active' : ''}
                onClick={() => changeMode('fourSevenEight')}
              >
                4–7–8
              </button>
              <button
                className={mode === 'resonant' ? 'active' : ''}
                onClick={() => changeMode('resonant')}
              >
                Resonant 6–6
              </button>
              <button
                className={mode === 'equal' ? 'active' : ''}
                onClick={() => changeMode('equal')}
              >
                Equal 4–4
              </button>
            </div>
          </div>
          <p className="breathing-phase-label">
            {running ? `${phase} · ${phaseSeconds + 1} of ${phaseLength}` : 'Ready when you are'}
          </p>
          <p className="muted compact-copy">
            Follow the expanding and softening pulse if it helps. Stop or return to normal breathing
            whenever you want.
          </p>
          <div
            className={`breathing-phase-map breathing-phase-map-${phases.length}`}
            aria-label="Current rhythm phases"
          >
            {phases.map((phaseItem, index) => (
              <div
                key={`${phaseItem.label}-${phaseItem.duration}-${index}`}
                className={running && index === phaseIndex ? 'active' : ''}
                aria-current={running && index === phaseIndex ? 'step' : undefined}
              >
                <strong>{phaseItem.label}</strong>
                <span>{phaseItem.duration}s</span>
              </div>
            ))}
          </div>
        </div>
        <div className="breathing-visual">
          <div className="breath-orb-stage">
            <div className="breathing-guide-lines" aria-hidden="true" />
            <div
              className={`breath-object ${running ? 'is-running' : ''} ${phase.toLowerCase()}`}
              style={
                {
                  '--breath-scale': phaseScale,
                  '--breath-rotation': `${phaseRotation}deg`,
                } as CSSProperties
              }
            >
              <span className="breath-energy-ring breath-energy-ring-one" aria-hidden="true" />
              <span className="breath-energy-ring breath-energy-ring-two" aria-hidden="true" />
              <span className="breath-energy-ring breath-energy-ring-three" aria-hidden="true" />
              <span className="breath-particle breath-particle-one" aria-hidden="true" />
              <span className="breath-particle breath-particle-two" aria-hidden="true" />
              <span className="breath-particle breath-particle-three" aria-hidden="true" />
              <span className="breath-object-face">
                <span>{running ? phase : 'Ready'}</span>
                <small>{running ? `${phaseSeconds + 1}s` : 'when you are'}</small>
              </span>
            </div>
          </div>
          <span className="sr-only" aria-live="polite">
            {running ? `${phase}, ${phaseSeconds + 1} of ${phaseLength}` : 'Breathing rhythm ready'}
          </span>
          <div className="breathing-visual-actions">
            <button
              className="primary-button"
              onClick={() => (running ? endSession() : setRunning(true))}
            >
              {running ? 'Pause & save' : 'Begin'}
            </button>
            <button className="secondary-button" onClick={resetSession}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function MindPreview({
  supportStyle,
  workspaceTheme,
  onJournal,
  onBreathingSession,
  onSkillPractice,
  onDeleteCapture,
  onUpdateCapture,
  captures,
  dreamEntries,
  onDeleteDream,
}: {
  supportStyle: SupportStyle
  workspaceTheme: WorkspaceTheme
  onJournal: (note: string, tags: string[], date: string, checkIn?: JournalCheckIn) => Promise<void>
  onBreathingSession: (mode: string, seconds: number) => Promise<void>
  onSkillPractice: (title: string, answers: string[]) => Promise<void>
  onDeleteCapture: (id: string) => Promise<void>
  onUpdateCapture: (entry: CaptureEntry) => Promise<void>
  captures: CaptureEntry[]
  dreamEntries: DreamJournalEntry[]
  onDeleteDream: (id: string) => Promise<void>
}) {
  const confirmDelete = useDeleteConfirmation()
  const [selectedCheckInFields, setSelectedCheckInFields] = useState<WellbeingSignalKey[]>([])
  const [checkInValues, setCheckInValues] = useState<Partial<Record<WellbeingSignalKey, string>>>(
    {},
  )
  const [checkInNote, setCheckInNote] = useState('')
  const [checkInExpanded, setCheckInExpanded] = useState(false)
  const [journalText, setJournalText] = useState('')
  const [journalDate, setJournalDate] = useState(today())
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)
  const [journalSaved, setJournalSaved] = useState(false)
  const [journalTags, setJournalTags] = useState<string[]>([])
  const [journalTagDraft, setJournalTagDraft] = useState('')
  const [journalTagColors, setJournalTagColors] = useState<Record<string, string>>(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('nxt-journal-tag-colors') ?? '{}')
      return stored && typeof stored === 'object' ? (stored as Record<string, string>) : {}
    } catch {
      return {}
    }
  })
  const [recordQuery, setRecordQuery] = useState('')
  const [recordTag, setRecordTag] = useState('')
  const [recordView, setRecordView] = useState<
    'all' | 'journal' | 'practices' | 'breathing' | 'sleep' | 'check-ins'
  >('all')
  const [recordSort, setRecordSort] = useState<'newest' | 'oldest'>('newest')
  const [recordRange, setRecordRange] = useState<'all' | '7' | '30' | '90'>('all')
  const [recordContent, setRecordContent] = useState<'all' | 'notes' | 'signals'>('all')
  const [recordSignal, setRecordSignal] = useState<WellbeingSignalKey | ''>('')
  const [recordTagPresence, setRecordTagPresence] = useState<'all' | 'tagged' | 'untagged'>('all')
  const [selectedRecord, setSelectedRecord] = useState<MindRecordItem | null>(null)
  const [detailRecord, setDetailRecord] = useState<MindRecordItem | null>(null)
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null)
  const [visibleSections, setVisibleSections] = useSectionVisibility('nxt-mind-sections', [
    'skills',
    'checkin',
    'journal',
    'record',
  ])
  useEffect(() => {
    setVisibleSections((current) => current.filter((item) => item !== 'training'))
  }, [setVisibleSections])
  const [history, setHistory] = useState<Awaited<ReturnType<typeof wellbeingRepository.list>>>([])

  useEffect(() => {
    void wellbeingRepository.list().then(setHistory)
  }, [])
  useEffect(() => {
    const draft = window.localStorage.getItem(`nxt-journal-draft:${journalDate}`)
    setJournalText(draft ?? '')
    setDraftSavedAt(draft ? Date.now() : null)
    setJournalSaved(false)
  }, [journalDate])
  useEffect(() => {
    if (!journalText.trim()) return undefined
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(`nxt-journal-draft:${journalDate}`, journalText)
      setDraftSavedAt(Date.now())
    }, 500)
    return () => window.clearTimeout(timer)
  }, [journalDate, journalText])
  useEffect(() => {
    window.localStorage.setItem('nxt-journal-tag-colors', JSON.stringify(journalTagColors))
  }, [journalTagColors])
  const allMindEntries = captures.filter(
    (entry) =>
      entry.context === 'mindfulness' || entry.context === 'journal' || entry.type === 'sleep',
  )
  const availableRecordTags = Array.from(
    new Set([
      ...allMindEntries.flatMap((entry) => parseJournalTags(entry.payload?.tags)),
      ...dreamEntries.flatMap((entry) => entry.tags ?? []),
    ]),
  ).sort((left, right) => left.localeCompare(right))
  const recordCutoff =
    recordRange === 'all'
      ? undefined
      : new Date(Date.now() - Number(recordRange) * 24 * 60 * 60 * 1000).toISOString()
  const filteredMindEntries = [...allMindEntries].filter((entry) => {
    if (recordView === 'journal' && entry.context !== 'journal') return false
    if (recordView === 'practices' && !entry.title.startsWith('Skill practice')) return false
    if (recordView === 'breathing' && !entry.title.startsWith('Breathing rhythm')) return false
    if (recordView === 'sleep' && entry.type !== 'sleep') return false
    const entryTags = parseJournalTags(entry.payload?.tags)
    const haystack = `${entry.title} ${entry.note ?? ''} ${entryTags.join(' ')}`.toLowerCase()
    const matchesQuery = !recordQuery.trim() || haystack.includes(recordQuery.toLowerCase())
    const matchesTag =
      !recordTag ||
      entryTags.some((tag) => tag.toLocaleLowerCase() === recordTag.toLocaleLowerCase())
    const matchesTagPresence =
      recordTagPresence === 'all' ||
      (recordTagPresence === 'tagged' && entryTags.length > 0) ||
      (recordTagPresence === 'untagged' && entryTags.length === 0)
    const matchesRange = !recordCutoff || entry.occurredAt >= recordCutoff
    const matchesContent =
      recordContent === 'all' ||
      (recordContent === 'notes' && Boolean(entry.note?.trim())) ||
      (recordContent === 'signals' && captureSignals(entry).length > 0)
    const signalValue = recordSignal ? captureSignalValue(entry, recordSignal) : undefined
    const matchesSignal = !recordSignal || (signalValue !== undefined && signalValue !== null)
    return (
      matchesQuery &&
      matchesTag &&
      matchesTagPresence &&
      matchesRange &&
      matchesContent &&
      matchesSignal
    )
  })
  const filteredDreamEntries = dreamEntries.filter((entry) => {
    if (recordView !== 'all' && recordView !== 'sleep') return false
    const entryTags = entry.tags ?? []
    const haystack = `${entry.title ?? ''} ${entry.content} ${entryTags.join(' ')}`.toLowerCase()
    const matchesQuery = !recordQuery.trim() || haystack.includes(recordQuery.toLowerCase())
    const matchesTag =
      !recordTag ||
      entryTags.some((tag) => tag.toLocaleLowerCase() === recordTag.toLocaleLowerCase())
    const matchesTagPresence =
      recordTagPresence === 'all' ||
      (recordTagPresence === 'tagged' && entryTags.length > 0) ||
      (recordTagPresence === 'untagged' && entryTags.length === 0)
    const matchesRange = !recordCutoff || entry.date >= recordCutoff.slice(0, 10)
    const matchesContent = recordContent !== 'signals'
    const matchesSignal = !recordSignal
    return (
      matchesQuery &&
      matchesTag &&
      matchesTagPresence &&
      matchesRange &&
      matchesContent &&
      matchesSignal
    )
  })
  const filteredHistory = history.filter((entry) => {
    const signalText = wellbeingSignals(entry).join(' ')
    const haystack = `check-in ${entry.note ?? ''} ${signalText}`.toLowerCase()
    const matchesQuery = !recordQuery.trim() || haystack.includes(recordQuery.toLowerCase())
    const matchesRange = !recordCutoff || entry.date >= recordCutoff.slice(0, 10)
    const matchesContent =
      recordContent === 'all' || recordContent === 'signals' || Boolean(entry.note)
    const matchesSignal = !recordSignal || entry[recordSignal] !== undefined
    const matchesTagPresence = recordTagPresence !== 'tagged'
    return (
      matchesQuery &&
      matchesRange &&
      matchesContent &&
      matchesSignal &&
      matchesTagPresence &&
      !recordTag
    )
  })
  const recordItems: MindRecordItem[] = [
    ...(recordView === 'check-ins'
      ? []
      : filteredMindEntries.map((entry) => ({ kind: 'capture' as const, entry }))),
    ...(recordView === 'all' || recordView === 'sleep'
      ? filteredDreamEntries.map((entry) => ({ kind: 'dream' as const, entry }))
      : []),
    ...(recordView === 'all' || recordView === 'check-ins'
      ? filteredHistory.map((entry) => ({ kind: 'check-in' as const, entry }))
      : []),
  ]
    .sort((left, right) => {
      const leftDate = mindRecordDate(left)
      const rightDate = mindRecordDate(right)
      const delta = leftDate.localeCompare(rightDate)
      return recordSort === 'newest' ? -delta : delta
    })
    .slice(0, 30)
  function exportJournal() {
    const markdown = allMindEntries
      .filter((entry) => entry.context === 'journal')
      .map((entry) => {
        const date = entry.occurredAt.slice(0, 10)
        const tags = parseJournalTags(entry.payload?.tags)
        const tagLine = tags.length ? `\n\nTags: ${tags.join(', ')}` : ''
        return `## ${date}${tagLine}\n\n${entry.note ?? ''}\n`
      })
      .join('\n')
    const blob = new Blob([markdown || '# Journal\n\nNo journal entries yet.'], {
      type: 'text/markdown;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nxt-journal-${today()}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  function editJournalEntry(entry: CaptureEntry) {
    if (!entry.note) return
    window.localStorage.removeItem(`nxt-journal-draft:${entry.occurredAt.slice(0, 10)}`)
    setJournalText(entry.note)
    setJournalDate(entry.occurredAt.slice(0, 10))
    setJournalTags(parseJournalTags(entry.payload?.tags))
    setJournalTagDraft('')
    setJournalSaved(false)
    setEditingJournalId(entry.id)
    document.getElementById('mind-journal')?.scrollIntoView({ behavior: 'smooth' })
  }

  async function saveJournal() {
    const note = journalText.trim()
    if (!note) return
    const tags = mergeJournalTags(journalTags, journalTagDraft)
    const checkIn = selectedCheckInFields.reduce<JournalCheckIn>((values, key) => {
      const value = checkInValues[key]
      if (value) values[key] = Number(value)
      return values
    }, {})
    if (checkInNote.trim()) checkIn.note = checkInNote.trim()
    if (editingJournalId) {
      const original = captures.find((entry) => entry.id === editingJournalId)
      if (original) {
        await onUpdateCapture({
          ...original,
          occurredAt: `${journalDate}T${original.occurredAt.slice(11)}`,
          note,
          payload: { ...original.payload, tags: tags.join(', ') },
        })
      }
      setEditingJournalId(null)
    } else {
      await onJournal(note, tags, journalDate, Object.keys(checkIn).length ? checkIn : undefined)
    }
    setHistory(await wellbeingRepository.list())
    window.localStorage.removeItem(`nxt-journal-draft:${journalDate}`)
    setJournalText('')
    setJournalTags([])
    setJournalTagDraft('')
    setSelectedCheckInFields([])
    setCheckInValues({})
    setCheckInNote('')
    setCheckInExpanded(false)
    setJournalSaved(true)
    setDraftSavedAt(null)
  }

  function clearJournalDraft() {
    window.localStorage.removeItem(`nxt-journal-draft:${journalDate}`)
    setJournalText('')
    setDraftSavedAt(null)
    setJournalSaved(false)
  }

  function addJournalTags(input = journalTagDraft) {
    if (!input.trim()) return
    setJournalTags((current) => mergeJournalTags(current, input))
    setJournalTagDraft('')
    setJournalSaved(false)
  }

  function removeJournalTag(tag: string) {
    setJournalTags((current) => current.filter((item) => item !== tag))
    setJournalSaved(false)
  }

  function updateJournalTagColor(tag: string, color: string) {
    setJournalTagColors((current) => ({ ...current, [tag]: color }))
    setJournalSaved(false)
  }

  function toggleCheckInField(key: WellbeingSignalKey) {
    setSelectedCheckInFields((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    )
    setCheckInExpanded(true)
    setJournalSaved(false)
  }

  return (
    <div className="page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Mind · Mindfulness</p>
          <h2>Practice presence, reflection, and self-awareness.</h2>
          <p className="muted">
            These are observations, not a diagnosis or a grade. You can skip any part.
          </p>
        </div>
      </section>
      <PageFeatureCustomizer
        label="Mind"
        title="Choose the practices and records that belong in your workspace."
        jumpItems={
          [
            visibleSections.includes('skills') && ['practical-skills', 'Skill library'],
            visibleSections.includes('checkin') && ['mind-checkin', 'Check-in'],
            visibleSections.includes('journal') && ['mind-journal', 'Journal'],
          ].filter(Boolean) as Array<[string, string]>
        }
        options={[
          ['skills', 'Skill library'],
          ['checkin', 'Check-in'],
          ['journal', 'Journal'],
          ['record', 'Your record'],
        ]}
        visible={visibleSections}
        onToggle={(key) =>
          setVisibleSections((current) =>
            current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
          )
        }
      />
      <BreathingRhythm onSessionEnd={onBreathingSession} />
      {visibleSections.includes('skills') && (
        <div id="practical-skills">
          <ContemplativeSkills onSavePractice={onSkillPractice} />
        </div>
      )}
      {visibleSections.includes('checkin') && (
        <section className="panel checkin-launch" id="mind-checkin">
          <div className="checkin-launch-icon">
            <HeartHandshake size={24} />
          </div>
          <div>
            <p className="eyebrow">Journal check-in</p>
            <h3>Check in only where you want to.</h3>
            <p className="muted">
              Choose any signals inside your journal entry. Nothing is required, and nothing is
              saved separately from the entry.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={() => {
              setCheckInExpanded(true)
              document.getElementById('mind-journal')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Add to journal
          </button>
        </section>
      )}
      {visibleSections.includes('journal') && (
        <section className="panel journal-panel" id="mind-journal">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Journal</p>
              <h3>Put the day into words.</h3>
            </div>
            <span className="source-pill">Private</span>
          </div>
          <p className="muted compact-copy">
            No prompt is required. Write what you noticed, what mattered, or what you want to
            remember.
          </p>
          <div className="journal-meta-row">
            <label>
              Entry date
              <input
                type="date"
                value={journalDate}
                onChange={(event) => setJournalDate(event.target.value)}
              />
            </label>
            <div className="journal-checkin-context">
              <span className="journal-prompts-label">Optional check-in</span>
              <span className="muted">
                {selectedCheckInFields.length === 0
                  ? 'No signals selected'
                  : `${selectedCheckInFields.length} signal${selectedCheckInFields.length === 1 ? '' : 's'} selected`}
              </span>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setCheckInExpanded((expanded) => !expanded)}
              aria-expanded={checkInExpanded}
            >
              {checkInExpanded ? 'Hide check-in choices' : 'Add an optional check-in'}
            </button>
          </div>
          {checkInExpanded && (
            <div className="optional-context journal-checkin-builder">
              <div>
                <p className="journal-prompts-label">You decide what to notice</p>
                <p className="muted compact-copy">
                  Select only the signals you want for this entry. You can choose one, several, or
                  none.
                </p>
              </div>
              <div className="checkin-signal-choices" role="group" aria-label="Check-in signals">
                {wellbeingSignalDefinitions.map((signal) => (
                  <button
                    type="button"
                    key={signal.key}
                    className={selectedCheckInFields.includes(signal.key) ? 'selected' : ''}
                    aria-pressed={selectedCheckInFields.includes(signal.key)}
                    onClick={() => toggleCheckInField(signal.key)}
                  >
                    <span className="checkin-choice-icon" aria-hidden="true">
                      {signal.icon}
                    </span>
                    <span className="checkin-choice-copy">
                      <strong>{signal.label}</strong>
                      <small>
                        {selectedCheckInFields.includes(signal.key)
                          ? 'Included in this entry'
                          : `${signal.low} to ${signal.high}`}
                      </small>
                    </span>
                    <span className="checkin-choice-mark" aria-hidden="true">
                      {selectedCheckInFields.includes(signal.key) ? '✓' : '+'}
                    </span>
                  </button>
                ))}
              </div>
              {selectedCheckInFields.length > 0 && (
                <div className="journal-inline-checkins">
                  {wellbeingSignalDefinitions
                    .filter((signal) => selectedCheckInFields.includes(signal.key))
                    .map((signal) => (
                      <FeelingScale
                        key={signal.key}
                        label={signal.label}
                        value={checkInValues[signal.key] ?? ''}
                        onChange={(value) =>
                          setCheckInValues((current) => ({ ...current, [signal.key]: value }))
                        }
                        low={signal.low}
                        high={signal.high}
                        icon={signal.icon}
                      />
                    ))}
                </div>
              )}
              <label className="feeling-note">
                Check-in note (optional)
                <textarea
                  rows={2}
                  value={checkInNote}
                  onChange={(event) => setCheckInNote(event.target.value)}
                  placeholder="Only if it helps you remember the day"
                />
              </label>
            </div>
          )}
          <DailyWritingPrompts
            supportStyle={supportStyle}
            onUsePrompt={(prompt) => {
              setJournalText((current) =>
                current.trim() ? `${current}\n\n${prompt}\n\n` : `${prompt}\n\n`,
              )
              setJournalSaved(false)
            }}
          />
          <div className="journal-tag-composer">
            <div className="journal-tag-bar">
              <span className="journal-prompts-label">Tags</span>
              <div className="journal-tag-field" aria-label="Tags for this entry">
                {journalTags.map((tag) => (
                  <span
                    className="journal-tag-chip"
                    key={tag}
                    style={{ '--tag-color': journalTagColors[tag] ?? '#789b8b' } as CSSProperties}
                  >
                    <input
                      type="color"
                      className="journal-tag-color-picker"
                      value={journalTagColors[tag] ?? '#789b8b'}
                      onChange={(event) => updateJournalTagColor(tag, event.target.value)}
                      aria-label={`Choose color for tag ${tag}`}
                      title={`Choose color for ${tag}`}
                    />
                    <span>{tag}</span>
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => removeJournalTag(tag)}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
                <input
                  aria-label="Add a journal tag"
                  value={journalTagDraft}
                  onChange={(event) => setJournalTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault()
                      addJournalTags()
                    }
                  }}
                  placeholder="Add a tag…"
                />
                <button
                  type="button"
                  className="journal-tag-add"
                  onClick={() => addJournalTags()}
                  disabled={!journalTagDraft.trim()}
                >
                  Add
                </button>
              </div>
            </div>
            <small className="journal-tag-help muted">Optional · press Enter to add</small>
          </div>
          <MarkdownEditor
            emojiTheme={workspaceTheme === 'dawn' ? EmojiTheme.LIGHT : EmojiTheme.DARK}
            value={journalText}
            onChange={(value) => {
              setJournalText(value)
              setJournalSaved(false)
            }}
          />
          <div className="journal-footer">
            <small>
              {journalText.length} characters ·{' '}
              {draftSavedAt
                ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : 'No draft saved'}
            </small>
            <button className="text-button" onClick={clearJournalDraft} disabled={!journalText}>
              Clear draft
            </button>
            <button
              className="primary-button"
              disabled={!journalText.trim()}
              onClick={() => void saveJournal()}
            >
              Save journal entry
            </button>
          </div>
          {journalSaved && <p className="form-success">Saved privately on this device.</p>}
        </section>
      )}
      {visibleSections.includes('record') && (
        <div className="mind-record-grid">
          <section className="panel table-panel mind-record-panel">
            <div className="record-library-heading">
              <div>
                <p className="eyebrow">Your record</p>
                <h3>Recent reflections, practices, and check-ins</h3>
                <p className="muted compact-copy">
                  Browse what you noticed by type, date, or signal. Open any record to read it in
                  full.
                </p>
              </div>
              <div className="panel-heading-actions">
                <span className="source-pill">Private</span>
                <button className="secondary-button" onClick={exportJournal}>
                  Export journal
                </button>
              </div>
            </div>
            <div className="record-library-meta" aria-label="Record summary">
              <span>
                <strong>{recordItems.length}</strong> records in view
              </span>
              <span>
                {allMindEntries.length + dreamEntries.length + history.length} saved privately on
                this device
              </span>
            </div>
            <div className="mind-record-controls">
              <label className="record-search-field">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Search your record</span>
                <input
                  aria-label="Search Mind records"
                  value={recordQuery}
                  onChange={(event) => setRecordQuery(event.target.value)}
                  placeholder="Search titles, notes, or check-in signals"
                />
              </label>
              <label>
                <span>Time window</span>
                <select
                  aria-label="Filter Mind records by time window"
                  value={recordRange}
                  onChange={(event) => setRecordRange(event.target.value as typeof recordRange)}
                >
                  <option value="all">Any time</option>
                  <option value="7">Past 7 days</option>
                  <option value="30">Past 30 days</option>
                  <option value="90">Past 90 days</option>
                </select>
              </label>
              <label>
                <span>Contains</span>
                <select
                  aria-label="Filter Mind records by content"
                  value={recordContent}
                  onChange={(event) => setRecordContent(event.target.value as typeof recordContent)}
                >
                  <option value="all">Everything</option>
                  <option value="notes">Notes and reflections</option>
                  <option value="signals">Check-in signals</option>
                </select>
              </label>
              <label>
                <span>Signal</span>
                <select
                  aria-label="Filter Mind records by signal"
                  value={recordSignal}
                  onChange={(event) =>
                    setRecordSignal(event.target.value as WellbeingSignalKey | '')
                  }
                >
                  <option value="">Any signal</option>
                  {wellbeingSignalDefinitions.map((signal) => (
                    <option key={signal.key} value={signal.key}>
                      {signal.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tag</span>
                <select
                  aria-label="Filter Mind records by tag"
                  value={recordTag}
                  onChange={(event) => setRecordTag(event.target.value)}
                >
                  <option value="">All tags</option>
                  {availableRecordTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tag status</span>
                <select
                  aria-label="Filter Mind records by tag status"
                  value={recordTagPresence}
                  onChange={(event) =>
                    setRecordTagPresence(event.target.value as typeof recordTagPresence)
                  }
                >
                  <option value="all">Any tag status</option>
                  <option value="tagged">Tagged only</option>
                  <option value="untagged">Untagged only</option>
                </select>
              </label>
              <label>
                <span>Order</span>
                <select
                  aria-label="Sort Mind records"
                  value={recordSort}
                  onChange={(event) => setRecordSort(event.target.value as 'newest' | 'oldest')}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
            </div>
            <div className="record-control-meta">
              <span>
                Showing {recordItems.length} of{' '}
                {allMindEntries.length + dreamEntries.length + history.length} records
              </span>
              {(recordQuery ||
                recordTag ||
                recordSignal ||
                recordTagPresence !== 'all' ||
                recordRange !== 'all' ||
                recordContent !== 'all') && (
                <button
                  className="text-button"
                  onClick={() => {
                    setRecordQuery('')
                    setRecordTag('')
                    setRecordSignal('')
                    setRecordTagPresence('all')
                    setRecordRange('all')
                    setRecordContent('all')
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="record-view-tabs" role="tablist" aria-label="Record type">
              {(
                [
                  {
                    key: 'all',
                    label: 'All',
                    count: allMindEntries.length + dreamEntries.length + history.length,
                  },
                  {
                    key: 'journal',
                    label: 'Journals',
                    count: allMindEntries.filter((entry) => entry.context === 'journal').length,
                  },
                  {
                    key: 'practices',
                    label: 'Guided practices',
                    count: allMindEntries.filter((entry) =>
                      entry.title.startsWith('Skill practice'),
                    ).length,
                  },
                  {
                    key: 'breathing',
                    label: 'Breathing',
                    count: allMindEntries.filter((entry) =>
                      entry.title.startsWith('Breathing rhythm'),
                    ).length,
                  },
                  {
                    key: 'sleep',
                    label: 'Sleep',
                    count:
                      allMindEntries.filter((entry) => entry.type === 'sleep').length +
                      dreamEntries.length,
                  },
                  { key: 'check-ins', label: 'Check-ins', count: history.length },
                ] as const
              ).map(({ key, label, count }) => (
                <button
                  key={key}
                  id={`record-tab-${key}`}
                  type="button"
                  role="tab"
                  aria-selected={recordView === key}
                  aria-controls="mind-record-panel"
                  tabIndex={recordView === key ? 0 : -1}
                  className={recordView === key ? 'selected' : ''}
                  onClick={() => setRecordView(key)}
                >
                  {label} <small>{count}</small>
                </button>
              ))}
            </div>
            <div
              id="mind-record-panel"
              role="tabpanel"
              aria-labelledby={`record-tab-${recordView}`}
              tabIndex={0}
            >
              {recordItems.length === 0 ? (
                <EmptyState text="No records match these filters. Try widening the time window or clearing a filter." />
              ) : (
                <div className="record-results-layout">
                  <div className="record-list" aria-label="Saved Mind records">
                    {recordItems.map((item) => (
                      <MindRecordCard
                        key={`${item.kind}-${item.entry.id}`}
                        item={item}
                        selected={
                          selectedRecord?.kind === item.kind &&
                          selectedRecord.entry.id === item.entry.id
                        }
                        onOpen={() => setSelectedRecord(item)}
                        onDelete={async () => {
                          if (item.kind === 'capture') {
                            if (await confirmDelete('Delete this private Mind record?')) {
                              await onDeleteCapture(item.entry.id)
                              if (selectedRecord?.entry.id === item.entry.id)
                                setSelectedRecord(null)
                            }
                          } else if (
                            item.kind === 'check-in' &&
                            (await confirmDelete('Delete this check-in?'))
                          ) {
                            await wellbeingRepository.remove(item.entry.id)
                            setHistory(await wellbeingRepository.list())
                            if (selectedRecord?.entry.id === item.entry.id) setSelectedRecord(null)
                          } else if (
                            item.kind === 'dream' &&
                            (await confirmDelete('Delete this sleep journal note?'))
                          ) {
                            await onDeleteDream(item.entry.id)
                            if (selectedRecord?.entry.id === item.entry.id) setSelectedRecord(null)
                          }
                        }}
                      />
                    ))}
                  </div>
                  <MindRecordPreview
                    item={selectedRecord}
                    onOpenFull={(item) => setDetailRecord(item)}
                    onEditJournal={(entry) => {
                      setSelectedRecord(null)
                      editJournalEntry(entry)
                    }}
                    onDelete={async (item) => {
                      setSelectedRecord(null)
                      if (item.kind === 'capture') {
                        if (await confirmDelete('Delete this private Mind record?')) {
                          await onDeleteCapture(item.entry.id)
                        }
                      } else if (
                        item.kind === 'check-in' &&
                        (await confirmDelete('Delete this check-in?'))
                      ) {
                        await wellbeingRepository.remove(item.entry.id)
                        setHistory(await wellbeingRepository.list())
                      } else if (
                        item.kind === 'dream' &&
                        (await confirmDelete('Delete this sleep journal note?'))
                      ) {
                        await onDeleteDream(item.entry.id)
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {detailRecord && (
        <MindRecordDialog
          item={detailRecord}
          onClose={() => setDetailRecord(null)}
          onEditJournal={(entry) => {
            setDetailRecord(null)
            setSelectedRecord(null)
            editJournalEntry(entry)
          }}
          onDelete={async (item) => {
            setDetailRecord(null)
            setSelectedRecord(null)
            if (item.kind === 'capture') {
              if (await confirmDelete('Delete this private Mind record?'))
                await onDeleteCapture(item.entry.id)
            } else if (item.kind === 'check-in' && (await confirmDelete('Delete this check-in?'))) {
              await wellbeingRepository.remove(item.entry.id)
              setHistory(await wellbeingRepository.list())
            } else if (
              item.kind === 'dream' &&
              (await confirmDelete('Delete this sleep journal note?'))
            ) {
              await onDeleteDream(item.entry.id)
            }
          }}
        />
      )}
      <aside className="mind-safety-note" role="note">
        <CircleHelp size={17} aria-hidden="true" />
        <div>
          <strong>Private reflection, not emergency monitoring</strong>
          <p>
            If you may be in immediate danger, contact local emergency services or a crisis resource
            for your region.
          </p>
        </div>
      </aside>
    </div>
  )
}

function MindRecordCard({
  item,
  selected,
  onOpen,
  onDelete,
}: {
  item: MindRecordItem
  selected?: boolean
  onOpen: () => void
  onDelete: () => Promise<void>
}) {
  const isCheckIn = item.kind === 'check-in'
  const isDream = item.kind === 'dream'
  const kind = isCheckIn
    ? { label: 'Check-in', className: 'check-in' }
    : isDream
      ? { label: 'Sleep note', className: 'sleep' }
      : mindRecordKind(item.entry)
  const title = isCheckIn
    ? 'Mind check-in'
    : isDream
      ? item.entry.title || 'Dream journal'
      : item.entry.title
  const date = isCheckIn || isDream ? item.entry.date : item.entry.occurredAt
  const summary = isCheckIn
    ? `${wellbeingSignals(item.entry).length} signal${wellbeingSignals(item.entry).length === 1 ? '' : 's'} recorded in this check-in.`
    : isDream
      ? plainRecordText(item.entry.content) || 'A private sleep journal note.'
      : plainRecordText(item.entry.note) ||
        (item.entry.value !== undefined && item.entry.value !== null
          ? `${item.entry.value}${item.entry.unit ? ` ${item.entry.unit}` : ''}`
          : 'A saved moment from your Mind workspace.')
  const signals = isCheckIn
    ? wellbeingSignals(item.entry)
    : isDream
      ? []
      : captureSignals(item.entry)
  const tags = isCheckIn
    ? []
    : isDream
      ? (item.entry.tags ?? [])
      : parseJournalTags(item.entry.payload?.tags)
  const recordDate = new Date(isCheckIn || isDream ? `${date}T12:00:00` : date)
  const dateMonth = recordDate.toLocaleString(undefined, { month: 'short' })
  const dateDay = recordDate.toLocaleString(undefined, { day: 'numeric' })
  const dateYear = recordDate.toLocaleString(undefined, { year: 'numeric' })
  const dateTime =
    isCheckIn || isDream
      ? ''
      : recordDate.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })

  return (
    <article className={`mind-record-card ${selected ? 'selected' : ''}`}>
      <time className="record-card-date" dateTime={date}>
        <strong>
          {dateMonth} {dateDay}
        </strong>
        <span>{dateYear}</span>
        {dateTime && <small>{dateTime}</small>}
      </time>
      <button className="mind-record-card-main" type="button" onClick={onOpen}>
        <div className="record-card-topline">
          <span className={`record-kind record-kind-${kind.className}`}>
            {isCheckIn ? (
              <HeartPulse size={14} />
            ) : kind.className === 'journal' ? (
              <BookOpen size={14} />
            ) : kind.className === 'sleep' ? (
              <Moon size={14} />
            ) : (
              <Sparkles size={14} />
            )}
            {kind.label}
          </span>
          <span className="record-card-stat">
            {signals.length > 0
              ? `${signals.length} signal${signals.length === 1 ? '' : 's'}`
              : 'Saved record'}
          </span>
        </div>
        <h4>{title}</h4>
        <p className="record-card-summary">{summary}</p>
        {(signals.length > 0 || tags.length > 0) && (
          <div className="record-card-meta">
            {signals.slice(0, 4).map((signal) => (
              <span className="record-signal-chip" key={signal}>
                {signal}
              </span>
            ))}
            {signals.length > 4 && (
              <span className="record-signal-chip">+{signals.length - 4} more</span>
            )}
            {tags.map((tag) => (
              <span className="record-tag-chip" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
        )}
        <span className="record-open-hint">
          Open record <ChevronRight size={15} aria-hidden="true" />
        </span>
      </button>
      <div className="record-card-actions">
        <button
          className="icon-button danger"
          type="button"
          aria-label={`Delete ${title}`}
          onClick={() => void onDelete()}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  )
}

function MindRecordPreview({
  item,
  onOpenFull,
  onEditJournal,
  onDelete,
}: {
  item: MindRecordItem | null
  onOpenFull: (item: MindRecordItem) => void
  onEditJournal: (entry: CaptureEntry) => void
  onDelete: (item: MindRecordItem) => Promise<void>
}) {
  if (!item) {
    return (
      <aside className="record-preview-panel record-preview-empty">
        <div className="record-preview-empty-icon">
          <BookOpen size={20} />
        </div>
        <p className="eyebrow">Record reader</p>
        <h3>Select a record to read it here.</h3>
        <p className="muted">
          The full entry will stay beside your list, so you can move through your record without
          losing your place.
        </p>
      </aside>
    )
  }

  const isCheckIn = item.kind === 'check-in'
  const isDream = item.kind === 'dream'
  const kind = isCheckIn
    ? { label: 'Check-in', className: 'check-in' }
    : isDream
      ? { label: 'Sleep note', className: 'sleep' }
      : mindRecordKind(item.entry)
  const title = isCheckIn
    ? 'Mind check-in'
    : isDream
      ? item.entry.title || 'Dream journal'
      : item.entry.title
  const date = isCheckIn || isDream ? item.entry.date : item.entry.occurredAt
  const signals = isCheckIn
    ? wellbeingSignals(item.entry)
    : isCaptureRecord(item)
      ? captureSignals(item.entry)
      : []
  const tags = isCheckIn
    ? []
    : isDream
      ? (item.entry.tags ?? [])
      : parseJournalTags(item.entry.payload?.tags)

  return (
    <aside className="record-preview-panel">
      <div className="record-preview-header">
        <span className={`record-kind record-kind-${kind.className}`}>
          {isCheckIn ? (
            <HeartPulse size={14} />
          ) : kind.className === 'journal' ? (
            <BookOpen size={14} />
          ) : kind.className === 'sleep' ? (
            <Moon size={14} />
          ) : (
            <Sparkles size={14} />
          )}
          {kind.label}
        </span>
        <time>
          {new Date(isCheckIn || isDream ? `${date}T12:00:00` : date).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: isCheckIn ? undefined : 'short',
          })}
        </time>
      </div>
      <div>
        <h3>{title}</h3>
        <p className="record-preview-subtitle">
          {isCheckIn
            ? `${signals.length} signal${signals.length === 1 ? '' : 's'} recorded`
            : isDream
              ? 'Private sleep journal note'
              : item.entry.context === 'journal'
                ? 'Private journal entry'
                : 'Saved from your Mind workspace'}
        </p>
      </div>
      {isCheckIn ? (
        <div className="record-preview-signals">
          {signals.map((signal) => (
            <span className="record-signal-chip" key={signal}>
              {signal}
            </span>
          ))}
        </div>
      ) : isDream ? (
        <div className="record-preview-note">
          <MarkdownPreview source={item.entry.content} />
        </div>
      ) : item.entry.note ? (
        <div className="record-preview-note">
          <MarkdownPreview source={item.entry.note} />
        </div>
      ) : (
        <p className="muted record-preview-note">No written note was added to this record.</p>
      )}
      {tags.length > 0 && (
        <div className="record-preview-section">
          <p className="eyebrow">Tags</p>
          <div className="record-card-meta">
            {tags.map((tag) => (
              <span className="record-tag-chip" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="record-preview-actions">
        <button className="primary-button" type="button" onClick={() => onOpenFull(item)}>
          Open full record <ChevronRight size={15} />
        </button>
        {isCaptureRecord(item) && item.entry.context === 'journal' && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => onEditJournal(item.entry)}
          >
            <Edit3 size={15} /> Edit
          </button>
        )}
        <button
          className="icon-button danger"
          type="button"
          aria-label={`Delete ${title}`}
          onClick={() => void onDelete(item)}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </aside>
  )
}

function MindRecordDialog({
  item,
  onClose,
  onEditJournal,
  onDelete,
}: {
  item: MindRecordItem
  onClose: () => void
  onEditJournal: (entry: CaptureEntry) => void
  onDelete: (item: MindRecordItem) => Promise<void>
}) {
  const dialogRef = useRef<HTMLElement>(null)
  useDialogFocus(dialogRef, onClose)
  const isCheckIn = item.kind === 'check-in'
  const isDream = item.kind === 'dream'
  const kind = isCheckIn
    ? { label: 'Check-in', className: 'check-in' }
    : isDream
      ? { label: 'Sleep note', className: 'sleep' }
      : mindRecordKind(item.entry)
  const title = isCheckIn
    ? 'Mind check-in'
    : isDream
      ? item.entry.title || 'Dream journal'
      : item.entry.title
  const date = isCheckIn || isDream ? item.entry.date : item.entry.occurredAt
  const signals = isCheckIn
    ? wellbeingSignals(item.entry)
    : isCaptureRecord(item)
      ? captureSignals(item.entry)
      : []
  const tags = isCheckIn
    ? []
    : isDream
      ? (item.entry.tags ?? [])
      : parseJournalTags(item.entry.payload?.tags)

  return (
    <div
      className="record-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="record-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-detail-title"
      >
        <div className="record-detail-header">
          <div>
            <span className={`record-kind record-kind-${kind.className}`}>
              {isCheckIn ? (
                <HeartPulse size={14} />
              ) : kind.className === 'journal' ? (
                <BookOpen size={14} />
              ) : kind.className === 'sleep' ? (
                <Moon size={14} />
              ) : (
                <Sparkles size={14} />
              )}
              {kind.label}
            </span>
            <p className="record-detail-date">
              {new Date(isCheckIn || isDream ? `${date}T12:00:00` : date).toLocaleString(
                undefined,
                {
                  dateStyle: 'full',
                  timeStyle: isCheckIn ? undefined : 'short',
                },
              )}
            </p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close record">
            <X size={19} />
          </button>
        </div>
        <h2 id="record-detail-title">{title}</h2>
        <div className="record-detail-body">
          {isCheckIn ? (
            <>
              <p className="record-detail-intro">
                A self-reported snapshot from your Mind check-in. It is context to revisit, not a
                score or diagnosis.
              </p>
              <div className="record-detail-signal-grid">
                {wellbeingSignalDefinitions.map(({ key, label, low, high, icon }) => {
                  const value = item.entry[key]
                  if (value === undefined) return null
                  return (
                    <div className="record-detail-signal" key={key}>
                      <div>
                        <span className="feeling-icon">{icon}</span>
                        <strong>{label}</strong>
                      </div>
                      <b>{value}/5</b>
                      <small>
                        {low} · {high}
                      </small>
                    </div>
                  )
                })}
              </div>
              {item.entry.note && (
                <div className="record-detail-note">
                  <p className="eyebrow">Your note</p>
                  <p>{item.entry.note}</p>
                </div>
              )}
            </>
          ) : isDream ? (
            <div className="record-detail-note">
              <MarkdownPreview source={item.entry.content} />
              {tags.length > 0 && (
                <div className="record-detail-section">
                  <p className="eyebrow">Tags</p>
                  <div className="record-card-meta">
                    {tags.map((tag) => (
                      <span className="record-tag-chip" key={tag}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {item.entry.value !== undefined && item.entry.value !== null && (
                <div className="record-detail-value">
                  <span>Recorded value</span>
                  <strong>
                    {item.entry.value} {item.entry.unit}
                  </strong>
                </div>
              )}
              {item.entry.note ? (
                <div className="record-detail-note markdown-detail-note">
                  <MarkdownPreview source={item.entry.note} />
                </div>
              ) : (
                <p className="record-detail-intro">No written note was added to this record.</p>
              )}
              {signals.length > 0 && (
                <div className="record-detail-section">
                  <p className="eyebrow">Signals captured with this record</p>
                  <div className="record-card-meta">
                    {signals.map((signal) => (
                      <span className="record-signal-chip" key={signal}>
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {tags.length > 0 && (
                <div className="record-detail-section">
                  <p className="eyebrow">Tags</p>
                  <div className="record-card-meta">
                    {tags.map((tag) => (
                      <span className="record-tag-chip" key={tag}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="record-detail-footer">
          {isCaptureRecord(item) && item.entry.context === 'journal' && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => onEditJournal(item.entry)}
            >
              <Edit3 size={15} /> Edit in journal
            </button>
          )}
          <button className="danger-button" type="button" onClick={() => void onDelete(item)}>
            <Trash2 size={15} /> Delete record
          </button>
        </div>
      </section>
    </div>
  )
}

function ScaleInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      {label} <span className="scale-caption">1–5</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Skip</option>
        <option value="1">1 · low</option>
        <option value="2">2</option>
        <option value="3">3 · middle</option>
        <option value="4">4</option>
        <option value="5">5 · high</option>
      </select>
    </label>
  )
}

function FeelingScale({
  label,
  value,
  onChange,
  low,
  high,
  icon,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  low: string
  high: string
  icon: string
}) {
  return (
    <div className="feeling-scale">
      <div className="feeling-scale-heading">
        <span className="feeling-icon">{icon}</span>
        <strong>{label}</strong>
        <small>{value ? `${value} of 5` : 'Optional'}</small>
      </div>
      <div className="feeling-options" role="group" aria-label={`${label} scale`}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            className={value === String(score) ? 'selected' : ''}
            aria-pressed={value === String(score)}
            onClick={() => onChange(String(score))}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="feeling-scale-labels">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}

const mentalTrainingModes = [
  {
    id: 'reset',
    label: 'Reset',
    meta: '60 sec · nervous system',
    description: 'Come back to the room when your mind feels loud or scattered.',
    icon: '○',
    steps: [
      { title: 'Orient', prompt: 'Name three things you can see. Let your eyes move slowly.' },
      {
        title: 'Soften',
        prompt: 'Notice where your body is supported. Let one area unclench by 5%.',
      },
      {
        title: 'Choose',
        prompt: 'Ask: what is the kindest useful thing I can do in the next ten minutes?',
      },
    ],
  },
  {
    id: 'focus',
    label: 'Focus',
    meta: '2 min · attention',
    description: 'Practice returning to one thing without making distraction a failure.',
    icon: '＋',
    steps: [
      {
        title: 'Pick one thing',
        prompt: 'Choose one task that deserves your attention for the next ten minutes.',
      },
      {
        title: 'Make it visible',
        prompt: 'Write the smallest next action. Make it concrete enough to begin.',
      },
      {
        title: 'Return',
        prompt:
          'When attention wanders, label it gently: “elsewhere.” Then come back to the next action.',
      },
    ],
  },
  {
    id: 'reframe',
    label: 'Reframe',
    meta: '3 min · perspective',
    description: 'Widen a sticky story without arguing yourself out of what hurts.',
    icon: '↗',
    steps: [
      {
        title: 'Name the story',
        prompt: 'What conclusion is your mind offering about this moment?',
      },
      { title: 'Add the facts', prompt: 'What do you know for sure, and what are you filling in?' },
      {
        title: 'Make room',
        prompt: 'What else could be true at the same time, even if the hard part is still real?',
      },
    ],
  },
  {
    id: 'recover',
    label: 'Recover',
    meta: '2 min · self-talk',
    description: 'Turn a harsh inner verdict into useful information and a next step.',
    icon: '♡',
    steps: [
      {
        title: 'Notice the verdict',
        prompt: 'What are you saying to yourself that you would not say to someone you care about?',
      },
      {
        title: 'Tell the fuller truth',
        prompt: 'Keep the honest part. Add the context, effort, or uncertainty that also belongs.',
      },
      {
        title: 'Lower the bar',
        prompt: 'What would “good enough for today” look like in one observable action?',
      },
    ],
  },
] as const
type MentalTrainingMode = (typeof mentalTrainingModes)[number]

function MentalTraining({
  onSaveAnswer,
}: {
  onSaveAnswer: (type: string, prompt: string, answer: string, feedback: string) => Promise<void>
}) {
  const [modeId, setModeId] = useState<MentalTrainingMode['id']>('reset')
  const [stepIndex, setStepIndex] = useState(0)
  const [reflection, setReflection] = useState('')
  const [completedToday, setCompletedToday] = useState(() => {
    try {
      return Number(
        window.localStorage.getItem(
          `nxt-mental-training-${new Date().toISOString().slice(0, 10)}`,
        ) ?? 0,
      )
    } catch {
      return 0
    }
  })
  const mode = mentalTrainingModes.find((item) => item.id === modeId) ?? mentalTrainingModes[0]
  const step = mode.steps[stepIndex]
  const isLastStep = stepIndex === mode.steps.length - 1

  function chooseMode(nextMode: MentalTrainingMode['id']) {
    setModeId(nextMode)
    setStepIndex(0)
    setReflection('')
  }

  function complete() {
    const nextCount = completedToday + 1
    window.localStorage.setItem(
      `nxt-mental-training-${new Date().toISOString().slice(0, 10)}`,
      String(nextCount),
    )
    setCompletedToday(nextCount)
    void onSaveAnswer(
      mode.label,
      `${mode.label}: ${step.title} — ${step.prompt}`,
      reflection.trim() || 'Completed without a written note.',
      `Completed a ${mode.meta} mental training rep. No score recorded.`,
    )
    setStepIndex(0)
    setReflection('')
  }

  function advance() {
    if (isLastStep) {
      complete()
      return
    }
    setStepIndex((current) => current + 1)
    setReflection('')
  }

  return (
    <section className="panel mental-training">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Mental training</p>
          <h3>Train a skill you can use today.</h3>
        </div>
        <span className="source-pill">Optional</span>
      </div>
      <p className="muted compact-copy">
        Short, practical reps for attention, perspective, and recovery. Choose what would help right
        now. There is nothing to get right, and stopping early still counts.
      </p>
      <div className="training-overview">
        <div>
          <span className="training-overview-label">Today’s reps</span>
          <strong>{completedToday}</strong>
          <span>{completedToday === 1 ? 'practice completed' : 'practices completed'}</span>
        </div>
        <p>Small repetitions build a more available mind. Try one, then return to your day.</p>
      </div>
      <div className="training-mode-grid" role="list" aria-label="Mental training modes">
        {mentalTrainingModes.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`training-mode-card${item.id === mode.id ? ' selected' : ''}`}
            aria-pressed={item.id === mode.id}
            onClick={() => chooseMode(item.id)}
          >
            <span className="training-mode-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.meta}</small>
            </span>
            <em>{item.description}</em>
          </button>
        ))}
      </div>
      <div className="training-practice">
        <div className="training-practice-heading">
          <div>
            <span className="training-step-label">
              {mode.label} · step {stepIndex + 1} of {mode.steps.length}
            </span>
            <h4>{step.title}</h4>
          </div>
          <div
            className="training-progress-dots"
            aria-label={`Step ${stepIndex + 1} of ${mode.steps.length}`}
          >
            {mode.steps.map((item, index) => (
              <span key={item.title} className={index <= stepIndex ? 'active' : ''} />
            ))}
          </div>
        </div>
        <p className="training-practice-prompt">{step.prompt}</p>
        <label className="training-reflection-field">
          Optional note
          <textarea
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            placeholder="What did you notice?"
            rows={2}
          />
        </label>
        <div className="training-practice-actions">
          <button
            className="secondary-button"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((current) => current - 1)}
          >
            Back
          </button>
          <button className="primary-button" onClick={advance}>
            {isLastStep ? 'Complete rep' : 'Next step'} <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <p className="training-footnote">
        Private and educational. This is a practice space, not therapy or crisis care.
      </p>
    </section>
  )
}

// Retained temporarily for migration of older local records; the Mind page now uses
// the technique library as its single mental-training surface.
void MentalTraining

const writingPromptTemplates = [
  'What felt most present in your {lens} today?',
  'What did you notice in your {lens} that you usually move past?',
  'Where did your {lens} ask for patience today?',
  'What is one small truth about your {lens} that you want to remember?',
  'What supported your {lens} today, even briefly?',
  'What would you like to meet with more curiosity in your {lens}?',
  'What did your {lens} teach you about what matters?',
  'Where did you choose, rather than simply react, in your {lens}?',
  'What felt unfinished in your {lens}, and what would “enough for today” look like?',
  'What quality would you like to bring to your {lens} tomorrow?',
  'What changed in your {lens} over the course of the day?',
  'What deserves appreciation in your {lens}, without needing to be perfect?',
  'What story did your mind tell about your {lens}? What else might be true?',
  'What would a kinder interpretation of your {lens} include?',
  'What are you ready to release from your {lens} for tonight?',
] as const
const writingPromptLenses = [
  'body',
  'attention',
  'relationships',
  'work or learning',
  'home',
  'choices',
  'energy',
  'rest',
  'values',
  'the natural world',
  'uncertainty',
  'joy',
  'difficulty',
  'future self',
  'the way you spoke to yourself',
  'belonging',
  'change',
  'care',
  'courage',
  'ordinary moments',
  'boundaries',
  'gratitude',
  'play',
  'meaning',
  'the next season of life',
] as const
const writingPrompts = Array.from({ length: 365 }, (_, index) => {
  const template = writingPromptTemplates[index % writingPromptTemplates.length]
  const lens =
    writingPromptLenses[
      Math.floor(index / writingPromptTemplates.length) % writingPromptLenses.length
    ]
  return { day: index + 1, text: template.replace('{lens}', lens) }
})

function DailyWritingPrompts({
  supportStyle,
  onUsePrompt,
}: {
  supportStyle: SupportStyle
  onUsePrompt: (prompt: string) => void
}) {
  const [showInfo, setShowInfo] = useState(false)
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000)
  const currentIndex = (dayOfYear - 1) % writingPrompts.length
  const current = writingPrompts[currentIndex]
  const styleCopy: Record<SupportStyle, string> = {
    gentle: 'A quiet invitation for today. Write freely below; the prompt is never a requirement.',
    direct: 'A practical question for today. Answer briefly, honestly, or skip it.',
    reflective: 'A spacious question for today. Follow the thread that feels worth noticing.',
  }
  return (
    <div className="journal-writing-prompt">
      <div className="journal-prompt-header">
        <div>
          <p className="eyebrow">Today&apos;s writing prompt</p>
          <p className="journal-prompt-question">{current.text}</p>
        </div>
        <div className="journal-prompt-actions">
          <button className="secondary-button" onClick={() => onUsePrompt(current.text)}>
            Use prompt
          </button>
          <button
            className="icon-button prompt-info-button"
            aria-label="About this writing prompt"
            aria-expanded={showInfo}
            onClick={() => setShowInfo((value) => !value)}
          >
            <CircleHelp size={18} />
          </button>
        </div>
      </div>
      <span className="journal-prompt-support muted">{styleCopy[supportStyle]}</span>
      {showInfo && (
        <div className="prompt-info" role="note">
          <strong>What this invites</strong>
          <p>
            This is a gentle starting point, not a question you have to answer perfectly. Write a
            few words, describe a moment, add an emoji, or skip it if it does not fit today.
          </p>
        </div>
      )}
    </div>
  )
}

function MarkdownPreview({ source }: { source: string }) {
  const html = DOMPurify.sanitize(marked.parse(source, { gfm: true, breaks: true }) as string, {
    ADD_ATTR: ['target', 'rel'],
    ADD_DATA_URI_TAGS: ['img'],
  })
  return <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: html }} />
}

function MarkdownEditor({
  emojiTheme,
  value,
  onChange,
}: {
  emojiTheme: EmojiTheme
  value: string
  onChange: (value: string) => void
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [gifQuery, setGifQuery] = useState('')
  const [gifUrl, setGifUrl] = useState('')
  const [gifResults, setGifResults] = useState<Array<{ id: string; url: string; preview: string }>>(
    [],
  )
  const [gifOpen, setGifOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [gifLoading, setGifLoading] = useState(false)
  const [gifError, setGifError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiDialogRef = useRef<HTMLDivElement>(null)
  const gifDialogRef = useRef<HTMLDivElement>(null)
  const closeEmoji = useCallback(() => setEmojiOpen(false), [])
  const closeGif = useCallback(() => setGifOpen(false), [])
  useDialogFocus(emojiDialogRef, closeEmoji, emojiOpen)
  useDialogFocus(gifDialogRef, closeGif, gifOpen)

  const toggleGif = useCallback(() => {
    setGifOpen((open) => {
      const next = !open
      if (next) setEmojiOpen(false)
      return next
    })
  }, [])

  const toggleEmoji = useCallback(() => {
    setEmojiOpen((open) => {
      const next = !open
      if (next) setGifOpen(false)
      return next
    })
  }, [])

  function insertMarkdown(prefix: string, suffix = '', placeholder = 'text') {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.slice(start, end)
    const insertion = selected
      ? `${prefix}${selected}${suffix}`
      : `${prefix}${placeholder}${suffix}`
    const next = value.slice(0, start) + insertion + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + insertion.length
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  function insertTable() {
    insertMarkdown('| Column | Column |\n| --- | --- |\n| Cell | Cell |\n', '', '')
  }

  function insertImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || file.size > 5 * 1024 * 1024) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const alt = file.name.replace(/\.[^.]+$/, '') || 'journal image'
      insertMarkdown(`![${alt}](${String(reader.result)})`, '', '')
    })
    reader.readAsDataURL(file)
  }

  async function searchGifs() {
    const query = gifQuery.trim()
    if (!query) return
    setGifLoading(true)
    setGifError('')
    try {
      const response = await fetch(
        `https://gifsnap.com/api/v1/gifs/search?q=${encodeURIComponent(query)}&page=1&limit=12`,
      )
      if (!response.ok) throw new Error('GIF search failed')
      const data = (await response.json()) as {
        data?: Array<{ id: string; url?: string; preview_url?: string; title?: string }>
      }
      setGifResults(
        (data.data ?? [])
          .map((gif) => ({
            id: gif.id,
            url: gif.url ?? '',
            preview: gif.preview_url ?? gif.url ?? '',
          }))
          .filter((gif) => gif.url),
      )
    } catch {
      setGifError('GIF search is unavailable right now. Try again or paste a GIF URL instead.')
    } finally {
      setGifLoading(false)
    }
  }

  return (
    <div className="markdown-editor">
      <div className="markdown-editor-header">
        <div className="markdown-editor-tabs" role="tablist" aria-label="Journal editor mode">
          <button
            type="button"
            id="markdown-tab-write"
            role="tab"
            aria-selected={mode === 'write'}
            aria-controls="markdown-panel-write"
            tabIndex={mode === 'write' ? 0 : -1}
            className={mode === 'write' ? 'selected' : ''}
            onClick={() => setMode('write')}
          >
            Write
          </button>
          <button
            type="button"
            id="markdown-tab-preview"
            role="tab"
            aria-selected={mode === 'preview'}
            aria-controls="markdown-panel-preview"
            tabIndex={mode === 'preview' ? 0 : -1}
            className={mode === 'preview' ? 'selected' : ''}
            onClick={() => setMode('preview')}
          >
            Preview
          </button>
        </div>
        <span className="markdown-support-label">Markdown · tables · media</span>
      </div>
      {mode === 'write' ? (
        <div
          id="markdown-panel-write"
          role="tabpanel"
          aria-labelledby="markdown-tab-write"
          tabIndex={0}
        >
          <textarea
            ref={textareaRef}
            rows={6}
            value={value}
            aria-label="Journal entry"
            onChange={(event) => onChange(event.target.value)}
            placeholder="Write here… or use the prompt above to start with a question."
          />
          <div className="markdown-toolbar" aria-label="Markdown shortcuts">
            <button
              type="button"
              onClick={() => insertMarkdown('**', '**', 'bold text')}
              title="Bold"
            >
              Bold
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('*', '*', 'italic text')}
              title="Italic"
            >
              Italic
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('# ', '', 'Heading')}
              title="Heading 1"
            >
              H1
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('## ', '', 'Heading')}
              title="Heading"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('- ', '', 'list item')}
              title="Bullet list"
            >
              List
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('1. ', '', 'list item')}
              title="Numbered list"
            >
              1–2–3
            </button>
            <button type="button" onClick={() => insertMarkdown('> ', '', 'quote')} title="Quote">
              Quote
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('[', '](https://example.com)', 'link text')}
              title="Link"
            >
              Link
            </button>
            <button type="button" onClick={insertTable} title="Table">
              Table
            </button>
            <label className="markdown-media-button" title="Add an image">
              Add image
              <input type="file" accept="image/*" onChange={insertImage} />
            </label>
            <button
              type="button"
              onClick={toggleGif}
              title="Search GIFs"
              aria-expanded={gifOpen}
              aria-controls="gif-search-panel"
              className={gifOpen ? 'selected' : ''}
            >
              GIF
            </button>
            <button
              type="button"
              onClick={toggleEmoji}
              title="Insert emoji"
              aria-expanded={emojiOpen}
              aria-controls="emoji-picker-panel"
              className={emojiOpen ? 'selected' : ''}
            >
              Emoji
            </button>
          </div>
          {emojiOpen && (
            <div
              ref={emojiDialogRef}
              id="emoji-picker-panel"
              className="emoji-picker-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Choose an emoji"
            >
              <div className="emoji-picker-heading">
                <strong>Choose from the full emoji library</strong>
                <button className="text-button" type="button" onClick={() => setEmojiOpen(false)}>
                  Done
                </button>
              </div>
              <EmojiPicker
                theme={emojiTheme}
                lazyLoadEmojis
                searchPlaceholder="Search emojis"
                previewConfig={{ showPreview: false }}
                onEmojiClick={(emoji: EmojiClickData) => insertMarkdown(emoji.emoji, '', '')}
              />
            </div>
          )}
          {gifOpen && (
            <div
              ref={gifDialogRef}
              id="gif-search-panel"
              className="gif-search-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Search GIFs"
            >
              <div className="gif-search-row gif-url-row">
                <input
                  value={gifUrl}
                  onChange={(event) => setGifUrl(event.target.value)}
                  placeholder="Paste a GIF URL (works without an API key)"
                  aria-label="Paste a GIF URL"
                />
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!gifUrl.trim()}
                  onClick={() => {
                    insertMarkdown('', '', `![GIF](${gifUrl.trim()})`)
                    setGifUrl('')
                    setGifOpen(false)
                  }}
                >
                  Insert GIF
                </button>
              </div>
              <div className="gif-search-row">
                <input
                  value={gifQuery}
                  onChange={(event) => setGifQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void searchGifs()
                  }}
                  placeholder="Search GIFs"
                  aria-label="Search GIFs"
                />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void searchGifs()}
                >
                  {gifLoading ? 'Searching…' : 'Search'}
                </button>
              </div>
              {gifLoading && (
                <small className="provider-note" role="status" aria-live="polite">
                  Searching GIFs…
                </small>
              )}
              {gifError && (
                <small className="form-error" role="alert">
                  {gifError}
                </small>
              )}
              {!gifError && (
                <small className="markdown-editor-help">
                  Search is powered by GifSnap. Direct GIF URLs and local uploads remain supported.
                </small>
              )}
              {gifResults.length > 0 && (
                <div className="gif-result-grid">
                  {gifResults.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      className="gif-result"
                      onClick={() => {
                        insertMarkdown('', '', `![GIF](${gif.url})`)
                        setGifOpen(false)
                      }}
                      title="Insert GIF"
                    >
                      <img src={gif.preview} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          id="markdown-panel-preview"
          role="tabpanel"
          aria-labelledby="markdown-tab-preview"
          tabIndex={0}
        >
          <MarkdownPreview source={value || '*Nothing written yet.*'} />
        </div>
      )}
      <small className="markdown-editor-help">
        Your Markdown and uploaded media stay in this browser. Remote links and images only load if
        you include them.
      </small>
    </div>
  )
}

const contemplativeSkillCollections = {
  CBT: {
    description:
      'Notice the link between situations, thoughts, feelings, and actions. Test thoughts with curiosity rather than force.',
    items: [
      {
        title: 'Thought record',
        cue: 'Catch a hot thought and look for a more balanced view.',
        steps:
          'Situation → automatic thought → feeling → evidence for → evidence against → balanced response.',
      },
      {
        title: 'Behavioral experiment',
        cue: 'Turn a prediction into a small, safe test.',
        steps:
          'Write the prediction, choose one observable experiment, notice what happened, and update the belief.',
      },
      {
        title: 'Cognitive continuum',
        cue: 'Move beyond all-or-nothing labels.',
        steps:
          'Place the situation on a 0–100 continuum. Ask what would move it five points toward the middle.',
      },
      {
        title: 'Problem-solving ladder',
        cue: 'Separate solvable problems from painful facts.',
        steps:
          'Define the problem, brainstorm options, choose one small next step, try it, and review.',
      },
      {
        title: 'Worry postponement',
        cue: 'Give repetitive worry a container instead of the whole day.',
        steps:
          'Name the worry, schedule a short review window, return to the present, and revisit only if useful.',
      },
      {
        title: 'Strengths and exceptions',
        cue: 'Find evidence that the problem is not the whole story.',
        steps:
          'When was this slightly less intense? What were you doing, and what part of that can you repeat?',
      },
      {
        title: 'Alternative explanations',
        cue: 'Loosen the first story your mind offers.',
        steps: 'List three explanations: the harshest, the kindest, and the most evidence-based.',
      },
      {
        title: 'Core belief lens',
        cue: 'Notice the deeper rule a difficult moment may be activating.',
        steps:
          'Name the situation, the rule underneath it, where it came from, and a more flexible rule.',
      },
      {
        title: 'Evidence log',
        cue: 'Build a fuller picture from what actually happened.',
        steps:
          'Record the prediction, supporting evidence, disconfirming evidence, and what remains unknown.',
      },
      {
        title: 'Activity experiment',
        cue: 'Test whether a small action changes energy or mood.',
        steps:
          'Choose a low-risk action, predict the effect, try it briefly, and compare the result.',
      },
      {
        title: 'Coping card',
        cue: 'Create a short response for a recurring hard moment.',
        steps:
          'Write the trigger, the unhelpful story, three grounded reminders, and one next step.',
      },
      {
        title: 'Cost-benefit balance',
        cue: 'Look at what a habit gives you and what it costs.',
        steps:
          'List short- and long-term benefits and costs, then choose one compassionate adjustment.',
      },
      {
        title: 'Graded approach',
        cue: 'Turn avoidance into a ladder of manageable steps.',
        steps:
          'Name the avoided situation, rank steps from easier to harder, and choose the next safe rung.',
      },
      {
        title: 'Self-compassionate reframe',
        cue: 'Replace a harsh verdict with accurate, humane language.',
        steps:
          'Write the harsh thought, the facts, what you would say to a friend, and a balanced version.',
      },
      {
        title: 'Maintenance plan',
        cue: 'Decide how to keep a helpful change going.',
        steps:
          'Name what helped, the early warning sign, the smallest restart, and who or what can support it.',
      },
    ],
  },
  DBT: {
    description:
      'Practical skills for distress tolerance, emotion regulation, mindfulness, and effective relationships.',
    items: [
      {
        title: 'STOP',
        cue: 'Pause before an impulse becomes an action.',
        steps:
          'Stop. Take a step back. Observe what is happening inside and around you. Proceed mindfully.',
      },
      {
        title: 'TIP reset',
        cue: 'Use the body to lower acute emotional intensity.',
        steps:
          'Try a safe temperature change, brief intense movement, and paced breathing. Stop if uncomfortable or medically unsuitable.',
      },
      {
        title: 'Check the facts',
        cue: 'Separate the event from the prediction attached to it.',
        steps:
          'Name the facts, name the interpretation, identify the emotion, and choose an intensity that fits the facts.',
      },
      {
        title: 'Opposite action',
        cue: 'When an emotion does not fit the facts, try a values-consistent opposite step.',
        steps: 'Name the urge, check whether it fits, then act opposite in a gradual and safe way.',
      },
      {
        title: 'Self-soothe with the senses',
        cue: 'Offer your nervous system a gentle anchor.',
        steps: 'Choose one sight, sound, scent, taste, and texture that feels safe and grounding.',
      },
      {
        title: 'DEAR MAN',
        cue: 'Ask for what you need while protecting the relationship.',
        steps:
          'Describe, Express, Assert, Reinforce. Stay Mindful, Appear confident, and Negotiate.',
      },
      {
        title: 'Radical acceptance',
        cue: 'Stop fighting the fact that this moment is already here.',
        steps:
          'Name the reality, notice the pain of resisting it, and choose the next skillful action without approving of the situation.',
      },
      {
        title: 'PLEASE check',
        cue: 'Support emotional steadiness through basic physical care.',
        steps:
          'Check physical illness, eating, substance use, sleep, and exercise without turning care into a score.',
      },
      {
        title: 'ACCEPTS',
        cue: 'Use attention and connection to get through a difficult moment.',
        steps:
          'Try activities, contributing, comparison, emotions, pushing away, thoughts, or sensations as appropriate.',
      },
      {
        title: 'IMPROVE the moment',
        cue: 'Add a small supportive quality to an unpleasant situation.',
        steps:
          'Use imagery, meaning, prayer or values, relaxation, one thing at a time, or a brief encouragement.',
      },
      {
        title: 'Mindfulness of current emotion',
        cue: 'Observe an emotion without becoming the emotion.',
        steps:
          'Name it, locate it, describe its movement, and allow it to change without feeding or suppressing it.',
      },
      {
        title: 'Validation ladder',
        cue: 'Practice understanding before trying to solve.',
        steps:
          'Reflect the facts, the feeling, the history, and the understandable need before choosing a response.',
      },
      {
        title: 'GIVE',
        cue: 'Protect connection while communicating clearly.',
        steps:
          'Be gentle, interested, validating, and easy in manner while keeping your boundaries.',
      },
      {
        title: 'FAST',
        cue: 'Keep self-respect present during a difficult interaction.',
        steps:
          'Be fair, avoid over-apologizing, stick to values, and be truthful without unnecessary cruelty.',
      },
      {
        title: 'Urge surfing',
        cue: 'Ride an urge without needing to act on it immediately.',
        steps:
          'Name the urge, watch its rise and fall, delay action briefly, and choose what serves you.',
      },
    ],
  },
  'Secular practice': {
    description:
      'Contemplative exercises grounded in attention, compassion, ethics, impermanence, and wise action—without requiring a religious belief.',
    items: [
      {
        title: 'Three-minute sitting',
        cue: 'Arrive with the body, feeling tone, and mind.',
        steps:
          'Notice posture and breath. Notice whether experience feels pleasant, unpleasant, or neutral. Notice the mind’s movement without chasing it.',
      },
      {
        title: 'Impermanence inquiry',
        cue: 'See change directly instead of treating a state as fixed.',
        steps:
          'Choose one sensation, mood, or thought. Watch its beginning, middle, and changing edge.',
      },
      {
        title: 'Metta / goodwill',
        cue: 'Practice a less adversarial relationship with yourself and others.',
        steps:
          'Offer simple wishes: may I be safe, may I be well, may I meet this with clarity. Extend them outward only if it feels genuine.',
      },
      {
        title: 'The pause before grasping',
        cue: 'Notice wanting without having to obey it.',
        steps:
          'Name the pull, locate it in the body, feel its changing texture, and choose whether acting on it serves your values.',
      },
      {
        title: 'Wise effort check',
        cue: 'Balance persistence with release.',
        steps: 'Ask: what should I prevent, let go of, cultivate, and maintain right now?',
      },
      {
        title: 'Compassionate perspective',
        cue: 'Hold suffering and agency together.',
        steps:
          'Name what hurts, name the conditions around it, and ask what small action reduces harm for yourself or someone else.',
      },
      {
        title: 'Everyday ethics',
        cue: 'Bring practice into speech, work, and relationships.',
        steps: 'Before acting, ask: is it true, useful, timely, and kind enough for this moment?',
      },
      {
        title: 'Open awareness',
        cue: 'Let sounds, sensations, and thoughts arise without choosing one anchor.',
        steps:
          'Notice what arrives, label it lightly, and let attention move without needing to hold or reject it.',
      },
      {
        title: 'Beginner’s mind',
        cue: 'Meet a familiar situation without assuming you already know it.',
        steps: 'Name the familiar story, look for one fresh detail, and ask what remains unknown.',
      },
      {
        title: 'Noticing choice',
        cue: 'Find the small space between an impulse and an action.',
        steps:
          'Notice the impulse, feel the pause, name two possible actions, and choose one deliberately.',
      },
      {
        title: 'Four foundations reflection',
        cue: 'Look at body, feeling tone, mind, and patterns together.',
        steps:
          'Notice one body signal, tone, mental state, and recurring pattern without judging any of them.',
      },
      {
        title: 'Equanimity practice',
        cue: 'Care about an outcome without pretending you control every condition.',
        steps: 'Name what you can influence, what you cannot, and how to stay present with both.',
      },
      {
        title: 'Gratitude without bypassing',
        cue: 'Hold appreciation alongside what is difficult.',
        steps:
          'Name one support and one pain. Let both be true without using either to erase the other.',
      },
      {
        title: 'Compassionate boundaries',
        cue: 'Let care include limits, rest, and honest no’s.',
        steps: 'Name what matters, what is too much, and the clearest kind boundary available now.',
      },
      {
        title: 'Death awareness, gently held',
        cue: 'Remember finitude in a way that clarifies what matters today.',
        steps:
          'Name what is temporary, what deserves care, and one small action that honors the present.',
      },
    ],
  },
} as const
type ContemplativeSkillGroup = keyof typeof contemplativeSkillCollections

const skillPracticePrompts: Record<string, readonly string[]> = {
  'Thought record': [
    'What happened? Describe the situation using observable facts.',
    'What automatic thought or image showed up?',
    'What emotion did you feel, and how intense was it from 0–100?',
    'What evidence seems to support the thought?',
    'What evidence does not fully support it, or what else could be true?',
    'What is a more balanced response you could carry forward?',
  ],
  'Behavioral experiment': [
    'What prediction are you making?',
    'What small, safe experiment could test that prediction?',
    'What would you observe if the prediction came true?',
    'What happened when you tried it?',
    'What did you learn, and what would you test next?',
  ],
  'Cognitive continuum': [
    'What all-or-nothing label or judgment is showing up?',
    'Where would you place the situation from 0–100?',
    'What evidence puts it at that number rather than 0 or 100?',
    'What would move the view five points toward the middle?',
  ],
  'Problem-solving ladder': [
    'What is the specific problem you can influence?',
    'What are three possible options, including one very small one?',
    'Which option best fits your time, energy, and values today?',
    'What is the next visible step, and when will you try it?',
    'What happened, and what will you adjust?',
  ],
  'Worry postponement': [
    'What worry is asking for your attention?',
    'Is there an action you can take now, or is this uncertainty?',
    'When will you give it a short, intentional review window?',
    'What can you return to in the present until then?',
  ],
  'Strengths and exceptions': [
    'When was this problem slightly less intense or more manageable?',
    'What were you doing, noticing, or receiving then?',
    'What part of that condition could you recreate in a small way?',
  ],
  'Alternative explanations': [
    'What is the first story your mind offered?',
    'What is one harsh explanation and one kind explanation?',
    'What explanation best fits the evidence available right now?',
    'What information would you need before deciding?',
  ],
  STOP: [
    'Stop: what impulse or action are you about to take?',
    'Take a step back: what do you notice in your body and surroundings?',
    'Observe: what facts, thoughts, feelings, and urges are present?',
    'Proceed mindfully: what is the next action that protects your values?',
  ],
  'TIP reset': [
    'What emotional intensity are you trying to bring down?',
    'Which safe body-based reset is appropriate for you right now?',
    'What changed in your body after trying it for a short time?',
    'What ordinary next step can you take now?',
  ],
  'Check the facts': [
    'What are the observable facts, without interpretation?',
    'What meaning or prediction did your mind add?',
    'What emotion and urge followed?',
    'Does the emotion fit the facts, and what response fits best?',
  ],
  'Opposite action': [
    'What emotion and urge are present?',
    'Does the emotion fit the facts or is it making the situation larger?',
    'What would the opposite of the unhelpful urge look like?',
    'What small, safe version of that action could you try?',
  ],
  'Self-soothe with the senses': [
    'What feels most activated or tender right now?',
    'What safe sight, sound, scent, taste, and texture could anchor you?',
    'Which sense helped most, and what do you notice now?',
  ],
  'DEAR MAN': [
    'Describe the situation using specific, observable facts.',
    'Express how it affects you without attacking or apologizing for existing.',
    'Assert what you are asking for, then name why it matters.',
    'How can you stay mindful, confident, and open to negotiating?',
  ],
  'Radical acceptance': [
    'What reality is already here, whether you like it or not?',
    'What pain comes from resisting or arguing with that reality?',
    'What part can you accept without approving of it?',
    'What is the next skillful action available to you?',
  ],
  'Three-minute sitting': [
    'What do you notice in your posture, breath, and physical contact points?',
    'What feeling tone seems pleasant, unpleasant, or neutral?',
    'What is the mind doing right now without needing to chase it?',
    'What changes when you make room for the whole experience?',
  ],
  'Impermanence inquiry': [
    'Choose one sensation, mood, or thought to observe.',
    'What is its beginning, middle, and changing edge?',
    'What happens when you stop treating it as fixed?',
  ],
  'Metta / goodwill': [
    'What part of you could use a little less hostility right now?',
    'Write one sincere wish for your own safety or well-being.',
    'If it feels genuine, extend a similar wish to someone else.',
    'What quality would you like to bring into the next interaction?',
  ],
  'The pause before grasping': [
    'What are you wanting, avoiding, or reaching for?',
    'Where do you feel that pull in the body?',
    'How does the texture of the pull change when you watch it?',
    'Would acting on it serve your values right now?',
  ],
  'Wise effort check': [
    'What should you prevent or stop feeding right now?',
    'What could you let go of, even briefly?',
    'What is worth cultivating in this moment?',
    'What is worth maintaining with gentle consistency?',
  ],
  'Compassionate perspective': [
    'What hurts, without minimizing it?',
    'What conditions, history, or context are around the pain?',
    'What agency or choice remains, even if it is very small?',
    'What action could reduce harm for yourself or someone else?',
  ],
  'Everyday ethics': [
    'What are you considering saying or doing?',
    'Is it true enough, useful enough, timely enough, and kind enough?',
    'What would a less harmful version look like?',
    'What will you choose, and what consequence will you watch for?',
  ],
}

type UnifiedMindPractice = {
  id: string
  title: string
  source: string
  category: string
  durationMinutes: number
  summary: string
  invitation: string
  steps: Array<{ title: string; instruction: string }>
  cautions: readonly string[]
  tags: readonly string[]
}

const unifiedMindPractices: UnifiedMindPractice[] = [
  ...fullMindPracticeCatalog.map((practice) => ({
    id: practice.id,
    title: practice.title,
    source: 'Guided practice',
    category: practice.category,
    durationMinutes: practice.durationMinutes,
    summary: practice.summary,
    invitation: practice.invitation,
    steps: practice.steps.map((step) => ({ title: step.title, instruction: step.instruction })),
    cautions: practice.cautions,
    tags: practice.tags,
  })),
  ...Object.entries(contemplativeSkillCollections).flatMap(([group, collection]) =>
    collection.items.map((skill) => {
      const prompts = skillPracticePrompts[skill.title] ?? [
        `What brings you to ${skill.title} today? Describe the situation or signal.`,
        'What do you notice in your body, feelings, thoughts, or surroundings?',
        'What is one small, safe way to practice this skill right now?',
        'What changed, even slightly, and what would you like to remember?',
      ]
      return {
        id: `technique-${group}-${skill.title}`,
        title: skill.title,
        source: group,
        category: group,
        durationMinutes: Math.max(2, Math.ceil(prompts.length * 1.5)),
        summary: skill.cue,
        invitation: skill.steps,
        steps: prompts.map((prompt, index) => ({
          title: `Step ${index + 1}`,
          instruction: prompt,
        })),
        cautions: [],
        tags: [group.toLowerCase(), 'technique'],
      }
    }),
  ),
]

const unifiedMindPracticeCategories = [
  'All practices',
  ...Array.from(new Set(unifiedMindPractices.map((practice) => practice.category))),
]

const skillDoors = [
  { id: 'CBT', title: 'Untangle a thought', cue: 'When a story is running the show.', icon: '↗' },
  {
    id: 'DBT',
    title: 'Get through a hard moment',
    cue: 'When intensity is asking for a skill.',
    icon: '◈',
  },
  {
    id: 'Secular practice',
    title: 'Return to presence',
    cue: 'When you want to notice without fixing.',
    icon: '✦',
  },
] as const

function UnifiedMindPracticeLibrary({
  onSavePractice,
}: {
  onSavePractice: (title: string, answers: string[]) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All practices')
  const [selectedId, setSelectedId] = useState('paced-breathing')
  const [practiceStep, setPracticeStep] = useState(0)
  const [practiceAnswers, setPracticeAnswers] = useState<string[]>([])
  const [practiceSaved, setPracticeSaved] = useState(false)
  const filteredPractices = unifiedMindPractices.filter((practice) => {
    const matchesCategory = category === 'All practices' || practice.category === category
    const searchable =
      `${practice.title} ${practice.summary} ${practice.source} ${practice.tags.join(' ')}`.toLowerCase()
    return matchesCategory && searchable.includes(query.trim().toLowerCase())
  })
  const practice =
    filteredPractices.find((item) => item.id === selectedId) ??
    filteredPractices[0] ??
    unifiedMindPractices[0]
  const prompts = practice.steps
  const currentStep = Math.min(practiceStep, prompts.length - 1)
  const currentAnswer = practiceAnswers[currentStep] ?? ''
  const draftKey = `nxt-mind-practice-draft:${practice.id}`

  useEffect(() => {
    const draft = window.localStorage.getItem(draftKey)
    if (!draft) return
    try {
      const parsed = JSON.parse(draft) as { answers: string[]; step: number }
      setPracticeAnswers(parsed.answers)
      setPracticeStep(Math.min(parsed.step, prompts.length - 1))
    } catch {
      window.localStorage.removeItem(draftKey)
    }
  }, [draftKey, prompts.length])

  function selectPractice(id: string) {
    setSelectedId(id)
    setPracticeStep(0)
    setPracticeAnswers([])
    setPracticeSaved(false)
  }

  function persistDraft(answers: string[], step: number) {
    window.localStorage.setItem(draftKey, JSON.stringify({ answers, step }))
  }

  async function advancePractice() {
    const answers = [...practiceAnswers]
    answers[currentStep] = currentAnswer
    if (currentStep < prompts.length - 1) {
      setPracticeAnswers(answers)
      setPracticeStep((step) => step + 1)
      persistDraft(answers, currentStep + 1)
      return
    }
    if (!answers.some((answer) => answer?.trim())) return
    await onSavePractice(
      practice.title,
      prompts.map(
        (prompt, index) => `${prompt.instruction}\n${answers[index]?.trim() || 'Skipped'}`,
      ),
    )
    setPracticeAnswers(answers)
    setPracticeSaved(true)
    window.localStorage.removeItem(draftKey)
  }

  return (
    <section className="panel contemplative-skills">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Skill library</p>
          <h3>One place for the skills you want to practice.</h3>
        </div>
        <span className="source-pill">Educational · optional</span>
      </div>
      <p className="muted compact-copy">
        Guided attention, regulation, perspective, values, and practical skills now live together
        here. Find a practice, work through it at your own pace, and save it privately if you want.
        These are educational invitations, not therapy, diagnosis, or crisis care.
      </p>
      <div className="unified-practice-controls">
        <label>
          Find a practice
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by need, skill, or name"
          />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {unifiedMindPracticeCategories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="mobile-practice-picker">
          Selected skill
          <select value={practice.id} onChange={(event) => selectPractice(event.target.value)}>
            {filteredPractices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <span className="unified-practice-count">
          {filteredPractices.length} of {unifiedMindPractices.length} practices
        </span>
      </div>
      <div className="skill-library-layout">
        <aside className="skill-library-list-panel">
          <div className="skill-library-list-heading">
            <strong>Browse skills</strong>
            <span>{filteredPractices.length}</span>
          </div>
          <div className="skill-list">
            {filteredPractices.map((item) => (
              <button
                key={item.id}
                className={practice.id === item.id ? 'selected' : ''}
                aria-current={practice.id === item.id ? 'true' : undefined}
                onClick={() => selectPractice(item.id)}
              >
                <span className="skill-card-source">
                  {item.source === 'Guided practice' ? 'Guided' : item.source}
                </span>
                <span className="skill-card-duration">{item.durationMinutes} min</span>
                <strong>{item.title}</strong>
                <small>{item.summary}</small>
              </button>
            ))}
            {!filteredPractices.length && (
              <p className="chart-empty">No practices match that search.</p>
            )}
          </div>
        </aside>
        <article className="skill-detail" aria-live="polite">
          <p className="eyebrow">
            {practice.source} · {practice.durationMinutes} min
          </p>
          <h4>{practice.title}</h4>
          <p>{practice.summary}</p>
          <div className="skill-steps">
            <strong>A useful invitation</strong>
            <span>{practice.invitation}</span>
          </div>
          <div className="skill-practice-card">
            <div className="skill-practice-heading">
              <div>
                <span className="eyebrow">
                  Step {currentStep + 1} of {prompts.length}
                </span>
                <h5>{prompts[currentStep].instruction}</h5>
              </div>
              <span className="skill-practice-progress">
                {Math.round(((currentStep + 1) / prompts.length) * 100)}%
              </span>
            </div>
            <textarea
              rows={4}
              value={currentAnswer}
              onChange={(event) => {
                setPracticeAnswers((answers) => {
                  const next = [...answers]
                  next[currentStep] = event.target.value
                  return next
                })
                setPracticeSaved(false)
              }}
              placeholder="Write what you notice. You can skip a step."
            />
            <div className="button-row skill-practice-actions">
              {currentStep > 0 && (
                <button
                  className="secondary-button"
                  onClick={() => setPracticeStep((step) => step - 1)}
                >
                  Back
                </button>
              )}
              <button className="primary-button" onClick={() => void advancePractice()}>
                {currentStep === prompts.length - 1 ? 'Save practice' : 'Next step'}{' '}
                <ChevronRight size={15} />
              </button>
            </div>
            {practiceSaved && <p className="form-success">Saved in your private Mind record.</p>}
          </div>
          <p className="safety-note">
            {practice.cautions[0] ??
              'If a practice increases distress, stop, orient to the room, and choose ordinary care or professional support.'}
          </p>
        </article>
      </div>
    </section>
  )
}

function ContemplativeSkills({
  onSavePractice,
}: {
  onSavePractice: (title: string, answers: string[]) => Promise<void>
}) {
  return <UnifiedMindPracticeLibrary onSavePractice={onSavePractice} />

  const [group, setGroup] = useState<ContemplativeSkillGroup>('CBT')
  const [index, setIndex] = useState(0)
  const [practiceStep, setPracticeStep] = useState(0)
  const [practiceAnswers, setPracticeAnswers] = useState<string[]>([])
  const [practiceSaved, setPracticeSaved] = useState(false)
  const collection = contemplativeSkillCollections[group]
  const skill = collection.items[index % collection.items.length]
  const prompts = skillPracticePrompts[skill.title] ?? [
    `What brings you to ${skill.title} today? Describe the situation or signal.`,
    'What do you notice in your body, feelings, thoughts, or surroundings?',
    'What is one small, safe way to practice this skill right now?',
    'What changed, even slightly, and what would you like to remember?',
  ]
  const currentAnswer = practiceAnswers[practiceStep] ?? ''
  const skillDraftKey = `nxt-skill-draft:${group}:${skill.title}`
  useEffect(() => {
    const draft = window.localStorage.getItem(skillDraftKey)
    if (!draft) return
    try {
      const parsed = JSON.parse(draft) as { answers: string[]; step: number }
      setPracticeAnswers(parsed.answers)
      setPracticeStep(Math.min(parsed.step, prompts.length - 1))
    } catch {
      window.localStorage.removeItem(skillDraftKey)
    }
  }, [group, prompts.length, skillDraftKey])
  function persistPracticeDraft(answers: string[], step: number) {
    window.localStorage.setItem(skillDraftKey, JSON.stringify({ answers, step }))
  }
  function resetPractice() {
    window.localStorage.removeItem(skillDraftKey)
    setPracticeStep(0)
    setPracticeAnswers([])
    setPracticeSaved(false)
  }
  function selectSkill(nextIndex: number) {
    setIndex(nextIndex)
    resetPractice()
  }
  function setCurrentAnswer(value: string) {
    setPracticeAnswers((answers) => {
      const next = [...answers]
      next[practiceStep] = value
      return next
    })
    setPracticeSaved(false)
  }
  async function advancePractice() {
    const answers = [...practiceAnswers]
    answers[practiceStep] = currentAnswer
    if (practiceStep < prompts.length - 1) {
      setPracticeAnswers(answers)
      setPracticeStep((step) => step + 1)
      persistPracticeDraft(answers, practiceStep + 1)
      return
    }
    if (!answers.some((answer) => answer?.trim())) return
    await onSavePractice(
      skill.title,
      prompts.map(
        (prompt, promptIndex) => `${prompt}\n${answers[promptIndex]?.trim() || 'Skipped'}`,
      ),
    )
    setPracticeAnswers(answers)
    setPracticeSaved(true)
    window.localStorage.removeItem(skillDraftKey)
  }
  return (
    <section className="panel contemplative-skills">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Choose a door</p>
          <h3>Find a practice for the moment you&apos;re in.</h3>
        </div>
        <span className="source-pill">Educational · optional</span>
      </div>
      <p className="muted compact-copy">
        Start with the moment, not a diagnosis. Each door opens a set of structured practices you
        can work through at your own pace. These are educational invitations, not therapy,
        diagnosis, or crisis care.
      </p>
      <div className="skill-door-grid" role="list" aria-label="Choose a practice door">
        {skillDoors.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`skill-door-card${group === item.id ? ' selected' : ''}`}
            aria-pressed={group === item.id}
            onClick={() => {
              setGroup(item.id as ContemplativeSkillGroup)
              setIndex(0)
              resetPractice()
            }}
          >
            <span className="skill-door-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.cue}</small>
            </span>
            <em>{item.id}</em>
          </button>
        ))}
      </div>
      <p className="muted skill-group-description">{collection.description}</p>
      <div className="skill-library-layout">
        <div className="skill-list">
          {collection.items.map((item, itemIndex) => (
            <button
              key={item.title}
              className={index === itemIndex ? 'selected' : ''}
              onClick={() => selectSkill(itemIndex)}
            >
              <span>{String(itemIndex + 1).padStart(2, '0')}</span>
              <strong>{item.title}</strong>
              <small>{item.cue}</small>
            </button>
          ))}
        </div>
        <div className="skill-detail">
          <p className="eyebrow">Guided practice</p>
          <h4>{skill.title}</h4>
          <p>{skill.cue}</p>
          <div className="skill-steps">
            <strong>What this practice is for</strong>
            <span>{skill.steps}</span>
          </div>
          <div className="skill-practice-card">
            <div className="skill-practice-heading">
              <div>
                <span className="eyebrow">
                  Step {practiceStep + 1} of {prompts.length}
                </span>
                <h5>{prompts[practiceStep]}</h5>
              </div>
              <span className="skill-practice-progress">
                {Math.round(((practiceStep + 1) / prompts.length) * 100)}%
              </span>
            </div>
            <textarea
              rows={4}
              value={currentAnswer}
              onChange={(event) => setCurrentAnswer(event.target.value)}
              placeholder="Write what you notice. You can skip a step."
            />
            <div className="button-row skill-practice-actions">
              <button
                className="text-button"
                onClick={() => {
                  setPracticeAnswers((answers) => {
                    const next = [...answers]
                    next[practiceStep] = currentAnswer
                    persistPracticeDraft(next, Math.min(practiceStep + 1, prompts.length - 1))
                    return next
                  })
                  if (practiceStep < prompts.length - 1) setPracticeStep((step) => step + 1)
                }}
              >
                {practiceStep === prompts.length - 1 ? 'Skip and keep draft' : 'Skip this step'}
              </button>
              {practiceStep > 0 && (
                <button
                  className="secondary-button"
                  onClick={() => setPracticeStep((step) => step - 1)}
                >
                  Back
                </button>
              )}
              <button className="primary-button" onClick={() => void advancePractice()}>
                {practiceStep === prompts.length - 1 ? 'Save practice' : 'Next step'}{' '}
                <ChevronRight size={15} />
              </button>
            </div>
            {practiceSaved && <p className="form-success">Saved in your private Mind record.</p>}
          </div>
          <p className="safety-note">
            If a practice increases distress, stop, orient to the room, and choose ordinary care or
            professional support.
          </p>
        </div>
      </div>
    </section>
  )
}

function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (value: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [message, setMessage] = useState('Starting camera…')
  useEffect(() => {
    let cancelled = false
    let frame = 0
    type Detector = { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> }
    type BarcodeWindow = Window & { BarcodeDetector?: new () => Detector }
    async function start() {
      const detectorConstructor = (window as BarcodeWindow).BarcodeDetector
      if (!detectorConstructor || !navigator.mediaDevices?.getUserMedia) {
        setMessage('Camera scanning is not available here. Enter the barcode instead.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) return stream.getTracks().forEach((track) => track.stop())
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        const detector = new detectorConstructor()
        const scan = async () => {
          if (cancelled || !videoRef.current) return
          try {
            const found = await detector.detect(videoRef.current)
            if (found[0]?.rawValue) return onDetected(found[0].rawValue)
          } catch {
            /* Camera frames can be unavailable while the video starts. */
          }
          frame = window.requestAnimationFrame(() => void scan())
        }
        void scan()
      } catch {
        setMessage('Camera permission was not granted. Enter the barcode instead.')
      }
    }
    void start()
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [onDetected])
  return (
    <div className="barcode-scanner">
      <video ref={videoRef} muted playsInline aria-label="Barcode camera preview" />
      <div>
        <span>{message}</span>
        <button className="text-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

function activityCategory(label: string): ActivityCategory {
  const value = label.toLowerCase()
  if (value.includes('walk')) return 'walking'
  if (value.includes('run') || value.includes('jog')) return 'running'
  if (value.includes('cycl') || value.includes('bike')) return 'cycling'
  if (value.includes('swim')) return 'swimming'
  if (value.includes('strength') || value.includes('weight')) return 'strength'
  if (value.includes('yoga') || value.includes('mobility') || value.includes('stretch'))
    return 'mobility'
  if (value.includes('dance') || value.includes('zumba')) return 'dance'
  if (
    value.includes('sport') ||
    value.includes('boxing') ||
    value.includes('kickboxing') ||
    value.includes('martial') ||
    value.includes('karate') ||
    value.includes('taekwondo') ||
    value.includes('jiu-jitsu')
  )
    return 'sports'
  if (value.includes('house')) return 'household'
  if (value.includes('mind')) return 'mind-body'
  return 'other'
}

const QUICK_ACTIVITY_OPTIONS = [
  'Walking',
  'Strength training',
  'Martial arts',
  'Cardio kickboxing',
  'Zumba',
  'Yoga',
]

function ActivityPage({
  exercises,
  onAddExercise,
}: {
  exercises: Awaited<ReturnType<typeof exerciseRepository.list>>
  onAddExercise: (entry: Omit<Parameters<typeof exerciseRepository.add>[0], 'id'>) => Promise<void>
}) {
  const [activityType, setActivityType] = useState('')
  const [duration, setDuration] = useState('30')
  const [intensity, setIntensity] = useState<'easy' | 'moderate' | 'hard'>('moderate')
  const [activityNote, setActivityNote] = useState('')
  const [showTargets, setShowTargets] = useState(false)
  const [ringTargets, setRingTargets] = useState(() => {
    try {
      return JSON.parse(
        window.localStorage.getItem('nxt-activity-ring-targets') ??
          '{"move":30,"intense":20,"steps":8000}',
      ) as { move: number; intense: number; steps: number }
    } catch {
      return { move: 30, intense: 20, steps: 8000 }
    }
  })
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogResults, setCatalogResults] = useState<ActivityCatalogItem[]>([])
  const [catalogState, setCatalogState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [visibleSections, setVisibleSections] = useSectionVisibility('nxt-activity-sections', [
    'entry',
    'rings',
    'insights',
    'history',
  ])
  const todayExercises = exercises.filter((entry) => entry.date === today())
  const todayMinutes = todayExercises.reduce((sum, item) => sum + item.durationMinutes, 0)
  const todayIntenseMinutes = todayExercises
    .filter((item) => item.intensity === 'hard')
    .reduce((sum, item) => sum + item.durationMinutes, 0)
  const todaySteps = todayExercises.reduce((sum, item) => sum + (item.steps ?? 0), 0)
  const sessions: ActivitySession[] = exercises.map((entry) => ({
    id: entry.id,
    occurredAt: `${entry.date}T12:00:00.000Z`,
    category: activityCategory(entry.activityType),
    durationMinutes: entry.durationMinutes,
    intensity: entry.intensity,
    distanceKm: entry.distanceKm,
    steps: entry.steps,
    averageHeartRate: entry.averageHeartRate,
    estimatedCalories: entry.estimatedCalories,
    note: entry.note,
    source: 'manual',
  }))
  const weekly = getWeeklyActivityTotals(sessions, today())
  const balance = getActivityIntensityBalance(sessions, weekly)
  const trend = getRecentActivityTrend(sessions, { referenceDate: today() })
  const suggestion = suggestActivityNextStep({
    weeklyTotals: weekly,
    intensityBalance: balance,
    recentTrend: trend,
  })
  useEffect(() => {
    window.localStorage.setItem('nxt-activity-ring-targets', JSON.stringify(ringTargets))
  }, [ringTargets])
  useEffect(() => {
    const query = catalogQuery.trim()
    if (query.length < 2) {
      setCatalogResults([])
      setCatalogState('idle')
      return
    }

    let cancelled = false
    setCatalogState('loading')
    const timeout = window.setTimeout(() => {
      void searchActivityCatalog(query)
        .then((results) => {
          if (cancelled) return
          setCatalogResults(results)
          setCatalogState('idle')
        })
        .catch(() => {
          if (cancelled) return
          setCatalogResults([])
          setCatalogState('error')
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [catalogQuery])
  async function submit() {
    await onAddExercise({
      date: today(),
      activityType: activityType.trim(),
      durationMinutes: Number(duration),
      intensity,
      note: activityNote.trim() || undefined,
    })
    setActivityType('')
    setCatalogQuery('')
    setDuration('30')
    setActivityNote('')
  }
  function chooseActivity(name: string) {
    setActivityType(name)
    setCatalogQuery('')
    setCatalogResults([])
  }
  return (
    <div className="page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Activity · Today</p>
          <h2>Movement is more than a calorie number.</h2>
          <p className="muted">
            Log the context that helps future analysis: what you did, how long, and how it felt.
          </p>
        </div>
        <div className="activity-summary">
          <div className="activity-total">
            <Activity size={18} />
            <strong>{todayMinutes}</strong>
            <span>minutes</span>
          </div>
          <div className="activity-total activity-steps-total">
            <Footprints size={18} />
            <strong>{todaySteps.toLocaleString()}</strong>
            <span>steps</span>
          </div>
        </div>
      </section>
      <PageFeatureCustomizer
        label="Activity"
        title="Choose the movement signals you want close at hand."
        jumpAriaLabel="Activity sections"
        jumpItems={
          [
            visibleSections.includes('entry') && ['activity-entry', 'Record session'],
            visibleSections.includes('rings') && ['activity-rings', 'Signal meters'],
            visibleSections.includes('insights') && ['activity-insights', 'This week'],
            visibleSections.includes('history') && ['activity-history', 'History'],
          ].filter(Boolean) as Array<[string, string]>
        }
        options={[
          ['entry', 'Record session'],
          ['rings', 'Signal meters'],
          ['insights', 'Weekly insight'],
          ['history', 'History'],
        ]}
        visible={visibleSections}
        onToggle={(key) =>
          setVisibleSections((current) =>
            current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
          )
        }
      />
      {visibleSections.includes('entry') && (
        <section className="panel form-panel" id="activity-entry">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Quick entry</p>
              <h3>Record a session</h3>
            </div>
          </div>
          <div className="activity-entry-layout">
            <div className="activity-search-block">
              <label className="activity-primary-field">
                <span className="activity-field-label">What did you do?</span>
                <span className="activity-search-input">
                  <Search size={17} aria-hidden="true" />
                  <input
                    value={activityType}
                    onChange={(event) => {
                      setActivityType(event.target.value)
                      setCatalogQuery(event.target.value)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        setCatalogQuery('')
                        setCatalogResults([])
                      }
                    }}
                    placeholder="Search walking, martial arts, yoga…"
                    aria-label="Activity"
                    aria-autocomplete="list"
                    aria-controls="activity-catalog-results"
                  />
                </span>
                <small className="field-hint">
                  Search by activity or category. You can also type anything custom.
                </small>
              </label>
              <div className="activity-quick-picks" aria-label="Common activities">
                <span>Try one</span>
                {QUICK_ACTIVITY_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={activityType === option ? 'selected' : ''}
                    onClick={() => chooseActivity(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="activity-details-grid">
              <label className="activity-detail-field activity-duration-field">
                <span>Duration</span>
                <span className="activity-number-input">
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                    aria-label="Duration in minutes"
                  />
                  <small>min</small>
                </span>
              </label>
              <label className="activity-detail-field">
                <span>Intensity</span>
                <select
                  value={intensity}
                  aria-label="Activity intensity"
                  onChange={(event) => setIntensity(event.target.value as typeof intensity)}
                >
                  <option value="easy">Easy</option>
                  <option value="moderate">Moderate</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
            </div>
            <label className="activity-note-field">
              <span>
                Context note <small>Optional</small>
              </span>
              <textarea
                rows={2}
                value={activityNote}
                aria-label="Activity context note"
                onChange={(event) => setActivityNote(event.target.value)}
                placeholder="Anything useful to remember about this session"
              />
            </label>
          </div>
          {catalogState === 'loading' && (
            <p className="provider-note" aria-live="polite">
              Looking through the activity library…
            </p>
          )}
          {catalogState === 'error' && (
            <p className="form-error" role="alert" aria-live="assertive">
              Search is temporarily unavailable. You can still enter any activity by hand.
            </p>
          )}
          {catalogResults.length > 0 && (
            <div
              className="activity-catalog-results"
              id="activity-catalog-results"
              role="listbox"
              aria-label="Activity suggestions"
              aria-live="polite"
            >
              <div className="activity-results-heading">
                <strong>Suggestions</strong>
                <small>Choose one to fill the activity</small>
              </div>
              {catalogResults.map((item) => (
                <button
                  type="button"
                  className="catalog-result"
                  key={item.id}
                  role="option"
                  onClick={() => chooseActivity(item.name)}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.category}
                      {item.source === 'wger' && ' · exercise details'}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
          <p className="provider-note">
            Suggestions follow the{' '}
            <a href={ACTIVITY_CATALOG_SOURCE.href} target="_blank" rel="noreferrer">
              {ACTIVITY_CATALOG_SOURCE.label}
            </a>{' '}
            taxonomy, with class-name aliases like cardio kickboxing, Zumba, and Tae Bo. You can
            always enter your own wording; your logs stay local.
          </p>
          <div className="activity-form-footer">
            <small>
              Saved for today · {activityType.trim() || 'choose an activity'} · {duration || '0'}{' '}
              min
            </small>
            <button
              className="primary-button"
              disabled={Number(duration) <= 0 || !activityType.trim()}
              onClick={submit}
            >
              <Plus size={17} /> Save session
            </button>
          </div>
        </section>
      )}
      {visibleSections.includes('rings') && (
        <section className="panel activity-dashboard" id="activity-rings">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Today’s movement signals</p>
              <h3>Movement signals</h3>
            </div>
            <div className="panel-heading-actions">
              <span className="source-pill">Manual log</span>
              <button className="text-button" onClick={() => setShowTargets((open) => !open)}>
                {showTargets ? 'Hide targets' : 'Customize targets'}
              </button>
            </div>
          </div>
          {showTargets && (
            <div className="activity-target-controls">
              <label>
                Move minutes
                <input
                  type="number"
                  min="1"
                  value={ringTargets.move}
                  onChange={(event) =>
                    setRingTargets((current) => ({
                      ...current,
                      move: Math.max(1, Number(event.target.value)),
                    }))
                  }
                />
              </label>
              <label>
                Intense minutes
                <input
                  type="number"
                  min="1"
                  value={ringTargets.intense}
                  onChange={(event) =>
                    setRingTargets((current) => ({
                      ...current,
                      intense: Math.max(1, Number(event.target.value)),
                    }))
                  }
                />
              </label>
              <label>
                Steps
                <input
                  type="number"
                  min="1"
                  value={ringTargets.steps}
                  onChange={(event) =>
                    setRingTargets((current) => ({
                      ...current,
                      steps: Math.max(1, Number(event.target.value)),
                    }))
                  }
                />
              </label>
            </div>
          )}
          <div className="activity-signal-grid">
            <ActivitySignal
              label="Move minutes"
              value={todayMinutes}
              target={ringTargets.move}
              unit="min"
              color="blue"
            />
            <ActivitySignal
              label="Intense activity"
              value={todayIntenseMinutes}
              target={ringTargets.intense}
              unit="min"
              color="gold"
            />
            <ActivitySignal
              label="Steps"
              value={todaySteps}
              target={ringTargets.steps}
              unit="steps"
              color="green"
            />
          </div>
          <ActivityWeekChart exercises={exercises} />
        </section>
      )}
      {visibleSections.includes('insights') && (
        <section className="panel activity-insight-panel" id="activity-insights">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">This week</p>
              <h3>A wider view of movement.</h3>
            </div>
            <span className="source-pill">Context, not a target</span>
          </div>
          <div className="three-col activity-insight-grid">
            <div>
              <strong>{Math.round(weekly.totalMinutes)} min</strong>
              <span>{weekly.activeDays} active days</span>
            </div>
            <div>
              <strong>{Math.round(balance.easyMinutes)} easy</strong>
              <span>
                {Math.round(balance.moderateMinutes)} moderate · {Math.round(balance.hardMinutes)}{' '}
                hard
              </span>
            </div>
            <div>
              <strong>{trend.direction.replaceAll('-', ' ')}</strong>
              <span>{suggestion.message}</span>
            </div>
          </div>
        </section>
      )}
      {visibleSections.includes('history') && (
        <section className="panel table-panel" id="activity-history">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Today</p>
              <h3>
                {todayExercises.length
                  ? `${todayExercises.length} session${todayExercises.length === 1 ? '' : 's'}`
                  : 'No activity logged'}
              </h3>
            </div>
            <span className="source-pill">
              <Check size={13} /> Manual
            </span>
          </div>
          {todayExercises.length === 0 ? (
            <EmptyState text="Your activity history will become useful context for the adaptive model later." />
          ) : (
            <div className="entry-list">
              {todayExercises.map((entry) => (
                <div className="entry-row" key={entry.id}>
                  <div className="entry-date">
                    <strong>{entry.activityType}</strong>
                    <span>
                      {entry.durationMinutes} minutes · {entry.intensity}
                    </span>
                  </div>
                  <span className="activity-entry-intensity">{entry.intensity}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function ActivitySignal({
  label,
  value,
  target,
  unit,
  color,
  className = '',
  style,
}: {
  label: string
  value: number
  target: number
  unit: string
  color: string
  className?: string
  style?: CSSProperties
}) {
  const percentage = Math.min(100, Math.round((value / target) * 100))
  const filledSegments = Math.max(0, Math.min(8, Math.ceil(percentage / 12.5)))
  return (
    <div
      className={`activity-signal-card signal-${color} ${className}`}
      aria-label={`${label}: ${value.toLocaleString()} ${unit}, ${percentage}% of a reference target`}
      style={style}
    >
      <div
        className="activity-signal-visual"
        style={{ '--signal-progress': `${percentage}%` } as CSSProperties}
      >
        <div className="activity-signal-topline">
          <span className="activity-signal-mark" aria-hidden="true" />
          <small>{percentage}% target</small>
        </div>
        <div className="activity-signal-segments" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <span
              className={index < filledSegments ? 'is-filled' : ''}
              key={index}
              style={{ '--segment-height': `${18 + index * 4}px` } as CSSProperties}
            />
          ))}
        </div>
        <div className="activity-signal-value">
          <strong>{value.toLocaleString()}</strong>
          <span>{unit}</span>
        </div>
      </div>
      <strong>{label}</strong>
      <span>{percentage}% of a reference target</span>
    </div>
  )
}

function ActivityWeekChart({
  exercises,
}: {
  exercises: Awaited<ReturnType<typeof exerciseRepository.list>>
}) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    const minutes = exercises
      .filter((entry) => entry.date === key)
      .reduce((sum, entry) => sum + entry.durationMinutes, 0)
    return { key, label: date.toLocaleDateString([], { weekday: 'short' }), minutes }
  })
  const max = Math.max(30, ...days.map((day) => day.minutes))
  return (
    <div className="activity-week-chart">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Last seven days</p>
          <h4>Move minutes</h4>
        </div>
        <span className="muted">Reference line: 30 min</span>
      </div>
      <div className="activity-bars" aria-label="Move minutes over the last seven days">
        {days.map((day) => (
          <div className="activity-bar-column" key={day.key}>
            <div className="activity-bar-track">
              <span style={{ height: `${Math.max(4, (day.minutes / max) * 100)}%` }} />
            </div>
            <strong>{day.minutes}</strong>
            <small>{day.label}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProfilePage({
  profile,
  goals,
  integrationConnections,
  onNavigate,
  onToggleGoal,
  onSaveProfile,
}: {
  profile: Profile
  goals: Goal[]
  integrationConnections: IntegrationConnection[]
  onNavigate: (screen: Screen) => void
  onToggleGoal: (goal: Goal) => Promise<void>
  onSaveProfile: (changes: Partial<Profile>) => Promise<void>
}) {
  const displayedAge = effectiveProfileAge(profile)
  const [editing, setEditing] = useState(false)
  const [showIntentions, setShowIntentions] = useState(false)
  const [showAllProfileIntentions, setShowAllProfileIntentions] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const [shareFields, setShareFields] = useState({ focus: true, intentions: false, bio: false })
  const [visibleSections, setVisibleSections] = useSectionVisibility('nxt-profile-sections', [
    'context',
    'focus',
    'sharing',
    'connections',
  ])
  const activeGoals = goals.filter((goal) => goal.active)
  const focusAreas = profile.todayFocus ?? ['body', 'mind', 'behavior']
  const supportStyle = profile.supportStyle ?? 'gentle'
  const displayedBio = profile.bio?.trim() || starterProfileBio
  const pronounLabel = profilePronounLabel(profile)
  useEffect(() => {
    setVisibleSections((current) =>
      current.includes('connections') ? current : [...current, 'connections'],
    )
  }, [setVisibleSections])
  const supportStyleLabels: Record<SupportStyle, string> = {
    gentle: 'Gentle prompts',
    direct: 'Clear prompts',
    reflective: 'Reflective prompts',
  }
  const focusLabels: Record<HealthDomain, { label: string; cue: string; icon: string }> = {
    body: { label: 'Body', cue: 'Measurements and physical signals', icon: '◉' },
    mind: { label: 'Mind', cue: 'Presence, reflection, and training', icon: '◌' },
    behavior: { label: 'Behavior', cue: 'Habits, food, and movement', icon: '↗' },
    spiritual: { label: 'Meaning', cue: 'Values and contemplative practice', icon: '✦' },
    environment: { label: 'Environment', cue: 'The context around your health', icon: '⌂' },
  }
  const profileCompletion = [
    profile.displayName,
    profile.headline,
    profile.age,
    profile.birthDate,
    profile.heightCm,
    profile.sexAssignedAtBirth,
    profile.genderIdentity,
    profile.pronouns,
    profile.todayFocus?.length,
    displayedBio,
    profile.occupation,
    profile.location,
    profile.supportStyle,
  ].filter(Boolean).length
  const completionPercent = Math.round((profileCompletion / 13) * 100)
  const shareText = [
    shareFields.bio ? `About me: ${displayedBio}` : '',
    shareFields.focus
      ? `My whole-health focus is ${focusAreas.map((area) => focusLabels[area].label).join(', ')}.`
      : '',
    shareFields.intentions && activeGoals.length
      ? `I am exploring: ${activeGoals.map((goal) => goal.label).join(', ')}.`
      : '',
    shareFields.focus || shareFields.intentions || shareFields.bio
      ? 'I am building a clearer picture over time.'
      : '',
  ]
    .filter(Boolean)
    .join(' ')
  const hasShareSelection = Boolean(shareText)

  async function copyShareSummary() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(shareText)
      setShareStatus('Summary copied. Nothing was shared.')
    } catch {
      setShareStatus('Copy was unavailable. Nothing was shared.')
    }
  }

  async function useDeviceShare() {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My whole-health focus', text: shareText })
        setShareStatus('Ready to share from your device.')
        return
      }
      await copyShareSummary()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setShareStatus('Sharing cancelled. Nothing was shared.')
      } else {
        setShareStatus('Device sharing was unavailable. Nothing was shared.')
      }
    }
  }

  function openSocialComposer(channel: 'x' | 'facebook') {
    const encoded = encodeURIComponent(shareText)
    const url =
      channel === 'x'
        ? `https://twitter.com/intent/tweet?text=${encoded}`
        : `https://www.facebook.com/sharer/sharer.php?quote=${encoded}`
    window.open(url, '_blank', 'noopener,noreferrer')
    setShareStatus(`Opened ${channel === 'x' ? 'X' : 'Facebook'} with the summary ready.`)
  }

  return (
    <div className="page profile-page">
      <PageFeatureCustomizer
        label="Profile"
        title="Keep personal context and sharing controls in view."
        jumpItems={
          [
            visibleSections.includes('context') && ['profile-context', 'Context'],
            visibleSections.includes('context') && ['profile-intentions', 'Intentions'],
            visibleSections.includes('focus') && ['profile-focus', 'Focus'],
            visibleSections.includes('sharing') && ['profile-sharing', 'Sharing'],
            visibleSections.includes('connections') && ['profile-connections', 'Connections'],
          ].filter(Boolean) as Array<[string, string]>
        }
        options={[
          ['context', 'Personal context'],
          ['focus', 'Focus map'],
          ['sharing', 'Sharing'],
          ['connections', 'Connections'],
        ]}
        visible={visibleSections}
        onToggle={(key) =>
          setVisibleSections((current) =>
            current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
          )
        }
      />
      <section className="profile-identity-card">
        <div className="profile-identity-main">
          <div className="profile-identity-avatar" aria-label="Profile picture">
            {profile.avatarDataUrl ? (
              <img src={profile.avatarDataUrl} alt={`${profile.displayName}'s profile`} />
            ) : (
              <UserRound size={30} aria-hidden="true" />
            )}
            <span>{profile.displayName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="profile-identity-copy">
            <p className="eyebrow">Your profile · private by default</p>
            <h2>{profile.displayName}</h2>
            <p className="profile-headline">
              {profile.headline || 'Building a steadier, more connected life.'}
            </p>
            <div className="profile-identity-meta">
              <span>{pronounLabel}</span>
              {profile.occupation && <span>{profile.occupation}</span>}
              {profile.location && <span>{profile.location}</span>}
              <span>Local only</span>
            </div>
          </div>
          <div className="profile-identity-actions">
            <button className="primary-button" onClick={() => setEditing(true)}>
              Edit profile
            </button>
            <small>
              Updated{' '}
              {new Date(profile.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </small>
          </div>
        </div>
        <div className="profile-bio-card">
          <span className="profile-bio-mark">“</span>
          <div>
            <span className="eyebrow">A little about you</span>
            <p>{displayedBio}</p>
          </div>
        </div>
        <div
          className="profile-completion"
          aria-label={`Personalization setup: ${completionPercent}% available`}
        >
          <span>Personalization setup</span>
          <div>
            <i style={{ width: `${completionPercent}%` }} />
          </div>
          <strong>{completionPercent}%</strong>
        </div>
      </section>
      <section className="profile-snapshot-strip profile-snapshot-strip-redesign">
        <div>
          <span>My Day focus</span>
          <strong>{focusAreas.length}</strong>
          <small>areas chosen by you</small>
        </div>
        <div>
          <span>Active intentions</span>
          <strong>{activeGoals.length}</strong>
          <small>shaping suggestions</small>
        </div>
        <div>
          <span>Personal context</span>
          <strong>{displayedAge !== undefined ? `${displayedAge}` : '—'}</strong>
          <small>
            {displayedAge === undefined
              ? 'age not set'
              : profile.age !== undefined
                ? 'years old'
                : 'years · calculated from birth date'}
          </small>
        </div>
        <div>
          <span>Data boundary</span>
          <strong>Local</strong>
          <small>nothing synced by default</small>
        </div>
      </section>
      {visibleSections.includes('context') && (
        <section className="profile-page-grid profile-context-layout" id="profile-context">
          <section className="panel profile-editor-panel profile-context-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Personal context</p>
                <h3>How should N//XT understand you?</h3>
              </div>
              <span className="source-pill">Private</span>
            </div>
            <p className="profile-section-lede">
              These details tune the language, starting points, and suggestions you see across the
              workspace. You are always in control of what gets recorded.
            </p>
            {editing ? (
              <ProfileEditor
                profile={profile}
                onSave={async (changes) => {
                  await onSaveProfile(changes)
                  setEditing(false)
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <div className="profile-context-readout">
                <div>
                  <span>Name</span>
                  <strong>{profile.displayName}</strong>
                </div>
                <div>
                  <span>Headline</span>
                  <strong>{profile.headline || 'Not set'}</strong>
                </div>
                <div>
                  <span>Work or role</span>
                  <strong>{profile.occupation || 'Not set'}</strong>
                </div>
                <div>
                  <span>Location</span>
                  <strong>{profile.location || 'Not set'}</strong>
                </div>
                <div>
                  <span>Height</span>
                  <strong>{formatHeight(profile.heightCm, profile.unitSystem)}</strong>
                </div>
                <div>
                  <span>Birthday</span>
                  <strong>
                    {profile.birthDate
                      ? new Date(`${profile.birthDate}T12:00:00`).toLocaleDateString(undefined, {
                          dateStyle: 'medium',
                        })
                      : 'Not set'}
                  </strong>
                </div>
                <div>
                  <span>Activity baseline</span>
                  <strong>{profile.activityLevel.replaceAll('-', ' ')}</strong>
                </div>
                <div>
                  <span>Preferred movement</span>
                  <strong>{profile.preferredMovement || 'Not set'}</strong>
                </div>
                <div>
                  <span>Sleep context</span>
                  <strong>{profile.sleepPreference || 'Not set'}</strong>
                </div>
                <div>
                  <span>Pronouns</span>
                  <strong>{pronounLabel}</strong>
                </div>
                <div>
                  <span>Sex assigned at birth</span>
                  <strong>{profile.sexAssignedAtBirth?.replaceAll('-', ' ') || 'Not set'}</strong>
                </div>
                <div>
                  <span>Identity</span>
                  <strong>{profile.genderIdentity?.replaceAll('-', ' ') || 'Not set'}</strong>
                </div>
                <div>
                  <span>Equation preference</span>
                  <strong>{profile.sexForEquation.replaceAll('-', ' ')}</strong>
                </div>
                <div>
                  <span>Nutrition context</span>
                  <strong>{profile.preferredNutritionPattern || 'Not set'}</strong>
                </div>
                <div>
                  <span>Time zone</span>
                  <strong>{profile.timezone || 'Not set'}</strong>
                </div>
                <div>
                  <span>Data detail</span>
                  <strong>
                    {profile.dataDisplay === 'detailed' ? 'Detailed context' : 'Simple summaries'}
                  </strong>
                </div>
                <div className="profile-context-wide">
                  <span>Bio</span>
                  <strong>{displayedBio}</strong>
                </div>
                <button className="secondary-button" onClick={() => setEditing(true)}>
                  Edit profile
                </button>
              </div>
            )}
          </section>
          <section className="panel profile-summary-panel profile-intention-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Your direction</p>
                <h3>What is shaping this season?</h3>
              </div>
              <Target size={20} />
            </div>
            <p className="profile-section-lede">
              Active intentions keep the workspace relevant without turning your health into a
              score.
            </p>
            <div className="profile-fact-list">
              <div>
                <span>Units</span>
                <strong>{profile.unitSystem === 'imperial' ? 'lb / ft' : 'kg / cm'}</strong>
              </div>
              <div>
                <span>Movement baseline</span>
                <strong>{profile.activityLevel.replaceAll('-', ' ')}</strong>
              </div>
              <div>
                <span>Prompt style</span>
                <strong>{supportStyleLabels[supportStyle]}</strong>
              </div>
              <div>
                <span>My Day focus</span>
                <strong>{focusAreas.length} areas</strong>
              </div>
              <div>
                <span>Height</span>
                <strong>
                  {profile.heightCm ? formatHeight(profile.heightCm, profile.unitSystem) : '—'}
                </strong>
              </div>
              <div>
                <span>Pronouns</span>
                <strong>{pronounLabel}</strong>
              </div>
            </div>
            <div className="profile-goals-heading">
              <span>Active intentions</span>
              <small>{activeGoals.length}</small>
            </div>
            <div className="profile-goal-list profile-goal-list-compact" id="profile-intentions">
              {activeGoals.length === 0 && (
                <p className="empty-inline">
                  No active intentions yet. Use Edit intentions to add one.
                </p>
              )}
              {activeGoals
                .slice(0, showAllProfileIntentions ? activeGoals.length : 4)
                .map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => onNavigate(goalDestination(goal))}
                    title={`Open ${goalDestination(goal)}`}
                  >
                    <span>{goal.label}</span>
                    <small>
                      {goalDestination(goal)} ·{' '}
                      {goal.why ??
                        goalOptions.find((option) => option.kind === goal.kind)?.description ??
                        'A focus you chose for this season.'}
                    </small>
                    <ChevronRight size={15} />
                  </button>
                ))}
            </div>
            {activeGoals.length > 4 && (
              <button
                className="text-button profile-intentions-toggle"
                onClick={() => setShowAllProfileIntentions((value) => !value)}
              >
                {showAllProfileIntentions
                  ? 'Show less'
                  : `Show all ${activeGoals.length} intentions`}{' '}
                <ChevronRight size={15} />
              </button>
            )}
            <button className="text-button" onClick={() => setShowIntentions((value) => !value)}>
              {showIntentions ? 'Hide intention editor' : 'Edit intentions'}{' '}
              <ChevronRight size={15} />
            </button>
            {showIntentions && (
              <div className="profile-intention-editor" id="profile-intentions-editor">
                {goals.map((goal) => (
                  <button
                    key={goal.id}
                    aria-pressed={goal.active}
                    onClick={() => void onToggleGoal(goal)}
                  >
                    <span className={goal.active ? 'intention-status active' : 'intention-status'}>
                      {goal.active ? 'On' : 'Off'}
                    </span>
                    <span>{goal.label}</span>
                    <small>
                      {goal.active ? 'Remove' : 'Add'} ·{' '}
                      {goal.domains
                        ?.map((domain) => domain[0].toUpperCase() + domain.slice(1))
                        .join(' · ') || 'Whole health'}
                    </small>
                  </button>
                ))}
              </div>
            )}
            <p className="muted compact-copy">
              Intentions shape suggestions; they never become a score or a judgment.
            </p>
          </section>
        </section>
      )}
      <section className="profile-lower-grid">
        {visibleSections.includes('focus') && (
          <section className="panel profile-focus-panel" id="profile-focus">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Your focus map</p>
                <h3>What deserves attention right now?</h3>
              </div>
              <Target size={20} />
            </div>
            <div className="profile-focus-cards">
              {focusAreas.map((area) => (
                <button
                  className="profile-focus-card"
                  key={area}
                  onClick={() =>
                    onNavigate(
                      area === 'body'
                        ? 'weight'
                        : area === 'behavior'
                          ? 'activity'
                          : area === 'spiritual'
                            ? 'mind'
                            : area === 'environment'
                              ? 'patterns'
                              : 'mind',
                    )
                  }
                >
                  <span>{focusLabels[area].icon}</span>
                  <div>
                    <strong>{focusLabels[area].label}</strong>
                    <small>{focusLabels[area].cue}</small>
                  </div>
                </button>
              ))}
            </div>
            <p className="muted compact-copy">
              Change these in Edit profile when your season changes. You can choose as many or as
              few as fit.
            </p>
          </section>
        )}
        {visibleSections.includes('sharing') && (
          <section className="panel profile-sharing-panel" id="profile-sharing">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Optional sharing</p>
                <h3>Share a small piece of progress.</h3>
              </div>
              <Share2 size={20} />
            </div>
            <p className="muted compact-copy">
              No accounts are connected. Choose exactly what leaves this device, when you choose to
              share it.
            </p>
            <div className="share-scope-picker">
              <label>
                <input
                  type="checkbox"
                  checked={shareFields.focus}
                  onChange={() =>
                    setShareFields((current) => ({ ...current, focus: !current.focus }))
                  }
                />{' '}
                Focus areas
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={shareFields.intentions}
                  onChange={() =>
                    setShareFields((current) => ({ ...current, intentions: !current.intentions }))
                  }
                />{' '}
                Active intentions
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={shareFields.bio}
                  onChange={() => setShareFields((current) => ({ ...current, bio: !current.bio }))}
                />{' '}
                Bio
              </label>
            </div>
            <div className="share-preview">
              <span>Preview</span>
              <p>{shareText}</p>
            </div>
            {!hasShareSelection && (
              <p className="form-hint">Choose at least one field to enable sharing.</p>
            )}
            <div className="social-channel-grid">
              <button disabled={!hasShareSelection} onClick={() => openSocialComposer('x')}>
                <strong>𝕏</strong>
                <span>Open X composer</span>
              </button>
              <button disabled={!hasShareSelection} onClick={() => openSocialComposer('facebook')}>
                <strong>f</strong>
                <span>Open Facebook share</span>
              </button>
              <button disabled={!hasShareSelection} onClick={() => void useDeviceShare()}>
                <strong>◎</strong>
                <span>Share from device</span>
              </button>
            </div>
            <button
              className="text-button"
              disabled={!hasShareSelection}
              onClick={() => void copyShareSummary()}
            >
              <Copy size={15} /> Copy summary (may be visible to other apps)
            </button>
            {shareStatus && <p className="form-success">{shareStatus}</p>}
          </section>
        )}
      </section>
      {visibleSections.includes('connections') && (
        <section className="panel profile-connections-panel" id="profile-connections">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Connections</p>
              <h3>Bring your records together, carefully.</h3>
            </div>
            <span className="source-pill">Truth-first</span>
          </div>
          <p className="muted compact-copy">
            Nothing is marked connected until this device completes a real permission or account
            check. Native stores stay on their device; cloud providers require server configuration.
          </p>
          <div className="integration-card-grid">
            {providerCapabilities.map((capability) => {
              const connection = integrationConnections.find(
                (candidate) => candidate.provider === capability.provider,
              )
              const status = connection?.status ?? capability.status
              const statusLabel = status.replaceAll('-', ' ')
              const canImport = capability.provider === 'file-import'
              return (
                <article
                  className={`integration-card integration-status-${status}`}
                  key={capability.provider}
                >
                  <div className="integration-card-heading">
                    <div>
                      <p className="eyebrow">
                        {capability.delivery} · {capability.auth}
                      </p>
                      <h4>{capability.label}</h4>
                    </div>
                    <span className="integration-status-pill">{statusLabel}</span>
                  </div>
                  <p>{capability.notes}</p>
                  <small>Reads: {capability.reads.join(' · ')}</small>
                  <div className="integration-card-actions">
                    {canImport ? (
                      <span className="integration-status-note">
                        Use Data tools to import a file
                      </span>
                    ) : (
                      <span className="integration-status-note">
                        {status === 'connected'
                          ? 'Verified connection'
                          : 'Connection not available yet'}
                      </span>
                    )}
                    <a href={capability.officialDocsUrl} target="_blank" rel="noreferrer">
                      Official setup <ChevronRight size={15} />
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function MedicationsPage({
  medications,
  medicationLogs,
  onSaveMedication,
  onRemoveMedication,
  onLogMedication,
}: {
  medications: MedicationSchedule[]
  medicationLogs: MedicationLog[]
  onSaveMedication: (entry: MedicationSchedule) => Promise<void>
  onRemoveMedication: (id: string) => Promise<void>
  onLogMedication: (entry: Omit<MedicationLog, 'id'>) => Promise<void>
}) {
  const [selectedLookup, setSelectedLookup] = useState<MedicationLookupResult>()
  const [visibleSections, setVisibleSections] = useSectionVisibility('nxt-medication-sections', [
    'overview',
    'tracker',
    'lookup',
    'safety',
  ])

  return (
    <div className="page settings-page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Body · Medication</p>
          <h2>Medication, with context.</h2>
          <p className="muted">
            Keep schedules and effects in one place. Reference lookups are optional, read-only, and
            send only the term you search for.
          </p>
        </div>
        <div className="medication-page-mark" aria-hidden="true">
          <Pill size={26} />
        </div>
      </section>
      <PageFeatureCustomizer
        label="Medications"
        title="Keep the parts of medication care that fit your routine in view."
        jumpAriaLabel="Medication sections"
        jumpItems={
          [
            visibleSections.includes('overview') && ['medication-overview', 'Overview'],
            visibleSections.includes('tracker') && ['medications', 'Schedule and doses'],
            visibleSections.includes('lookup') && ['medication-lookup', 'Information lookup'],
            visibleSections.includes('safety') && ['medication-safety', 'Safety notes'],
          ].filter(Boolean) as Array<[string, string]>
        }
        options={[
          ['overview', 'Overview'],
          ['tracker', 'Schedule and doses'],
          ['lookup', 'Information lookup'],
          ['safety', 'Safety notes'],
        ]}
        visible={visibleSections}
        onToggle={(key) =>
          setVisibleSections((current) =>
            current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
          )
        }
      />
      {visibleSections.includes('overview') && (
        <section className="two-col medication-overview-grid" id="medication-overview">
          <section className="panel medication-intro-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Your record</p>
                <h3>Schedules are yours to define.</h3>
              </div>
              <span className="source-pill">Local only</span>
            </div>
            <p className="muted">
              Add prescriptions, over-the-counter medicines, supplements, or as-needed treatments.
              The tracker is for remembering and observing—not for changing a treatment plan.
            </p>
          </section>
          <section className="panel medication-intro-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Across your health</p>
                <h3>Notice context over time.</h3>
              </div>
              <HeartPulse size={19} />
            </div>
            <p className="muted">
              Medication observations can sit alongside sleep, mood, symptoms, food, and movement in
              Patterns without turning a single entry into a conclusion.
            </p>
          </section>
        </section>
      )}
      {visibleSections.includes('tracker') && (
        <MedicationTracker
          medications={medications}
          medicationLogs={medicationLogs}
          prefill={selectedLookup}
          onPrefillConsumed={() => setSelectedLookup(undefined)}
          onSave={onSaveMedication}
          onRemove={onRemoveMedication}
          onLog={onLogMedication}
        />
      )}
      {visibleSections.includes('lookup') && (
        <MedicationLookupPanel
          selected={selectedLookup}
          onSelect={(result) => {
            setSelectedLookup(result)
            if (!visibleSections.includes('tracker'))
              setVisibleSections((current) => [...current, 'tracker'])
          }}
          onCancel={() => setSelectedLookup(undefined)}
        />
      )}
      {visibleSections.includes('safety') && (
        <MedicationInteractionPanel medications={medications} />
      )}
    </div>
  )
}

function MedicationInteractionPanel({ medications }: { medications: MedicationSchedule[] }) {
  const [providerAllowed, setProviderAllowed] = useState(true)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<MedicationInteractionResult>()
  const provider = new OpenFdaMedicationInteractionProvider()
  const medicationByRxcui = new Map(
    medications
      .map((medication) => [medication.reference?.externalId, medication.name] as const)
      .filter(([rxcui]) => Boolean(rxcui)),
  )
  const checkableMedications = medications.filter((medication) =>
    /^\d+$/.test(medication.reference?.externalId ?? ''),
  )

  useEffect(() => {
    void consentRepository.list().then((preferences) => {
      const preference = preferences.find((item) => item.scope === 'provider-lookups')
      setProviderAllowed(preference?.granted ?? true)
    })
  }, [])

  async function checkInteractions() {
    if (!providerAllowed) {
      setStatus('error')
      setMessage('Provider lookups are off. Enable them in Settings before checking labels.')
      return
    }
    const rxcuis = checkableMedications
      .map((medication) => medication.reference?.externalId)
      .filter((rxcui): rxcui is string => Boolean(rxcui))
    if (rxcuis.length === 0) {
      setStatus('error')
      setMessage(
        'Select a medication from the RxNorm lookup before checking its interaction label.',
      )
      return
    }
    setStatus('loading')
    setMessage('')
    try {
      setResult(await provider.check(rxcuis))
      setStatus('idle')
    } catch {
      setStatus('error')
      setMessage('The FDA label service could not be reached. Your local record is unchanged.')
    }
  }

  return (
    <section className="panel medication-safety-panel" id="medication-safety">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Safety check</p>
          <h3>Review interaction language from FDA labels.</h3>
        </div>
        <span className="source-pill">FDA openFDA</span>
      </div>
      <p className="muted">
        This checks the current FDA label evidence for medications you matched through RxNorm. It is
        not a complete pairwise interaction database, and an empty result does not prove that no
        interaction exists.
      </p>
      <div className="medication-checker-toolbar">
        <div>
          <strong>
            {checkableMedications.length} medication{checkableMedications.length === 1 ? '' : 's'}{' '}
            ready
          </strong>
          <small>{medications.length - checkableMedications.length} need an RxNorm match</small>
        </div>
        <button
          className="secondary-button"
          onClick={() => void checkInteractions()}
          disabled={status === 'loading' || checkableMedications.length === 0}
        >
          {status === 'loading' ? 'Checking labels…' : 'Check current medications'}
        </button>
      </div>
      {message && (
        <p className="form-error" role="alert" aria-live="polite">
          {message}
        </p>
      )}
      {result && (
        <div className="medication-interaction-results">
          {result.interactions.length > 0 ? (
            result.interactions.map((interaction, index) => (
              <article
                className="medication-interaction-result"
                key={`${interaction.rxcui}-${index}`}
              >
                <div>
                  <strong>
                    {medicationByRxcui.get(interaction.rxcui) ?? `RxCUI ${interaction.rxcui}`}
                  </strong>
                  <small>{interaction.labelName ?? 'FDA medication label'}</small>
                </div>
                <p>{interaction.description}</p>
                <div className="medication-interaction-meta">
                  <span>
                    {interaction.section === 'drug_interactions_table'
                      ? 'Label table'
                      : 'Label text'}
                  </span>
                  {interaction.effectiveTime && <span>Updated {interaction.effectiveTime}</span>}
                  <a href={interaction.sourceUrl} target="_blank" rel="noreferrer">
                    View source
                  </a>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">
              No interaction language was returned in the matched labels. This is not a clean bill
              of health.
            </p>
          )}
          {result.unresolvedRxcuis.length > 0 && (
            <p className="muted compact-copy">
              Could not match RxCUI{result.unresolvedRxcuis.length === 1 ? '' : 's'}:{' '}
              {result.unresolvedRxcuis.join(', ')}. Check the medication name and select a reference
              match.
            </p>
          )}
          <p className="medication-checker-disclaimer">{result.source.limitation}</p>
        </div>
      )}
      <div className="medication-safety-grid">
        <div>
          <strong>It can show</strong>
          <span>Interaction wording, label source, and label update date.</span>
        </div>
        <div>
          <strong>It cannot do</strong>
          <span>Diagnose, prescribe, or tell you to start, stop, or change a medication.</span>
        </div>
      </div>
    </section>
  )
}

function MedicationLookupPanel({
  selected,
  onSelect,
  onCancel,
}: {
  selected?: MedicationLookupResult
  onSelect: (result: MedicationLookupResult) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MedicationLookupResult[]>([])
  const [providerAllowed, setProviderAllowed] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const provider = new RxNormProvider()

  useEffect(() => {
    void consentRepository.list().then((preferences) => {
      const preference = preferences.find((item) => item.scope === 'provider-lookups')
      setProviderAllowed(preference?.granted ?? true)
    })
  }, [])

  async function search() {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return
    if (!providerAllowed) {
      setStatus('error')
      setMessage('Provider lookups are off. Enable them in Settings before searching RxNorm.')
      return
    }
    setStatus('loading')
    setMessage('')
    try {
      const nextResults = await provider.search(normalizedQuery)
      setResults(nextResults)
      setStatus('idle')
      if (nextResults.length === 0) setMessage('No matching medication concepts were found.')
    } catch {
      setStatus('error')
      setMessage('The medication reference could not be reached. Your local record is unchanged.')
    }
  }

  function clearSearch() {
    setQuery('')
    setResults([])
    setStatus('idle')
    setMessage('')
    onCancel()
  }

  return (
    <section className="panel medication-lookup-panel" id="medication-lookup">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Information lookup</p>
          <h3>Find a medication reference.</h3>
        </div>
        <span className="source-pill">NIH RxNorm</span>
      </div>
      <p className="muted compact-copy">
        Search the national medication vocabulary to reduce spelling ambiguity. Results are
        references, not personal medical advice, and are never saved until you add a schedule.
      </p>
      <small className="medication-source-attribution">
        Uses publicly available data from the U.S. National Library of Medicine (NLM), National
        Institutes of Health (NIH), and Department of Health and Human Services. NLM does not
        endorse or recommend this product.
      </small>
      <div className="medication-lookup-form">
        <label className="medication-search-field">
          Medication name
          <span className="medication-search-input">
            <input
              value={query}
              aria-label="Medication name"
              onChange={(event) => {
                setQuery(event.target.value)
                if (!event.target.value.trim()) {
                  setResults([])
                  setMessage('')
                  setStatus('idle')
                  onCancel()
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void search()
              }}
              placeholder="Example: sertraline or magnesium"
            />
            {(query || selected) && (
              <button
                type="button"
                className="icon-button medication-search-clear"
                aria-label="Clear medication search"
                onClick={clearSearch}
              >
                <X size={15} />
              </button>
            )}
          </span>
        </label>
        <button
          className="secondary-button"
          onClick={() => void search()}
          disabled={status === 'loading'}
        >
          <Search size={16} /> {status === 'loading' ? 'Searching…' : 'Search reference'}
        </button>
      </div>
      {!providerAllowed && (
        <p className="muted compact-copy">
          Lookups are off for this workspace. Turn on <strong>Provider lookups</strong> in Settings
          if you want to send a search term to NIH RxNorm.
        </p>
      )}
      {message && (
        <p
          className={status === 'error' ? 'form-error' : 'muted'}
          role={status === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message}
        </p>
      )}
      {selected && (
        <p className="form-success">
          Selected {selected.name}. It is ready to use in the schedule form below.
        </p>
      )}
      {results.length > 0 && (
        <div className="medication-lookup-results" aria-label="Medication reference results">
          {results.map((result) => (
            <button
              className={`medication-lookup-result${selected?.id === result.id ? ' selected' : ''}`}
              key={result.id}
              onClick={() => {
                onSelect(result)
                setQuery('')
                setResults([])
                setMessage('')
                setStatus('idle')
              }}
            >
              <span>
                <strong>{result.name}</strong>
                {result.synonym && <small>{result.synonym}</small>}
              </span>
              <span className="text-button">Use in schedule</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function SettingsPage({
  captures,
  workspaceTheme,
  workspacePalette,
  workspaceBackground,
  workspaceSidebarStyle,
  onThemeChange,
  onPaletteChange,
  onBackgroundChange,
  onSidebarStyleChange,
  onExport,
  onDeleteCategory,
  onImport,
  onReset,
}: {
  captures: CaptureEntry[]
  workspaceTheme: WorkspaceTheme
  workspacePalette: WorkspacePalette
  workspaceBackground: WorkspaceBackground
  workspaceSidebarStyle: WorkspaceSidebarStyle
  onThemeChange: (theme: WorkspaceTheme) => void
  onPaletteChange: (palette: WorkspacePalette) => void
  onBackgroundChange: (background: WorkspaceBackground) => void
  onSidebarStyleChange: (style: WorkspaceSidebarStyle) => void
  onExport: (format: 'json' | 'csv') => Promise<void>
  onDeleteCategory: (type: CaptureType) => Promise<void>
  onImport: (file: File) => Promise<void>
  onReset: () => Promise<void>
}) {
  const confirmDelete = useDeleteConfirmation()
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [visibleSections, setVisibleSections] = useSectionVisibility('nxt-settings-sections', [
    'overview',
    'appearance',
    'data',
  ])
  useEffect(() => {
    setVisibleSections((current) =>
      current.includes('appearance') ? current : [...current, 'appearance'],
    )
  }, [setVisibleSections])
  return (
    <div className="page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Your context, under your control.</h2>
          <p className="muted">
            The current MVP keeps health data local to this browser. Cloud sync and authentication
            are intentionally deferred.
          </p>
        </div>
      </section>
      <PageFeatureCustomizer
        label="Settings"
        title="Keep workspace controls easy to reach."
        jumpAriaLabel="Settings sections"
        jumpItems={
          [
            visibleSections.includes('overview') && ['settings-overview', 'Overview'],
            visibleSections.includes('appearance') && ['settings-appearance', 'Appearance'],
            visibleSections.includes('data') && ['settings-data', 'Data controls'],
          ].filter(Boolean) as Array<[string, string]>
        }
        options={[
          ['overview', 'Workspace'],
          ['appearance', 'Appearance'],
          ['data', 'Data controls'],
        ]}
        visible={visibleSections}
        onToggle={(key) =>
          setVisibleSections((current) =>
            current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
          )
        }
      />
      {visibleSections.includes('appearance') && (
        <section className="panel appearance-panel" id="settings-appearance">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Appearance</p>
              <h3>Make the workspace feel like yours.</h3>
            </div>
            <span className="source-pill">Saved locally</span>
          </div>
          <p className="muted compact-copy">
            Themes change the atmosphere, imagery changes the backdrop, and palettes change the
            accent color. Your health data never leaves this browser when you personalize the
            interface.
          </p>
          <div className="appearance-group">
            <span className="field-label">Background</span>
            <div className="theme-choice-grid">
              {workspaceThemes.map((theme) => (
                <button
                  type="button"
                  key={theme.id}
                  className={`theme-choice theme-choice-${theme.id} ${workspaceTheme === theme.id ? 'selected' : ''}`}
                  aria-pressed={workspaceTheme === theme.id}
                  onClick={() => onThemeChange(theme.id)}
                >
                  <span className="theme-choice-preview" aria-hidden="true" />
                  <strong>{theme.label}</strong>
                  <small>{theme.description}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="appearance-group">
            <span className="field-label">Background imagery</span>
            <div className="imagery-choice-grid">
              {workspaceBackgrounds.map((background) => (
                <button
                  type="button"
                  key={background.id}
                  className={`imagery-choice imagery-choice-${background.id} ${workspaceBackground === background.id ? 'selected' : ''}`}
                  aria-pressed={workspaceBackground === background.id}
                  onClick={() => onBackgroundChange(background.id)}
                >
                  <span className="imagery-choice-preview" aria-hidden="true" />
                  <strong>{background.label}</strong>
                  <small>{background.description}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="appearance-group">
            <span className="field-label">Accent palette</span>
            <div className="palette-choice-grid">
              {workspacePalettes.map((palette) => (
                <button
                  type="button"
                  key={palette.id}
                  className={`palette-choice palette-choice-${palette.id} ${workspacePalette === palette.id ? 'selected' : ''}`}
                  aria-pressed={workspacePalette === palette.id}
                  onClick={() => onPaletteChange(palette.id)}
                >
                  <span className="palette-swatch" aria-hidden="true" />
                  <span>
                    <strong>{palette.label}</strong>
                    <small>{palette.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="appearance-group">
            <span className="field-label">Sidebar colors</span>
            <div className="sidebar-style-choice-grid">
              {workspaceSidebarStyles.map((style) => (
                <button
                  type="button"
                  key={style.id}
                  className={`sidebar-style-choice sidebar-style-choice-${style.id} ${workspaceSidebarStyle === style.id ? 'selected' : ''}`}
                  aria-pressed={workspaceSidebarStyle === style.id}
                  onClick={() => onSidebarStyleChange(style.id)}
                >
                  <span className="sidebar-style-preview" aria-hidden="true" />
                  <span>
                    <strong>{style.label}</strong>
                    <small>{style.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
      {visibleSections.includes('overview') && (
        <section className="settings-grid" id="settings-overview">
          <section className="panel setting-card">
            <div className="setting-card-header">
              <div className="setting-icon">
                <Settings size={19} />
              </div>
              <p className="eyebrow">Workspace</p>
            </div>
            <h3>App settings</h3>
            <dl>
              <div>
                <dt>Storage</dt>
                <dd>Local browser storage</dd>
              </div>
              <div>
                <dt>Connections</dt>
                <dd>Off by default</dd>
              </div>
              <div>
                <dt>Profile details</dt>
                <dd>Managed from Profile</dd>
              </div>
            </dl>
            <p className="muted">Use the profile button for personal context and My Day focus.</p>
          </section>
          <section className="panel setting-card">
            <div className="setting-card-header">
              <div className="setting-icon">
                <Droplets size={19} />
              </div>
              <p className="eyebrow">Privacy</p>
            </div>
            <h3>Local-first by default</h3>
            <p className="muted">
              No health data is sent to analytics. Provider lookups are enabled by default, but only
              happen when you use them for food or medication references.
            </p>
            <button className="text-button" onClick={() => setShowPrivacy((open) => !open)}>
              {showPrivacy ? 'Hide privacy notes' : 'Read privacy notes'} <ChevronRight size={15} />
            </button>
            {showPrivacy && (
              <div className="privacy-notes">
                <p>Health data stays in this browser’s IndexedDB by default.</p>
                <p>
                  Provider lookups send only a food barcode or medication search term when enabled.
                </p>
                <p>AI, cloud sync, and health-data imports are reserved and off by default.</p>
              </div>
            )}
          </section>
        </section>
      )}
      {visibleSections.includes('data') && (
        <DataControlPanel
          captures={captures}
          onExport={onExport}
          onDeleteCategory={onDeleteCategory}
          onImport={onImport}
        />
      )}
      {visibleSections.includes('data') && (
        <section className="danger-zone">
          <div>
            <strong>Reset local workspace</strong>
            <p>
              Deletes this browser’s local profile, journals, photos, and settings. This cannot be
              undone.
            </p>
          </div>
          <button
            className="danger-button"
            onClick={async () => {
              if (await confirmDelete('Delete everything stored in this browser?')) await onReset()
            }}
          >
            Reset data
          </button>
        </section>
      )}
    </div>
  )
}

function MedicationTracker({
  medications,
  medicationLogs,
  prefill,
  onPrefillConsumed,
  onSave,
  onRemove,
  onLog,
}: {
  medications: MedicationSchedule[]
  medicationLogs: MedicationLog[]
  prefill?: MedicationLookupResult
  onPrefillConsumed?: () => void
  onSave: (entry: MedicationSchedule) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onLog: (entry: Omit<MedicationLog, 'id'>) => Promise<void>
}) {
  const confirmDelete = useDeleteConfirmation()
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [times, setTimes] = useState('08:00')
  const [frequency, setFrequency] = useState<MedicationFrequency>('daily')
  const [instructions, setInstructions] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderStatus, setReminderStatus] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [factsMedication, setFactsMedication] = useState<MedicationSchedule>()
  const activeMedications = medications.filter((medication) => medication.active)
  const takenToday = medicationLogs.filter((log) => log.status === 'taken')
  const reminderCount = activeMedications.filter((medication) => medication.reminderEnabled).length

  useEffect(() => {
    if (!prefill) return
    setName(prefill.name)
    setFormOpen(true)
  }, [prefill])

  async function enableReminders() {
    if (!('Notification' in window)) {
      setReminderStatus('This browser does not support notifications. In-app reminders still work.')
      return false
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setReminderStatus('Browser reminders are enabled on this device.')
      return true
    }
    setReminderStatus('Notifications were not enabled. You can still mark doses here manually.')
    return false
  }

  useEffect(() => {
    if (!activeMedications.some((medication) => medication.reminderEnabled)) return undefined
    const checkReminders = () => {
      const now = new Date()
      const currentDate = today()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      activeMedications.forEach((medication) => {
        if (!medication.reminderEnabled) return
        medication.times.forEach((time) => {
          const [hours, minutes] = time.split(':').map(Number)
          const scheduledMinutes = hours * 60 + minutes
          if (Math.abs(currentMinutes - scheduledMinutes) > 1) return
          const logKey = `${medication.id}:${currentDate}:${time}`
          if (
            medicationLogs.some(
              (log) =>
                log.medicationId === medication.id &&
                log.scheduledDate === currentDate &&
                log.scheduledTime === time,
            )
          )
            return
          if (window.sessionStorage.getItem(`nxt-med-reminder:${logKey}`)) return
          window.sessionStorage.setItem(`nxt-med-reminder:${logKey}`, 'sent')
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Medication reminder · ${medication.name}`, {
              body: `${medication.dose || 'Scheduled dose'} · ${time}`,
            })
          }
        })
      })
    }
    checkReminders()
    const interval = window.setInterval(checkReminders, 60_000)
    return () => window.clearInterval(interval)
  }, [activeMedications, medicationLogs])

  async function save() {
    if (!name.trim()) return
    const scheduledTimes = times
      .split(',')
      .map((time) => time.trim())
      .filter(Boolean)
    if (scheduledTimes.length === 0) return

    setSaving(true)
    setSaveError('')
    try {
      const now = new Date().toISOString()
      await onSave({
        id: newId(),
        name: name.trim(),
        dose: dose.trim(),
        frequency,
        times: scheduledTimes,
        instructions: instructions.trim() || undefined,
        reminderEnabled,
        active: true,
        createdAt: now,
        updatedAt: now,
        reference: prefill
          ? {
              externalId: prefill.sourceId,
              source: {
                provider: prefill.sourceLabel,
                recordId: prefill.sourceId,
                retrievedAt: now,
              },
            }
          : undefined,
      })
      setName('')
      setDose('')
      setTimes('08:00')
      setFrequency('daily')
      setInstructions('')
      setReminderEnabled(true)
      setFormOpen(false)
      onPrefillConsumed?.()
    } catch {
      setSaveError('The schedule could not be saved. Your existing medication data is unchanged.')
    } finally {
      setSaving(false)
    }
  }

  async function logDose(
    medication: MedicationSchedule,
    status: MedicationLog['status'],
    time: string,
  ) {
    await onLog({
      medicationId: medication.id,
      scheduledDate: today(),
      scheduledTime: time,
      status,
      loggedAt: new Date().toISOString(),
    })
  }

  return (
    <section className="panel medication-tracker" id="medications">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Medication tracker</p>
          <h3>Your medication schedule</h3>
        </div>
        <div className="panel-heading-actions">
          <span className="source-pill">Local only</span>
          <button
            className="secondary-button"
            disabled={activeMedications.length === 0}
            title={activeMedications.length === 0 ? 'Add a medication schedule first' : undefined}
            onClick={() => void enableReminders()}
          >
            <BellRing size={16} /> Enable reminders
          </button>
        </div>
      </div>
      <p className="muted compact-copy">
        See what’s next, log it when you take it, and keep the details you may want to check later.
      </p>
      <div className="medication-tracker-toolbar">
        <div className="medication-summary">
          <div className="medication-summary-item medication-summary-active">
            <strong>{activeMedications.length}</strong>
            <span>active</span>
          </div>
          <div className="medication-summary-item medication-summary-taken">
            <strong>{takenToday.length}</strong>
            <span>taken today</span>
          </div>
          <div className="medication-summary-item medication-summary-reminders">
            <strong>{reminderCount}</strong>
            <span>reminders on</span>
          </div>
        </div>
        <button
          className="secondary-button medication-add-button"
          onClick={() => setFormOpen((open) => !open)}
        >
          <Plus size={17} /> {formOpen ? 'Close form' : 'Add schedule'}
        </button>
      </div>
      {reminderStatus && <p className="form-success">{reminderStatus}</p>}
      {formOpen && (
        <div className="medication-form">
          <label>
            Medication or supplement
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: Vitamin D"
            />
          </label>
          <div className="three-col medication-schedule-fields">
            <label>
              Dose
              <input
                value={dose}
                onChange={(event) => setDose(event.target.value)}
                placeholder="1000 IU or 1 tablet"
              />
            </label>
            <label>
              Times
              <input
                value={times}
                onChange={(event) => setTimes(event.target.value)}
                placeholder="08:00, 20:00"
              />
            </label>
            <label>
              Frequency
              <select
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as MedicationFrequency)}
              >
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays</option>
                <option value="custom">Custom schedule</option>
                <option value="as-needed">As needed</option>
              </select>
            </label>
          </div>
          <small className="medication-form-hint">Separate multiple times with commas.</small>
          <label>
            Instructions <small>Optional context, such as “with food.”</small>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={2}
              placeholder="Anything helpful to remember"
            />
          </label>
          <label className="medication-reminder-toggle">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(event) => setReminderEnabled(event.target.checked)}
            />
            <span>
              <strong>Enable a reminder for this schedule</strong>
              <small>You can change this later from the medication card.</small>
            </span>
          </label>
          <button
            className="primary-button medication-save-button"
            disabled={!name.trim() || !times.trim() || saving}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save medication'}
          </button>
          {saveError && <p className="form-error">{saveError}</p>}
        </div>
      )}
      {activeMedications.length === 0 ? (
        <EmptyState text="No medications scheduled yet. Add one when you are ready." />
      ) : (
        <div className="medication-list">
          {activeMedications.map((medication) => (
            <article className="medication-card" key={medication.id}>
              <div className="medication-card-header">
                <div className="medication-card-icon" aria-hidden="true">
                  <Pill size={20} />
                </div>
                <div className="medication-card-heading">
                  <div className="medication-card-title">
                    <h4>{medication.name}</h4>
                    <span>{medication.frequency.replace('-', ' ')}</span>
                  </div>
                  <small className="medication-card-caption">
                    {medication.times.length === 1
                      ? '1 scheduled dose today'
                      : `${medication.times.length} scheduled doses today`}
                  </small>
                </div>
                <button
                  className="icon-button danger medication-remove-button"
                  aria-label={`Remove ${medication.name}`}
                  onClick={async () => {
                    if (await confirmDelete(`Remove ${medication.name} from your schedule?`))
                      await onRemove(medication.id)
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="medication-card-details">
                <div>
                  <span>Dose</span>
                  <strong>{medication.dose || 'Not specified'}</strong>
                </div>
                <div>
                  <span>Schedule</span>
                  <strong>{medication.times.join(' · ') || 'No time set'}</strong>
                </div>
              </div>
              {medication.instructions && (
                <p className="medication-card-instructions">{medication.instructions}</p>
              )}
              <div className="medication-dose-actions">
                <div className="medication-dose-actions-heading">
                  <div>
                    <span>Today</span>
                    <small>Mark each dose as you go.</small>
                  </div>
                  <button
                    className="text-button medication-facts-button"
                    onClick={() => setFactsMedication(medication)}
                  >
                    Drug facts
                  </button>
                </div>
                {medication.times.map((time) => {
                  const log = medicationLogs.find(
                    (entry) =>
                      entry.medicationId === medication.id &&
                      entry.scheduledDate === today() &&
                      entry.scheduledTime === time,
                  )
                  return (
                    <div key={time} className="medication-dose-row">
                      <span className="medication-dose-time">
                        <Bell size={14} /> {time}
                      </span>
                      {log ? (
                        <strong
                          className={
                            log.status === 'taken' ? 'medication-taken' : 'medication-skipped'
                          }
                        >
                          {log.status === 'taken' ? 'Taken' : 'Skipped'}
                        </strong>
                      ) : (
                        <span className="medication-dose-actions-buttons">
                          <button
                            className="secondary-button"
                            onClick={() => void logDose(medication, 'taken', time)}
                          >
                            Take dose
                          </button>
                          <button
                            className="text-button"
                            onClick={() => void logDose(medication, 'skipped', time)}
                          >
                            Skip
                          </button>
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </article>
          ))}
        </div>
      )}
      {factsMedication && (
        <MedicationFactsDrawer
          medication={factsMedication}
          onClose={() => setFactsMedication(undefined)}
        />
      )}
    </section>
  )
}

function MedicationFactsDrawer({
  medication,
  onClose,
}: {
  medication: MedicationSchedule
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLElement>(null)
  useDialogFocus(dialogRef, onClose)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [facts, setFacts] = useState<MedicationFactsResult>()
  const provider = new OpenFdaMedicationFactsProvider()

  useEffect(() => {
    let active = true
    setStatus('loading')
    setFacts(undefined)
    void provider
      .getFacts({
        name: medication.name,
        rxcui: medication.reference?.externalId,
      })
      .then((result) => {
        if (!active) return
        setFacts(result ?? undefined)
        setStatus(result ? 'ready' : 'empty')
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => {
      active = false
    }
  }, [medication])

  return (
    <div
      className="medication-facts-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        ref={dialogRef}
        className="medication-facts-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="medication-facts-title"
      >
        <header className="medication-facts-header">
          <div>
            <p className="eyebrow">Drug facts</p>
            <h2 id="medication-facts-title">{medication.name}</h2>
            <p className="muted">
              {medication.dose || 'Dose not specified'} ·{' '}
              {medication.reference?.externalId ? 'Matched to RxNorm' : 'Name search'}
            </p>
          </div>
          <button className="icon-button" aria-label="Close drug facts" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {status === 'loading' && (
          <div className="medication-facts-loading" role="status">
            <strong>Looking up the current FDA label…</strong>
            <span>Only the medication name or RxNorm match is sent.</span>
          </div>
        )}
        {status === 'empty' && (
          <div className="medication-facts-empty">
            <strong>No label match found</strong>
            <p>
              Try matching this medication through Information lookup first, or check the spelling.
            </p>
          </div>
        )}
        {status === 'error' && (
          <div className="medication-facts-empty">
            <strong>The label service is unavailable</strong>
            <p>Your schedule is unchanged. Try again later.</p>
          </div>
        )}
        {facts && (
          <div className="medication-facts-content">
            <div className="medication-facts-source">
              <span className="source-pill">FDA label</span>
              <small>
                {facts.effectiveTime ? `Updated ${facts.effectiveTime}` : 'Current label record'}
              </small>
            </div>
            {facts.sections.map((section) => (
              <section className="medication-fact-section" key={section.id}>
                <h3>{section.title}</h3>
                {section.paragraphs.map((paragraph, index) => (
                  <p key={`${section.id}-${index}`}>{paragraph}</p>
                ))}
              </section>
            ))}
            <div className="medication-facts-disclaimer">
              <strong>Use this as reference, not a treatment decision.</strong>
              <p>{facts.source.limitation}</p>
              <a href={facts.sourceUrl} target="_blank" rel="noreferrer">
                View the FDA label source <ChevronRight size={15} />
              </a>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function DataControlPanel({
  captures,
  onExport,
  onDeleteCategory,
  onImport,
}: {
  captures: CaptureEntry[]
  onExport: (format: 'json' | 'csv') => Promise<void>
  onDeleteCategory: (type: CaptureType) => Promise<void>
  onImport: (file: File) => Promise<void>
}) {
  const confirmDelete = useDeleteConfirmation()
  const [consents, setConsents] = useState<Record<string, boolean>>({
    'cloud-sync': false,
    'ai-general': false,
    'provider-lookups': true,
    'cross-domain-analysis': false,
    'ai-sensitive-data': false,
    'health-data-import': false,
  })
  useEffect(() => {
    void consentRepository
      .list()
      .then((saved) =>
        setConsents((current) =>
          Object.fromEntries([
            ...Object.entries(current),
            ...saved.map((preference) => [preference.scope, preference.granted]),
          ]),
        ),
      )
  }, [])
  const scopes: Array<{ id: ConsentScope; label: string; copy: string; available: boolean }> = [
    {
      id: 'cloud-sync',
      label: 'Cloud sync',
      copy: 'Reserved for a future sync service. Off means this app keeps data on this device.',
      available: false,
    },
    {
      id: 'ai-general',
      label: 'General AI features',
      copy: 'Reserved for future non-sensitive assistance. This app does not send data today.',
      available: false,
    },
    {
      id: 'provider-lookups',
      label: 'Provider lookups',
      copy: 'Only when you search or scan with an external food or medication provider. On by default; switch off any time.',
      available: true,
    },
    {
      id: 'cross-domain-analysis',
      label: 'Cross-domain analysis',
      copy: 'Allow Patterns to compare entries across Body, Mind, Life, and connection.',
      available: true,
    },
    {
      id: 'health-data-import',
      label: 'Future health-data imports',
      copy: 'Permission for a future Health Connect adapter, when available.',
      available: false,
    },
    {
      id: 'ai-sensitive-data',
      label: 'Future AI access to sensitive data',
      copy: 'Off by default. This does not enable AI or send anything today.',
      available: false,
    },
  ]
  async function toggle(id: ConsentScope) {
    const granted = !consents[id]
    setConsents((current) => ({ ...current, [id]: granted }))
    await consentRepository.save({
      id,
      scope: id,
      granted,
      updatedAt: new Date().toISOString(),
    })
  }
  return (
    <section className="panel data-control-panel" id="settings-data">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Data control center</p>
          <h3>Keep a copy. Choose what connects.</h3>
        </div>
        <span className="source-pill">Local browser storage</span>
      </div>
      <p className="muted">
        This app stores data in IndexedDB on this device. It is not encrypted clinical storage.
        Export a backup before clearing browser data.
      </p>
      <div className="button-row">
        <button className="secondary-button" onClick={() => void onExport('json')}>
          <Download size={16} /> Export JSON
        </button>
        <button className="secondary-button" onClick={() => void onExport('csv')}>
          <Download size={16} /> Export captures CSV
        </button>
        <label className="secondary-button import-button">
          <Upload size={16} /> Import JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void onImport(file)
            }}
          />
        </label>
      </div>
      <div className="consent-list">
        {scopes.map((scope) => (
          <label className="consent-row" key={scope.id}>
            <input
              type="checkbox"
              checked={scope.available && Boolean(consents[scope.id])}
              disabled={!scope.available}
              onChange={() => void toggle(scope.id)}
            />
            <span>
              <strong>{scope.label}</strong>
              <small>{scope.copy}</small>
              {!scope.available && (
                <small className="coming-soon-label">
                  Coming later · unavailable in this build
                </small>
              )}
            </span>
          </label>
        ))}
      </div>
      <div className="delete-category">
        <strong>Delete capture category</strong>
        <div className="button-row">
          {(
            ['wellbeing', 'sleep', 'medication', 'symptom', 'life-event', 'custom'] as CaptureType[]
          ).map((type) => (
            <button
              className="danger-button danger-category-button"
              key={type}
              onClick={async () => {
                if (await confirmDelete(`Delete all ${type} entries?`)) await onDeleteCategory(type)
              }}
            >
              {type.replaceAll('-', ' ')}
            </button>
          ))}
        </div>
        <small>
          {captures.length} universal capture entries are stored locally. Delete actions cannot be
          undone.
        </small>
      </div>
    </section>
  )
}

function ProfileEditor({
  profile,
  onSave,
  onCancel,
}: {
  profile: Profile
  onSave: (changes: Partial<Profile>) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(profile.displayName)
  const [avatarDataUrl, setAvatarDataUrl] = useState(profile.avatarDataUrl ?? '')
  const [avatarError, setAvatarError] = useState('')
  const [headline, setHeadline] = useState(profile.headline ?? '')
  const [bio, setBio] = useState(profile.bio ?? starterProfileBio)
  const [occupation, setOccupation] = useState(profile.occupation ?? '')
  const [location, setLocation] = useState(profile.location ?? '')
  const [unitSystem, setUnitSystem] = useState(profile.unitSystem)
  const [activityLevel, setActivityLevel] = useState(profile.activityLevel)
  const [supportStyle, setSupportStyle] = useState<SupportStyle>(profile.supportStyle ?? 'gentle')
  const [age, setAge] = useState(profile.age?.toString() ?? '')
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '')
  const [heightValue, setHeightValue] = useState(
    profile.heightCm
      ? (profile.unitSystem === 'imperial' ? profile.heightCm / 2.54 : profile.heightCm).toFixed(1)
      : '',
  )
  const [timezone, setTimezone] = useState(
    profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [preferredMovement, setPreferredMovement] = useState(profile.preferredMovement ?? '')
  const [preferredNutritionPattern, setPreferredNutritionPattern] = useState(
    profile.preferredNutritionPattern ?? '',
  )
  const [sleepPreference, setSleepPreference] = useState(profile.sleepPreference ?? '')
  const [dataDisplay, setDataDisplay] = useState<'simple' | 'detailed'>(
    profile.dataDisplay ?? 'simple',
  )
  const [sexAssignedAtBirth, setSexAssignedAtBirth] = useState<SexAssignedAtBirth | ''>(
    profile.sexAssignedAtBirth ?? '',
  )
  const [genderIdentity, setGenderIdentity] = useState<GenderIdentity | ''>(
    profile.genderIdentity ?? '',
  )
  const [pronouns, setPronouns] = useState<PronounPreference | ''>(profile.pronouns ?? '')
  const [customPronouns, setCustomPronouns] = useState(profile.customPronouns ?? '')
  const [sexForEquation, setSexForEquation] = useState(profile.sexForEquation)
  const [focus, setFocus] = useState<HealthDomain[]>(
    profile.todayFocus ?? ['body', 'mind', 'behavior'],
  )
  function toggleFocus(domain: HealthDomain) {
    setFocus((current) =>
      current.includes(domain) ? current.filter((item) => item !== domain) : [...current, domain],
    )
  }
  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('That image is larger than 5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      setAvatarDataUrl(reader.result)
      setAvatarError('')
    }
    reader.onerror = () => setAvatarError('That image could not be read.')
    reader.readAsDataURL(file)
  }
  return (
    <div className="profile-editor inline-form">
      <div className="profile-avatar-editor">
        <div className="profile-avatar-preview">
          {avatarDataUrl ? (
            <img src={avatarDataUrl} alt="Selected profile preview" />
          ) : (
            <UserRound size={28} aria-hidden="true" />
          )}
        </div>
        <div className="profile-avatar-controls">
          <span className="field-label">Profile picture</span>
          <label className="secondary-button profile-upload-button">
            {avatarDataUrl ? 'Replace picture' : 'Upload picture'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange}
            />
          </label>
          {avatarDataUrl && (
            <button className="text-button" type="button" onClick={() => setAvatarDataUrl('')}>
              Remove picture
            </button>
          )}
          <small>PNG, JPG, or WebP · 5 MB max · saved on this device</small>
          {avatarError && <small className="form-error">{avatarError}</small>}
        </div>
      </div>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Profile headline <small>What season of life are you in?</small>
        <input
          value={headline}
          maxLength={80}
          onChange={(event) => setHeadline(event.target.value)}
          placeholder="Building a steadier, more connected life"
        />
      </label>
      <label className="profile-bio-field">
        Bio <small>Only shared when you choose</small>
        <textarea
          rows={3}
          value={bio}
          maxLength={280}
          onChange={(event) => setBio(event.target.value)}
          placeholder="A few words about what matters to you right now"
        />
      </label>
      <div className="two-col">
        <label>
          Work or role <small>Optional context</small>
          <input
            value={occupation}
            onChange={(event) => setOccupation(event.target.value)}
            placeholder="Designer, parent, student…"
          />
        </label>
        <label>
          Location <small>Optional · broad is enough</small>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Chicago, IL"
          />
        </label>
      </div>
      <label>
        Units
        <select
          value={unitSystem}
          onChange={(event) => {
            const next = event.target.value as typeof unitSystem
            setHeightValue((current) =>
              current
                ? (Number(current) * (next === 'imperial' ? 1 / 2.54 : 2.54)).toFixed(1)
                : current,
            )
            setUnitSystem(next)
          }}
        >
          <option value="imperial">Imperial · lb / ft</option>
          <option value="metric">Metric · kg / cm</option>
        </select>
      </label>
      <label>
        Age
        <input
          type="number"
          min="1"
          max="120"
          step="1"
          value={age}
          onChange={(event) => setAge(event.target.value)}
        />
      </label>
      <label>
        Birth date <small>Optional and private</small>
        <input
          type="date"
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
        />
      </label>
      <label>
        Height <small>{unitSystem === 'imperial' ? 'Inches' : 'Centimeters'}</small>
        <input
          type="number"
          min="50"
          max="260"
          value={heightValue}
          onChange={(event) => setHeightValue(event.target.value)}
        />
      </label>
      <label>
        Sex assigned at birth
        <select
          value={sexAssignedAtBirth}
          onChange={(event) =>
            setSexAssignedAtBirth(
              event.target.value ? (event.target.value as SexAssignedAtBirth) : '',
            )
          }
        >
          <option value="">Prefer not to say</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="intersex">Intersex</option>
          <option value="not-listed">Not listed</option>
        </select>
      </label>
      <label>
        Gender identity
        <select
          value={genderIdentity}
          onChange={(event) =>
            setGenderIdentity(event.target.value ? (event.target.value as GenderIdentity) : '')
          }
        >
          <option value="">Prefer not to say</option>
          <option value="woman">Woman</option>
          <option value="man">Man</option>
          <option value="non-binary">Non-binary</option>
          <option value="genderqueer">Genderqueer</option>
          <option value="questioning">Questioning</option>
          <option value="self-described">Self-described</option>
        </select>
      </label>
      <label>
        Pronouns
        <select
          value={pronouns}
          onChange={(event) =>
            setPronouns(event.target.value ? (event.target.value as PronounPreference) : '')
          }
        >
          <option value="">Prefer not to say</option>
          <option value="she-her">she / her</option>
          <option value="he-him">he / him</option>
          <option value="they-them">they / them</option>
          <option value="she-they">she / they</option>
          <option value="he-they">he / they</option>
          <option value="use-my-name">Use my name</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {pronouns === 'custom' && (
        <label>
          Custom pronouns
          <input
            value={customPronouns}
            onChange={(event) => setCustomPronouns(event.target.value)}
          />
        </label>
      )}
      <label>
        Equation setting
        <select
          value={sexForEquation}
          onChange={(event) => setSexForEquation(event.target.value as Profile['sexForEquation'])}
        >
          <option value="unspecified">Use a neutral estimate</option>
          <option value="female">Female equation</option>
          <option value="male">Male equation</option>
        </select>
      </label>
      <label>
        Activity baseline
        <select
          value={activityLevel}
          onChange={(event) => setActivityLevel(event.target.value as typeof activityLevel)}
        >
          <option value="sedentary">Sedentary</option>
          <option value="light">Light</option>
          <option value="moderate">Moderate</option>
          <option value="very">Very active</option>
          <option value="extra">Extra active</option>
        </select>
      </label>
      <label>
        Time zone <small>Used for day boundaries and reminders</small>
        <input
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          placeholder="America/Chicago"
        />
      </label>
      <label>
        Preferred movement <small>Optional context for quick actions</small>
        <input
          value={preferredMovement}
          onChange={(event) => setPreferredMovement(event.target.value)}
          placeholder="Walking, yoga, lifting…"
        />
      </label>
      <label>
        Nutrition context <small>Optional · no calorie target implied</small>
        <input
          value={preferredNutritionPattern}
          onChange={(event) => setPreferredNutritionPattern(event.target.value)}
          placeholder="Regular meals, intuitive eating…"
        />
      </label>
      <label>
        Sleep context <small>Optional preference or routine</small>
        <input
          value={sleepPreference}
          onChange={(event) => setSleepPreference(event.target.value)}
          placeholder="Earlier nights, flexible schedule…"
        />
      </label>
      <label>
        Data detail
        <select
          value={dataDisplay}
          onChange={(event) => setDataDisplay(event.target.value as 'simple' | 'detailed')}
        >
          <option value="simple">Simple summaries</option>
          <option value="detailed">Detailed context</option>
        </select>
      </label>
      <label>
        Prompt style <small>How N//XT should sound</small>
        <select
          value={supportStyle}
          onChange={(event) => setSupportStyle(event.target.value as SupportStyle)}
        >
          <option value="gentle">Gentle · spacious and low-pressure</option>
          <option value="direct">Clear · practical and concise</option>
          <option value="reflective">Reflective · curious and spacious</option>
        </select>
      </label>
      <div className="focus-picker">
        <span className="field-label">My Day focus</span>
        <div className="focus-chips">
          {(['body', 'mind', 'behavior', 'spiritual', 'environment'] as HealthDomain[]).map(
            (domain) => (
              <button
                key={domain}
                type="button"
                className={focus.includes(domain) ? 'selected' : ''}
                aria-pressed={focus.includes(domain)}
                onClick={() => toggleFocus(domain)}
              >
                {domain[0].toUpperCase() + domain.slice(1)}
              </button>
            ),
          )}
        </div>
        <small>My Day will prioritize the parts of health you choose here.</small>
      </div>
      <div className="profile-editor-actions">
        <button className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary-button"
          disabled={!name.trim() || (age !== '' && (Number(age) < 1 || Number(age) > 120))}
          onClick={() =>
            void onSave({
              displayName: name.trim(),
              avatarDataUrl: avatarDataUrl || undefined,
              headline: headline.trim() || undefined,
              bio: bio.trim() || undefined,
              occupation: occupation.trim() || undefined,
              location: location.trim() || undefined,
              unitSystem,
              activityLevel,
              supportStyle,
              age: age ? Number(age) : undefined,
              birthDate: birthDate || undefined,
              heightCm: heightValue
                ? Number(heightValue) * (unitSystem === 'imperial' ? 2.54 : 1)
                : undefined,
              timezone: timezone.trim() || undefined,
              preferredMovement: preferredMovement.trim() || undefined,
              preferredNutritionPattern: preferredNutritionPattern.trim() || undefined,
              sleepPreference: sleepPreference.trim() || undefined,
              dataDisplay,
              sexAssignedAtBirth: sexAssignedAtBirth || undefined,
              genderIdentity: genderIdentity || undefined,
              pronouns: pronouns || undefined,
              customPronouns:
                pronouns === 'custom' ? customPronouns.trim() || undefined : undefined,
              sexForEquation,
              todayFocus: focus,
            })
          }
        >
          Save profile
        </button>
      </div>
    </div>
  )
}

const metricOptions = metricRegistry
  .filter((metric) => !metric.compound)
  .map((metric) => ({ kind: metric.id, label: metric.label, unit: metric.defaultUnit }))

function MetricQuickAdd({
  unit,
  onSave,
  onCancel,
}: {
  unit: UnitSystem
  onSave: (entry: Omit<HealthMetricEntry, 'id' | 'createdAt'>) => Promise<void>
  onCancel: () => void
}) {
  const [kind, setKind] = useState<HealthMetricKind>('waist-circumference')
  const [value, setValue] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [customUnit, setCustomUnit] = useState('')
  const [date, setDate] = useState(today())
  const [source, setSource] = useState<'manual' | 'screening'>('manual')
  const selected = metricOptions.find((option) => option.kind === kind) ?? metricOptions[0]
  const displayUnit =
    kind === 'custom'
      ? customUnit.trim() || 'unit'
      : selected.unit === 'cm' && unit === 'imperial'
        ? 'in'
        : selected.unit === 'percent'
          ? '%'
          : selected.unit

  async function save() {
    const parsed = Number(value)
    if (!(parsed > 0)) return
    await onSave({
      date: date || today(),
      kind,
      label: kind === 'custom' ? customLabel.trim() : selected.label,
      value: displayUnit === 'in' ? parsed * 2.54 : parsed,
      unit: kind === 'custom' ? displayUnit : selected.unit,
      source,
    })
  }

  return (
    <div className="inline-form metric-quick-add">
      <label>
        Metric
        <select value={kind} onChange={(event) => setKind(event.target.value as HealthMetricKind)}>
          {metricOptions.map((option) => (
            <option key={option.kind} value={option.kind}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {kind === 'custom' && (
        <>
          <label>
            Metric name
            <input
              value={customLabel}
              onChange={(event) => setCustomLabel(event.target.value)}
              placeholder="e.g. Neck circumference"
            />
          </label>
          <label>
            Unit
            <input
              value={customUnit}
              onChange={(event) => setCustomUnit(event.target.value)}
              placeholder="e.g. cm, points, or count"
            />
          </label>
        </>
      )}
      <label>
        Value ({displayUnit})
        <input
          autoFocus
          type="number"
          min="0"
          step="0.1"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Enter a value"
        />
      </label>
      <label>
        Date
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label>
        Source
        <select value={source} onChange={(event) => setSource(event.target.value as typeof source)}>
          <option value="manual">My own measurement</option>
          <option value="screening">Biometric screening</option>
        </select>
      </label>
      <button
        className="primary-button"
        disabled={Number(value) <= 0 || (kind === 'custom' && !customLabel.trim())}
        onClick={save}
      >
        Save metric
      </button>
      <button className="secondary-button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Sparkles size={19} />
      <div>
        <p>{text}</p>
        <small>Nothing is missing. Add context when it becomes useful to you.</small>
      </div>
    </div>
  )
}

const captureTypeOptions: Array<{ type: CaptureType; label: string; description: string }> = [
  { type: 'weight', label: 'Weigh-in', description: 'A recorded body-weight observation' },
  {
    type: 'metric',
    label: 'Measurement',
    description: 'A number such as waist, blood pressure, glucose, or heart rate',
  },
  { type: 'blood-pressure', label: 'Blood pressure', description: 'One paired reading' },
  { type: 'heart-rate', label: 'Heart rate', description: 'A heart-rate reading' },
  {
    type: 'oxygen-saturation',
    label: 'Oxygen saturation',
    description: 'SpO₂ from a pulse oximeter',
  },
  { type: 'steps', label: 'Steps', description: 'A pedometer or device step count' },
  { type: 'glucose', label: 'Glucose', description: 'A glucose reading' },
  { type: 'a1c', label: 'A1C', description: 'A1C / HbA1c percentage' },
  { type: 'cholesterol', label: 'Total cholesterol', description: 'A total cholesterol reading' },
  { type: 'hdl-cholesterol', label: 'HDL cholesterol', description: 'HDL cholesterol reading' },
  { type: 'ldl-cholesterol', label: 'LDL cholesterol', description: 'LDL cholesterol reading' },
  { type: 'triglycerides', label: 'Triglycerides', description: 'Triglycerides reading' },
  { type: 'food', label: 'Food', description: 'A meal, snack, or drink' },
  { type: 'movement', label: 'Movement', description: 'Exercise or daily movement' },
  { type: 'wellbeing', label: 'Mood / stress / energy', description: 'Separate wellbeing signals' },
  { type: 'sleep', label: 'Sleep', description: 'Duration or a sleep note' },
  {
    type: 'medication',
    label: 'Medication observation',
    description: 'What you noticed, without inference',
  },
  { type: 'symptom', label: 'Symptom observation', description: 'A private note about a symptom' },
  { type: 'life-event', label: 'Life event', description: 'Context you choose to remember' },
  {
    type: 'custom',
    label: 'Custom note',
    description: 'Freeform context that is not a measurement',
  },
]

function UniversalCapture({
  onClose,
  onSave,
  initial,
  onUpdate,
}: {
  onClose: () => void
  onSave: (entry: Omit<CaptureEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  initial?: CaptureEntry
  onUpdate?: (entry: CaptureEntry) => Promise<void>
}) {
  const dialogRef = useRef<HTMLElement>(null)
  const [type, setType] = useState<CaptureType>(initial?.type ?? 'weight')
  const [occurredAt, setOccurredAt] = useState(dateTimeLocalValue(initial?.occurredAt))
  const [title, setTitle] = useState(initial?.title ?? '')
  const [value, setValue] = useState(
    initial?.value !== undefined && initial.value !== null ? String(initial.value) : '',
  )
  const [secondValue, setSecondValue] = useState(
    initial?.payload?.diastolic ? String(initial.payload.diastolic) : '',
  )
  const [unit, setUnit] = useState(initial?.unit ?? (initial?.type === 'weight' ? 'kg' : ''))
  const [context, setContext] = useState(initial?.context ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [source, setSource] = useState<CaptureEntry['source']>(initial?.source ?? 'manual')
  const [mood, setMood] = useState(initial?.payload?.mood ? String(initial.payload.mood) : '')
  const [stress, setStress] = useState(
    initial?.payload?.stress ? String(initial.payload.stress) : '',
  )
  const [energy, setEnergy] = useState(
    initial?.payload?.energy ? String(initial.payload.energy) : '',
  )
  const [anxiety, setAnxiety] = useState(
    initial?.payload?.anxiety ? String(initial.payload.anxiety) : '',
  )
  const [motivation, setMotivation] = useState(
    initial?.payload?.motivation ? String(initial.payload.motivation) : '',
  )
  const [sleepQuality, setSleepQuality] = useState(
    initial?.payload?.sleepQuality ? String(initial.payload.sleepQuality) : '',
  )
  const [focus, setFocus] = useState(initial?.payload?.focus ? String(initial.payload.focus) : '')
  const [bodyTension, setBodyTension] = useState(
    initial?.payload?.bodyTension ? String(initial.payload.bodyTension) : '',
  )
  const [error, setError] = useState('')
  useDialogFocus(dialogRef, onClose)
  const submit = async () => {
    const numeric = value === '' ? undefined : Number(value)
    if (
      [
        'weight',
        'metric',
        'blood-pressure',
        'heart-rate',
        'oxygen-saturation',
        'steps',
        'glucose',
        'a1c',
        'cholesterol',
        'hdl-cholesterol',
        'ldl-cholesterol',
        'triglycerides',
        'sleep',
      ].includes(type) &&
      (numeric === undefined || !Number.isFinite(numeric) || numeric <= 0)
    )
      return setError('Add a positive value, or choose a note-based entry.')
    if (type === 'blood-pressure' && (!secondValue || Number(secondValue) <= 0))
      return setError('Blood pressure needs both systolic and diastolic values.')
    if (
      type === 'wellbeing' &&
      !mood &&
      !stress &&
      !energy &&
      !anxiety &&
      !motivation &&
      !sleepQuality &&
      !focus &&
      !bodyTension
    )
      return setError('Add at least one wellbeing signal, or close this sheet.')
    if (
      ['medication', 'symptom', 'life-event', 'custom', 'food', 'movement'].includes(type) &&
      !title.trim()
    )
      return setError('Give this entry a short title so it is understandable later.')
    const payload: Record<string, string | number | boolean | null> = {}
    if (type === 'blood-pressure') payload.diastolic = Number(secondValue)
    if (type === 'wellbeing') {
      if (mood) payload.mood = Number(mood)
      if (stress) payload.stress = Number(stress)
      if (energy) payload.energy = Number(energy)
      if (anxiety) payload.anxiety = Number(anxiety)
      if (motivation) payload.motivation = Number(motivation)
      if (sleepQuality) payload.sleepQuality = Number(sleepQuality)
      if (focus) payload.focus = Number(focus)
      if (bodyTension) payload.bodyTension = Number(bodyTension)
    }
    const entry = {
      type,
      occurredAt: new Date(occurredAt).toISOString(),
      title:
        title.trim() ||
        (type === 'weight'
          ? 'Weight'
          : (captureTypeOptions.find((option) => option.type === type)?.label ?? 'Entry')),
      value: numeric,
      unit: unit.trim() || undefined,
      source,
      context: context.trim() || undefined,
      note: note.trim() || undefined,
      payload: Object.keys(payload).length ? payload : undefined,
    } satisfies Omit<CaptureEntry, 'id' | 'createdAt' | 'updatedAt'>
    if (initial && onUpdate) await onUpdate({ ...initial, ...entry })
    else await onSave(entry)
    onClose()
  }
  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="capture-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-title"
      >
        <div className="sheet-handle" />
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Record health data</p>
            <h2 id="capture-title">{initial ? 'Edit record' : 'Choose what to record'}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <label>
          What are you recording?
          <select
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as CaptureType
              setType(nextType)
              if (!initial) {
                setTitle('')
                setValue('')
                setUnit(
                  nextType === 'weight'
                    ? 'kg'
                    : nextType === 'oxygen-saturation' || nextType === 'a1c'
                      ? '%'
                      : nextType === 'steps'
                        ? 'steps'
                        : nextType === 'heart-rate'
                          ? 'bpm'
                          : nextType === 'sleep'
                            ? 'hours'
                            : '',
                )
              }
              setError('')
            }}
            disabled={Boolean(initial)}
          >
            {captureTypeOptions.map((option) => (
              <option key={option.type} value={option.type}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="capture-type-hint">
          {captureTypeOptions.find((option) => option.type === type)?.description}
        </div>
        <div className="two-col">
          <label>
            Date and time
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </label>
          <label>
            Source
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as CaptureEntry['source'])}
            >
              <option value="manual">I entered it</option>
              <option value="screening">Screening</option>
              <option value="device">Device</option>
              <option value="imported">Imported</option>
              <option value="provider">Provider</option>
            </select>
          </label>
        </div>
        {type === 'wellbeing' ? (
          <div className="feeling-matrix capture-feeling-matrix">
            <ScaleInput label="Mood" value={mood} onChange={setMood} />
            <ScaleInput label="Stress" value={stress} onChange={setStress} />
            <ScaleInput label="Energy" value={energy} onChange={setEnergy} />
            <ScaleInput label="Anxiety" value={anxiety} onChange={setAnxiety} />
            <ScaleInput label="Motivation" value={motivation} onChange={setMotivation} />
            <ScaleInput label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
            <ScaleInput label="Focus" value={focus} onChange={setFocus} />
            <ScaleInput label="Body tension" value={bodyTension} onChange={setBodyTension} />
          </div>
        ) : type === 'blood-pressure' ? (
          <div className="two-col">
            <label>
              Systolic
              <input
                type="number"
                min="40"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="120"
              />
              <small>mmHg</small>
            </label>
            <label>
              Diastolic
              <input
                type="number"
                min="20"
                value={secondValue}
                onChange={(event) => setSecondValue(event.target.value)}
                placeholder="80"
              />
              <small>mmHg</small>
            </label>
          </div>
        ) : (
          <div className="two-col">
            <label>
              {['custom', 'food', 'movement', 'medication', 'symptom', 'life-event'].includes(type)
                ? type === 'medication'
                  ? 'Medication or supplement'
                  : 'Title'
                : type === 'oxygen-saturation'
                  ? 'SpO₂ percentage'
                  : type === 'a1c'
                    ? 'A1C percentage'
                    : type === 'steps'
                      ? 'Step count'
                      : 'Value'}
              {['custom', 'food', 'movement', 'medication', 'symptom', 'life-event'].includes(
                type,
              ) ? (
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={type === 'medication' ? 'Example: magnesium' : 'A short label'}
                />
              ) : (
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={type === 'steps' ? 'Example: 6500' : 'Enter a value'}
                />
              )}
            </label>
            <label>
              Unit or context
              <input
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="kg, bpm, hours…"
              />
            </label>
          </div>
        )}
        {type !== 'wellbeing' &&
          type !== 'blood-pressure' &&
          !['custom', 'food', 'movement', 'medication', 'symptom', 'life-event'].includes(type) && (
            <label>
              Label{' '}
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Optional label"
              />
            </label>
          )}
        <label>
          Context{' '}
          <input
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="Optional: after dinner, at home, before training…"
          />
        </label>
        <label>
          Note{' '}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anything you want to remember"
            rows={2}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" onClick={() => void submit()}>
            {initial ? 'Save changes' : 'Save record'}
          </button>
        </div>
      </section>
    </div>
  )
}

function PatternsPage({
  captures,
  onDelete,
  onEdit,
}: {
  captures: CaptureEntry[]
  onDelete: (id: string) => Promise<void>
  onEdit: (entry: CaptureEntry) => Promise<void>
}) {
  const confirmDelete = useDeleteConfirmation()
  const [range, setRange] = useState<'7' | '30' | '90' | 'all'>('30')
  const [domain, setDomain] = useState<'all' | 'body' | 'mind' | 'life' | 'spiritual'>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<CaptureEntry>()
  const [sampleMode, setSampleMode] = useState(false)
  const [visibleSections, setVisibleSections] = useSectionVisibility('nxt-pattern-sections', [
    'filters',
    'sample',
    'summary',
    'charts',
    'signals',
  ])
  const [crossDomainAllowed, setCrossDomainAllowed] = useState(false)
  useEffect(() => {
    void consentRepository
      .list()
      .then((saved) =>
        setCrossDomainAllowed(
          saved.some(
            (preference) => preference.scope === 'cross-domain-analysis' && preference.granted,
          ),
        ),
      )
  }, [])
  const from = range === 'all' ? '' : new Date(Date.now() - Number(range) * 86400000).toISOString()
  const filtered = captures.filter(
    (entry) =>
      (!from || entry.occurredAt >= from) &&
      ((domain === 'all' && (crossDomainAllowed || captureDomain(entry) === 'body')) ||
        (domain !== 'all' && captureDomain(entry) === domain)) &&
      (!query || `${entry.title} ${entry.note ?? ''}`.toLowerCase().includes(query.toLowerCase())),
  )
  const numeric = filtered.filter((entry) => typeof entry.value === 'number')
  const metricTypes = Array.from(new Set(numeric.map((entry) => entry.type)))
  const chartTypes = metricTypes.filter((type) => numericSeries(filtered, type).length >= 2)
  const singleSignalTypes = metricTypes.filter((type) => numericSeries(filtered, type).length === 1)
  const activeDays = new Set(filtered.map((entry) => entry.occurredAt.slice(0, 10))).size
  const domainsInView = new Set(filtered.map(captureDomain)).size
  const sourcesInView = new Set(filtered.map((entry) => entry.source)).size
  return (
    <div className="page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Patterns</p>
          <h2>Notice what is changing.</h2>
          <p className="muted">
            Your entries can show things that changed around the same time. They do not prove why.
          </p>
        </div>
        <div className="pattern-count">{filtered.length} entries in view</div>
      </section>
      <PageFeatureCustomizer
        label="Patterns"
        title="Keep the comparisons that help you notice change."
        jumpAriaLabel="Pattern sections"
        jumpItems={
          [
            visibleSections.includes('filters') && ['pattern-controls', 'Filters'],
            visibleSections.includes('summary') &&
              filtered.length > 0 && ['pattern-overview', 'Summary'],
            visibleSections.includes('charts') &&
              chartTypes.length > 0 && ['pattern-charts', 'Charts'],
          ].filter(Boolean) as Array<[string, string]>
        }
        options={[
          ['filters', 'Filters'],
          ['sample', 'Sample preview'],
          ['summary', 'Summary'],
          ['charts', 'Charts'],
          ['signals', 'Early signals'],
        ]}
        visible={visibleSections}
        onToggle={(key) =>
          setVisibleSections((current) =>
            current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
          )
        }
      />
      {visibleSections.includes('filters') && (
        <section className="panel pattern-controls" id="pattern-controls">
          <div className="segmented-control">
            {(['7', '30', '90', 'all'] as const).map((option) => (
              <button
                key={option}
                aria-pressed={range === option}
                className={range === option ? 'active' : ''}
                onClick={() => setRange(option)}
              >
                {option === 'all' ? 'All' : `${option} days`}
              </button>
            ))}
          </div>
          <label>
            Domain
            <select
              aria-label="Pattern domain"
              value={domain}
              onChange={(event) => setDomain(event.target.value as typeof domain)}
            >
              <option value="all">All domains</option>
              <option value="body">Body</option>
              <option value="mind">Mind</option>
              <option value="life">Life</option>
              <option value="spiritual">Spiritual / connection</option>
            </select>
          </label>
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search entries"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search entries"
            />
          </label>
          <button
            className={`secondary-button sample-toggle ${sampleMode ? 'active' : ''}`}
            aria-pressed={sampleMode}
            onClick={() => setSampleMode((current) => !current)}
          >
            {sampleMode ? 'Hide sample preview' : 'Preview with sample data'}
          </button>
        </section>
      )}
      {!crossDomainAllowed && domain === 'all' && (
        <div className="notice">
          <CircleHelp size={18} />
          <span>
            Cross-domain analysis is off. Showing Body entries only; enable it in Settings when you
            want Patterns to compare domains.
          </span>
        </div>
      )}
      {visibleSections.includes('sample') && sampleMode && (
        <section className="panel pattern-sample-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Illustrative workspace</p>
              <h3>See how repeated signals become readable.</h3>
            </div>
            <span className="source-pill">Sample only</span>
          </div>
          <p className="muted compact-copy">
            These examples never enter your records or influence your insights. Turn this preview
            off whenever you want to return to your own data.
          </p>
          <div className="pattern-grid pattern-grid-sample">
            <PatternCard
              title="Sleep quality"
              points={[
                { date: '2026-09-22', value: 2 },
                { date: '2026-09-24', value: 3 },
                { date: '2026-09-26', value: 4 },
              ]}
            />
            <PatternCard
              title="Move minutes"
              points={[
                { date: '2026-09-22', value: 12 },
                { date: '2026-09-24', value: 24 },
                { date: '2026-09-26', value: 31 },
              ]}
            />
          </div>
        </section>
      )}
      {filtered.length === 0 ? (
        <section className="panel empty-pattern">
          <LineChart size={26} />
          <h3>Nothing to compare yet.</h3>
          <p className="muted">
            A missing day is simply missing information. Add what feels useful, when it feels
            useful.
          </p>
        </section>
      ) : (
        <>
          {visibleSections.includes('summary') && (
            <section className="panel pattern-overview" id="pattern-overview">
              <div className="pattern-summary-card">
                <span>Entries</span>
                <strong>{filtered.length}</strong>
                <small>in this view</small>
              </div>
              <div className="pattern-summary-card">
                <span>Active days</span>
                <strong>{activeDays}</strong>
                <small>with a record</small>
              </div>
              <div className="pattern-summary-card">
                <span>Signals</span>
                <strong>{metricTypes.length}</strong>
                <small>numeric types</small>
              </div>
              <div className="pattern-summary-card">
                <span>Sources</span>
                <strong>{sourcesInView}</strong>
                <small>
                  {domainsInView} domain{domainsInView === 1 ? '' : 's'}
                </small>
              </div>
            </section>
          )}
          {chartTypes.length > 0 ? (
            visibleSections.includes('charts') ? (
              <div
                className={`pattern-grid ${chartTypes.length === 1 ? 'pattern-grid-single' : ''}`}
                id="pattern-charts"
              >
                {chartTypes.slice(0, 6).map((type) => (
                  <PatternCard
                    key={type}
                    title={type.replaceAll('-', ' ')}
                    points={numericSeries(filtered, type)}
                  />
                ))}
              </div>
            ) : null
          ) : (
            <section className="panel pattern-next-step">
              <LineChart size={22} />
              <div>
                <h3>Patterns need repeated signals.</h3>
                <p className="muted">
                  You have context here, but not enough repeated numeric observations to draw a
                  trend. Keep recording what matters without forcing a conclusion.
                </p>
              </div>
              <div className="pattern-example">
                <p className="eyebrow">Illustrative preview</p>
                <h4>What a repeated signal will look like</h4>
                <PatternCard
                  title="Example trend"
                  points={[
                    { date: '2026-09-22', value: 72 },
                    { date: '2026-09-24', value: 71.6 },
                    { date: '2026-09-26', value: 71.2 },
                  ]}
                />
                <small>Example only. It is not calculated from your data.</small>
              </div>
            </section>
          )}
          {visibleSections.includes('signals') && singleSignalTypes.length > 0 && (
            <section className="panel single-signal-list">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Early signals</p>
                  <h3>One observation so far</h3>
                </div>
                <span className="source-pill">Not a trend</span>
              </div>
              <div className="single-signal-items">
                {singleSignalTypes.map((type) => {
                  const point = numericSeries(filtered, type)[0]
                  return (
                    <div className="single-signal-item" key={type}>
                      <strong>{type.replaceAll('-', ' ')}</strong>
                      <span>
                        {point.value} · {new Date(point.date).toLocaleDateString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Recent context</p>
                <h3>What you recorded</h3>
              </div>
              <span className="source-pill">Context only</span>
            </div>
            <div className="entry-list">
              {[...filtered]
                .reverse()
                .slice(0, 12)
                .map((entry) => (
                  <div className="entry-row" key={entry.id}>
                    <div className="entry-date">
                      <strong>{entry.title}</strong>
                      <span>
                        {new Date(entry.occurredAt).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}{' '}
                        · {entry.source}
                      </span>
                    </div>
                    <div className="entry-actions">
                      {entry.value !== undefined && entry.value !== null && (
                        <strong>
                          {entry.value} {entry.unit}
                        </strong>
                      )}
                      <button
                        className="icon-button"
                        onClick={() => setEditing(entry)}
                        aria-label={`Edit ${entry.title}`}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        className="icon-button danger"
                        onClick={async () => {
                          if (await confirmDelete('Delete this entry?')) await onDelete(entry.id)
                        }}
                        aria-label={`Delete ${entry.title}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}
      {editing && (
        <UniversalCapture
          initial={editing}
          onClose={() => setEditing(undefined)}
          onSave={async () => undefined}
          onUpdate={async (entry) => {
            await onEdit(entry)
            setEditing(undefined)
          }}
        />
      )}
    </div>
  )
}

function PatternCard({
  title,
  points,
}: {
  title: string
  points: Array<{ date: string; value: number }>
}) {
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const width = 260
  const height = 78
  const path = points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
      const y = max === min ? height / 2 : height - ((point.value - min) / (max - min)) * height
      return `${index ? 'L' : 'M'} ${x} ${y}`
    })
    .join(' ')
  return (
    <section className="panel pattern-card">
      <div className="panel-heading">
        <h3>{title}</h3>
        <span className="source-pill">{points.length} points</span>
      </div>
      {points.length < 2 ? (
        <p className="muted">One point so far. Keep the context, without forcing a conclusion.</p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${title} trend`}
            className="pattern-chart"
          >
            <path d={path} />
          </svg>
          <div className="pattern-stats">
            <span>
              Range {min.toFixed(1)}–{max.toFixed(1)}
            </span>
            <span>Latest {values.at(-1)?.toFixed(1)}</span>
          </div>
          <details className="chart-data-details">
            <summary>View recorded values</summary>
            <ul>
              {points.map((point) => (
                <li key={`${point.date}-${point.value}`}>
                  <span>{point.date}</span>
                  <strong>{point.value.toFixed(1)}</strong>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  )
}
