export type ID = string

export type UnitSystem = 'metric' | 'imperial'
export type SexForEquation = 'female' | 'male' | 'unspecified'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra'
export type SupportStyle = 'gentle' | 'direct' | 'reflective'
export type HealthDomain = 'body' | 'mind' | 'behavior' | 'environment' | 'spiritual'
export type SexAssignedAtBirth = 'female' | 'male' | 'intersex' | 'not-listed' | 'prefer-not-to-say'
export type GenderIdentity =
  | 'woman'
  | 'man'
  | 'non-binary'
  | 'genderqueer'
  | 'questioning'
  | 'self-described'
  | 'prefer-not-to-say'
export type PronounPreference =
  | 'she-her'
  | 'he-him'
  | 'they-them'
  | 'she-they'
  | 'he-they'
  | 'use-my-name'
  | 'custom'
  | 'prefer-not-to-say'
export type GoalKind =
  | 'lose-weight'
  | 'gain-weight'
  | 'maintain-weight'
  | 'build-muscle'
  | 'nutrition'
  | 'activity'
  | 'cardio'
  | 'sleep'
  | 'understand-mood'
  | 'manage-stress'
  | 'understand-anxiety'
  | 'track-symptoms'
  | 'understand-medication'
  | 'spiritual-practice'
  | 'connection'
  | 'purpose'
  | 'overall-health'
  | 'understand-data'
  | 'custom'

export type LifeEventKind =
  | 'therapy-started'
  | 'medication-change'
  | 'relationship-change'
  | 'bereavement'
  | 'injury'
  | 'surgery'
  | 'substance-change'
  | 'recovery-milestone'
  | 'move'
  | 'job-change'
  | 'diagnosis'
  | 'parenthood'
  | 'exercise-change'
  | 'custom'

export type ConsentScope =
  | 'cloud-sync'
  | 'ai-general'
  | 'ai-sensitive-data'
  | 'cross-domain-analysis'
  | 'health-data-import'
  | 'provider-lookups'

export type DataSource = 'manual' | 'screening' | 'imported' | 'device' | 'provider' | 'derived'
export type IntegrationProviderId =
  | 'android-health-connect'
  | 'google-health-api'
  | 'fitbit'
  | 'garmin'
  | 'samsung-health'
  | 'myfitnesspal'
  | 'strava'
  | 'withings'
  | 'oura'
  | 'polar'
  | 'cronometer'
  | 'lose-it'
  | 'file-import'

export type IntegrationStatus =
  | 'ready'
  | 'needs-configuration'
  | 'approval-required'
  | 'android-required'
  | 'connected'
  | 'error'
  | 'unsupported'
  | 'disconnected'

export type HealthRecordDomain =
  | 'body'
  | 'activity'
  | 'cardiovascular'
  | 'sleep'
  | 'nutrition'
  | 'respiratory'
  | 'recovery'
  | 'wellness'
  | 'other'

export type HealthRecordKind =
  | 'measurement'
  | 'daily-summary'
  | 'activity'
  | 'sleep-session'
  | 'nutrition-entry'
  | 'symptom'
  | 'wellness-observation'
  | 'imported-document'
  | 'derived-insight'

export type HealthRecordUnit =
  | 'count'
  | 'steps'
  | 'minutes'
  | 'hours'
  | 'kilometers'
  | 'meters'
  | 'kilograms'
  | 'percent'
  | 'bpm'
  | 'kcal'
  | 'grams'
  | 'millimeters-of-mercury'
  | 'millimoles-per-liter'
  | 'text'
  | 'unknown'

export interface SourceProvenance {
  source: DataSource
  provider?: IntegrationProviderId
  externalRecordId?: string
  externalVersion?: string
  deviceName?: string
  sourceApp?: string
  importedAt?: string
  rawReference?: string
  timezone?: string
}

export interface NormalizedHealthRecord {
  id: ID
  domain: HealthRecordDomain
  kind: HealthRecordKind
  metric: string
  value?: number
  unit?: HealthRecordUnit
  text?: string
  startAt: string
  endAt?: string
  localDate: string
  provenance: SourceProvenance
  tags?: string[]
  metadata?: Record<string, string | number | boolean | null>
  isDerived?: boolean
  dedupeKey: string
  createdAt: string
  updatedAt: string
}

export interface IntegrationConnection {
  id: ID
  provider: IntegrationProviderId
  status: IntegrationStatus
  accountLabel?: string
  externalAccountId?: string
  scopes: string[]
  dataTypes: string[]
  connectedAt?: string
  lastVerifiedAt?: string
  disconnectedAt?: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

export interface IntegrationSyncState {
  id: ID
  connectionId: ID
  provider: IntegrationProviderId
  resource: string
  cursor?: string
  lastSuccessfulSyncAt?: string
  lastAttemptedSyncAt?: string
  nextSyncAt?: string
  consecutiveFailures: number
  recordsSeen: number
  recordsAdded: number
  recordsUpdated: number
  duplicatesSkipped: number
  lastError?: string
  updatedAt: string
}

export type IntegrationSyncTrigger = 'initial' | 'incremental' | 'manual' | 'retry' | 'background'
export type IntegrationSyncOutcome = 'running' | 'succeeded' | 'partial' | 'failed'

export interface IntegrationSyncRun {
  id: ID
  connectionId: ID
  provider: IntegrationProviderId
  resource: string
  trigger: IntegrationSyncTrigger
  outcome: IntegrationSyncOutcome
  startedAt: string
  finishedAt?: string
  durationMs?: number
  recordsSeen: number
  recordsAdded: number
  recordsUpdated: number
  duplicatesSkipped: number
  errors: string[]
  cursorBefore?: string
  cursorAfter?: string
}

export interface SourcePreference {
  id: ID
  metric: string
  domain: HealthRecordDomain
  providerOrder: IntegrationProviderId[]
  preferManual: boolean
  updatedAt: string
}

export interface ProviderCapability {
  provider: IntegrationProviderId
  label: string
  status: IntegrationStatus
  delivery: 'cloud' | 'android' | 'ios' | 'file'
  auth: 'oauth2' | 'native-permission' | 'file-import' | 'none'
  reads: string[]
  writes: string[]
  requiresCredentials: boolean
  requiresApproval: boolean
  notes: string
  officialDocsUrl: string
}
export type SleepSessionKind = 'primary' | 'nap'
export type SleepSource = 'manual' | 'health-connect' | 'wearable' | 'imported' | 'other'
export type SleepQuality = 1 | 2 | 3 | 4 | 5
export type DashboardCardId =
  | 'overview'
  | 'energy'
  | 'nutrition'
  | 'measurements'
  | 'trajectory'
  | 'insight'
  | 'quick-actions'
  | 'movement'
  | 'movement-minutes'
  | 'movement-steps'
  | 'movement-intensity'
  | 'check-in'
  | 'reflection'
  | 'sleep'
  | 'sleep-last'
  | 'sleep-average'
  | 'sleep-consistency'

export type DashboardModuleSize = 'compact' | 'standard' | 'wide'

export interface DashboardConfiguration {
  id: 'today'
  visible: DashboardCardId[]
  order?: DashboardCardId[]
  sizes?: Partial<Record<DashboardCardId, DashboardModuleSize>>
  updatedAt: string
}

export interface SleepStage {
  stage: 'awake' | 'light' | 'deep' | 'rem'
  startAt: string
  endAt: string
}

export interface SleepSession {
  id: ID
  date: string
  kind: SleepSessionKind
  startAt: string
  endAt: string
  durationMinutes: number
  timeInBedMinutes?: number
  quality?: SleepQuality
  rested?: SleepQuality
  awakenings?: number
  notes?: string
  source: SleepSource
  stages?: SleepStage[]
  createdAt: string
  updatedAt: string
}

export interface DreamJournalEntry {
  id: ID
  sleepSessionId?: ID
  date: string
  title?: string
  content: string
  tags?: string[]
  privacy: 'private'
  source: 'manual'
  createdAt: string
  updatedAt: string
}

export interface BodyPhotoEntry {
  id: ID
  date: string
  journalDate?: string
  dataUrl: string
  note?: string
  pose?: 'front' | 'side' | 'back' | 'custom'
  associatedWeightKg?: number
  createdAt: string
}

export type CaptureType =
  | 'weight'
  | 'metric'
  | 'blood-pressure'
  | 'heart-rate'
  | 'oxygen-saturation'
  | 'steps'
  | 'glucose'
  | 'cholesterol'
  | 'a1c'
  | 'hdl-cholesterol'
  | 'ldl-cholesterol'
  | 'triglycerides'
  | 'food'
  | 'movement'
  | 'wellbeing'
  | 'sleep'
  | 'medication'
  | 'symptom'
  | 'life-event'
  | 'custom'

export type CaptureValue = string | number | boolean | null

export interface CaptureEntry {
  id: ID
  type: CaptureType
  occurredAt: string
  title: string
  value?: CaptureValue
  unit?: string
  source: DataSource
  context?: string
  note?: string
  payload?: Record<string, CaptureValue>
  createdAt: string
  updatedAt: string
}

export type HealthMetricKind =
  | 'blood-pressure'
  | 'waist-circumference'
  | 'hip-circumference'
  | 'body-fat-percentage'
  | 'resting-heart-rate'
  | 'systolic-blood-pressure'
  | 'diastolic-blood-pressure'
  | 'fasting-glucose'
  | 'a1c'
  | 'oxygen-saturation'
  | 'steps'
  | 'total-cholesterol'
  | 'hdl-cholesterol'
  | 'ldl-cholesterol'
  | 'triglycerides'
  | 'custom'

export interface Profile {
  id: ID
  displayName: string
  avatarDataUrl?: string
  headline?: string
  bio?: string
  occupation?: string
  location?: string
  birthDate?: string
  age?: number
  sexAssignedAtBirth?: SexAssignedAtBirth
  genderIdentity?: GenderIdentity
  pronouns?: PronounPreference
  customPronouns?: string
  sexForEquation: SexForEquation
  heightCm?: number
  unitSystem: UnitSystem
  activityLevel: ActivityLevel
  supportStyle?: SupportStyle
  typicalSteps?: number
  timezone?: string
  locale?: string
  preferredMovement?: string
  preferredNutritionPattern?: string
  sleepPreference?: string
  accessibilityNeeds?: string[]
  dataDisplay?: 'simple' | 'detailed'
  todayFocus?: HealthDomain[]
  myDayIntentions?: string[]
  createdAt: string
  updatedAt: string
}

export interface FastingSchedule {
  id: ID
  enabled: boolean
  fastingStart: string
  eatingStart: string
  reminderEnabled: boolean
  reminderMinutesBefore: number
  createdAt: string
  updatedAt: string
}

export interface PersonalWorkout {
  id: ID
  name: string
  category: string
  defaultDurationMinutes: number
  intensity: 'easy' | 'moderate' | 'hard'
  estimatedCalories?: number
  note?: string
  createdAt: string
  updatedAt: string
}

export interface Goal {
  id: ID
  kind: GoalKind
  label: string
  domains?: HealthDomain[]
  why?: string
  priority?: 'low' | 'medium' | 'high'
  reviewDate?: string
  targetWeightKg?: number
  targetDate?: string
  active: boolean
  createdAt: string
}

export interface WeightEntry {
  id: ID
  date: string
  weightKg: number
  source: 'manual' | 'imported' | 'measured'
  note?: string
}

export interface HealthMetricEntry {
  id: ID
  date: string
  kind: HealthMetricKind
  label: string
  value: number
  unit: string
  compoundValues?: { systolic: number; diastolic: number }
  source: Extract<DataSource, 'manual' | 'screening' | 'imported'>
  note?: string
  createdAt: string
}

export type MedicationFrequency =
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'custom'
  | 'as-needed'
export type MedicationLogStatus = 'taken' | 'skipped'

export interface MedicationReferenceSource {
  provider: string
  recordId?: string
  url?: string
  retrievedAt?: string
  version?: string
}

export interface MedicationReference {
  externalId?: string
  ingredient?: string
  strength?: string
  form?: string
  route?: string
  source?: MedicationReferenceSource
}

export interface MedicationSchedule {
  id: ID
  name: string
  dose: string
  frequency: MedicationFrequency
  times: string[]
  daysOfWeek?: number[]
  instructions?: string
  reminderEnabled: boolean
  active: boolean
  createdAt: string
  updatedAt: string
  reference?: MedicationReference
  /** 0 = Sunday through 6 = Saturday, used by weekly schedules. */
  dayOfWeek?: number
  /** Calendar day used by monthly schedules. Values above a month's length use its last day. */
  dayOfMonth?: number
  /** Optional self-entered supply context. This is a planning aid, not a refill order. */
  supplyRemaining?: number
  refillAt?: number
}

export interface MedicationLog {
  id: ID
  medicationId: ID
  scheduledDate: string
  scheduledTime: string
  status: MedicationLogStatus
  loggedAt: string
  note?: string
}

export interface Food {
  id: ID
  name: string
  brand?: string
  barcode?: string
  servingLabel: string
  servingGrams?: number
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  source: 'user-entered' | 'usda' | 'open-food-facts' | 'manufacturer' | 'demo'
  sourceId?: string
  verifiedAt?: string
  confidence: 'high' | 'moderate' | 'low'
}

export interface FoodLogEntry {
  id: ID
  date: string
  foodId: ID
  foodName: string
  meal: string
  servings: number
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
}

export interface ExerciseEntry {
  id: ID
  date: string
  activityType: string
  durationMinutes: number
  intensity: 'easy' | 'moderate' | 'hard'
  distanceKm?: number
  steps?: number
  flightsClimbed?: number
  averageHeartRate?: number
  estimatedCalories?: number
  note?: string
}

/**
 * A self-reported observation, not a clinical score or diagnosis.
 * The UI should preserve the individual signals and avoid collapsing them into a health score.
 */
export interface WellbeingEntry {
  id: ID
  date: string
  journalEntryId?: ID
  mood?: number
  anxiety?: number
  stress?: number
  energy?: number
  motivation?: number
  sleepQuality?: number
  focus?: number
  bodyTension?: number
  note?: string
  source: Extract<DataSource, 'manual' | 'imported'>
  createdAt: string
}

export interface LifeEvent {
  id: ID
  kind: LifeEventKind
  title: string
  startDate: string
  endDate?: string
  domains: HealthDomain[]
  note?: string
  createdAt: string
  updatedAt: string
}

export interface ConsentPreference {
  id: ID
  scope: ConsentScope
  granted: boolean
  updatedAt: string
}

export interface DailyNutrition {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
}

export interface MetabolicEstimate {
  method: string
  valueKcal: number
  source: 'equation' | 'measured' | 'ensemble'
  explanation: string
}

export interface MetabolicSummary {
  rmr: MetabolicEstimate[]
  ensembleRmr?: MetabolicEstimate
  estimatedTdee?: number
  calorieTarget?: number
  practicalRange?: [number, number]
}
