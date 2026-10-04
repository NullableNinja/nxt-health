import Dexie, { type Table } from 'dexie'
import type {
  ConsentPreference,
  CaptureEntry,
  BodyPhotoEntry,
  DashboardConfiguration,
  DreamJournalEntry,
  ExerciseEntry,
  Food,
  FoodLogEntry,
  FastingSchedule,
  PersonalWorkout,
  Goal,
  HealthMetricEntry,
  LifeEvent,
  MedicationLog,
  MedicationSchedule,
  Profile,
  SleepSession,
  NormalizedHealthRecord,
  IntegrationConnection,
  IntegrationSyncState,
  IntegrationSyncRun,
  SourcePreference,
  WellbeingEntry,
  WeightEntry,
} from '../domain/models'

export class HealthDatabase extends Dexie {
  profiles!: Table<Profile, string>
  goals!: Table<Goal, string>
  weights!: Table<WeightEntry, string>
  healthMetrics!: Table<HealthMetricEntry, string>
  foods!: Table<Food, string>
  foodLogs!: Table<FoodLogEntry, string>
  exercises!: Table<ExerciseEntry, string>
  wellbeingEntries!: Table<WellbeingEntry, string>
  lifeEvents!: Table<LifeEvent, string>
  consentPreferences!: Table<ConsentPreference, string>
  captures!: Table<CaptureEntry, string>
  dashboardConfigs!: Table<DashboardConfiguration, string>
  bodyPhotos!: Table<BodyPhotoEntry, string>
  medications!: Table<MedicationSchedule, string>
  medicationLogs!: Table<MedicationLog, string>
  sleepSessions!: Table<SleepSession, string>
  dreamJournalEntries!: Table<DreamJournalEntry, string>
  healthRecords!: Table<NormalizedHealthRecord, string>
  integrationConnections!: Table<IntegrationConnection, string>
  integrationSyncStates!: Table<IntegrationSyncState, string>
  integrationSyncRuns!: Table<IntegrationSyncRun, string>
  sourcePreferences!: Table<SourcePreference, string>
  fastingSchedules!: Table<FastingSchedule, string>
  personalWorkouts!: Table<PersonalWorkout, string>

  constructor() {
    super('health-intelligence')
    this.version(1).stores({
      profiles: 'id, updatedAt',
      goals: 'id, active, kind',
      weights: 'id, date',
      foods: 'id, name, barcode, source',
      foodLogs: 'id, date, foodId, meal',
      exercises: 'id, date, activityType',
    })
    this.version(2).stores({
      profiles: 'id, updatedAt',
      goals: 'id, active, kind',
      weights: 'id, date',
      foods: 'id, name, barcode, source',
      foodLogs: 'id, date, foodId, meal',
      exercises: 'id, date, activityType',
      wellbeingEntries: 'id, date, source',
      lifeEvents: 'id, startDate, kind',
      consentPreferences: 'id, scope, granted',
      healthMetrics: 'id, date, kind, source',
    })
    this.version(3).stores({
      profiles: 'id, updatedAt',
      goals: 'id, active, kind',
      weights: 'id, date',
      foods: 'id, name, barcode, source',
      foodLogs: 'id, date, foodId, meal',
      exercises: 'id, date, activityType',
      wellbeingEntries: 'id, date, source',
      lifeEvents: 'id, startDate, kind',
      consentPreferences: 'id, scope, granted',
      healthMetrics: 'id, date, kind, source',
      captures: 'id, type, occurredAt, source',
    })
    this.version(4).stores({
      profiles: 'id, updatedAt',
      goals: 'id, active, kind',
      weights: 'id, date',
      foods: 'id, name, barcode, source',
      foodLogs: 'id, date, foodId, meal',
      exercises: 'id, date, activityType',
      wellbeingEntries: 'id, date, source',
      lifeEvents: 'id, startDate, kind',
      consentPreferences: 'id, scope, granted',
      healthMetrics: 'id, date, kind, source',
      captures: 'id, type, occurredAt, source',
      dashboardConfigs: 'id, updatedAt',
      bodyPhotos: 'id, date, createdAt',
    })
    this.version(5).stores({
      profiles: 'id, updatedAt',
      goals: 'id, active, kind',
      weights: 'id, date',
      foods: 'id, name, barcode, source',
      foodLogs: 'id, date, foodId, meal',
      exercises: 'id, date, activityType',
      wellbeingEntries: 'id, date, source',
      lifeEvents: 'id, startDate, kind',
      consentPreferences: 'id, scope, granted',
      healthMetrics: 'id, date, kind, source',
      captures: 'id, type, occurredAt, source',
      dashboardConfigs: 'id, updatedAt',
      bodyPhotos: 'id, date, createdAt',
      medications: 'id, active, reminderEnabled, updatedAt',
      medicationLogs: 'id, medicationId, scheduledDate, status',
    })
    this.version(6).stores({
      profiles: 'id, updatedAt',
      goals: 'id, active, kind',
      weights: 'id, date',
      foods: 'id, name, barcode, source',
      foodLogs: 'id, date, foodId, meal',
      exercises: 'id, date, activityType',
      wellbeingEntries: 'id, date, source',
      lifeEvents: 'id, startDate, kind',
      consentPreferences: 'id, scope, granted',
      healthMetrics: 'id, date, kind, source',
      captures: 'id, type, occurredAt, source',
      dashboardConfigs: 'id, updatedAt',
      bodyPhotos: 'id, date, createdAt',
      medications: 'id, active, reminderEnabled, updatedAt',
      medicationLogs: 'id, medicationId, scheduledDate, status',
      sleepSessions: 'id, date, kind, source, createdAt',
    })
    this.version(7).stores({
      profiles: 'id, updatedAt',
      goals: 'id, active, kind',
      weights: 'id, date',
      foods: 'id, name, barcode, source',
      foodLogs: 'id, date, foodId, meal',
      exercises: 'id, date, activityType',
      wellbeingEntries: 'id, date, source',
      lifeEvents: 'id, startDate, kind',
      consentPreferences: 'id, scope, granted',
      healthMetrics: 'id, date, kind, source',
      captures: 'id, type, occurredAt, source',
      dashboardConfigs: 'id, updatedAt',
      bodyPhotos: 'id, date, createdAt',
      medications: 'id, active, reminderEnabled, updatedAt',
      medicationLogs: 'id, medicationId, scheduledDate, status',
      sleepSessions: 'id, date, kind, source, createdAt',
      dreamJournalEntries: 'id, date, sleepSessionId, createdAt',
      healthRecords: 'id, domain, kind, metric, localDate, dedupeKey, startAt',
      integrationConnections: 'id, provider, status, updatedAt',
      integrationSyncStates: 'id, connectionId, provider, updatedAt',
      integrationSyncRuns: 'id, connectionId, provider, outcome, startedAt',
      sourcePreferences: 'id, domain, metric, updatedAt',
    })
    this.version(8).stores({
      profiles: 'id, updatedAt',
      goals: 'id, active, kind',
      weights: 'id, date',
      foods: 'id, name, barcode, source',
      foodLogs: 'id, date, foodId, meal',
      exercises: 'id, date, activityType',
      wellbeingEntries: 'id, date, source',
      lifeEvents: 'id, startDate, kind',
      consentPreferences: 'id, scope, granted',
      healthMetrics: 'id, date, kind, source',
      captures: 'id, type, occurredAt, source',
      dashboardConfigs: 'id, updatedAt',
      bodyPhotos: 'id, date, createdAt',
      medications: 'id, active, reminderEnabled, updatedAt, reference.externalId',
      medicationLogs: 'id, medicationId, scheduledDate, status',
      sleepSessions: 'id, date, kind, source, createdAt',
      dreamJournalEntries: 'id, date, sleepSessionId, createdAt',
      healthRecords: 'id, domain, kind, metric, localDate, dedupeKey, startAt',
      integrationConnections: 'id, provider, status, updatedAt',
      integrationSyncStates: 'id, connectionId, provider, updatedAt',
      integrationSyncRuns: 'id, connectionId, provider, outcome, startedAt',
      sourcePreferences: 'id, domain, metric, updatedAt',
    })
    this.version(9).stores({
      profiles: 'id, updatedAt',
      goals: 'id, active, kind',
      weights: 'id, date',
      foods: 'id, name, barcode, source',
      foodLogs: 'id, date, foodId, meal',
      exercises: 'id, date, activityType',
      wellbeingEntries: 'id, date, source',
      lifeEvents: 'id, startDate, kind',
      consentPreferences: 'id, scope, granted',
      healthMetrics: 'id, date, kind, source',
      captures: 'id, type, occurredAt, source',
      dashboardConfigs: 'id, updatedAt',
      bodyPhotos: 'id, date, createdAt',
      medications: 'id, active, reminderEnabled, updatedAt, reference.externalId',
      medicationLogs: 'id, medicationId, scheduledDate, status',
      sleepSessions: 'id, date, kind, source, createdAt',
      dreamJournalEntries: 'id, date, sleepSessionId, createdAt',
      healthRecords: 'id, domain, kind, metric, localDate, dedupeKey, startAt',
      integrationConnections: 'id, provider, status, updatedAt',
      integrationSyncStates: 'id, connectionId, provider, updatedAt',
      integrationSyncRuns: 'id, connectionId, provider, outcome, startedAt',
      sourcePreferences: 'id, domain, metric, updatedAt',
      fastingSchedules: 'id, enabled, updatedAt',
    })
    this.version(10).stores({
      profiles: 'id, updatedAt',
      goals: 'id, active, kind',
      weights: 'id, date',
      foods: 'id, name, barcode, source',
      foodLogs: 'id, date, foodId, meal',
      exercises: 'id, date, activityType',
      wellbeingEntries: 'id, date, source',
      lifeEvents: 'id, startDate, kind',
      consentPreferences: 'id, scope, granted',
      healthMetrics: 'id, date, kind, source',
      captures: 'id, type, occurredAt, source',
      dashboardConfigs: 'id, updatedAt',
      bodyPhotos: 'id, date, createdAt',
      medications: 'id, active, reminderEnabled, updatedAt, reference.externalId',
      medicationLogs: 'id, medicationId, scheduledDate, status',
      sleepSessions: 'id, date, kind, source, createdAt',
      dreamJournalEntries: 'id, date, sleepSessionId, createdAt',
      healthRecords: 'id, domain, kind, metric, localDate, dedupeKey, startAt',
      integrationConnections: 'id, provider, status, updatedAt',
      integrationSyncStates: 'id, connectionId, provider, updatedAt',
      integrationSyncRuns: 'id, connectionId, provider, outcome, startedAt',
      sourcePreferences: 'id, domain, metric, updatedAt',
      fastingSchedules: 'id, enabled, updatedAt',
      personalWorkouts: 'id, name, category, updatedAt',
    })
  }
}

export const db = new HealthDatabase()

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function removeDemoFoods(): Promise<void> {
  await db.foods.where('source').equals('demo').delete()
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.profiles.clear(),
    db.goals.clear(),
    db.weights.clear(),
    db.healthMetrics.clear(),
    db.foods.clear(),
    db.foodLogs.clear(),
    db.exercises.clear(),
    db.wellbeingEntries.clear(),
    db.lifeEvents.clear(),
    db.consentPreferences.clear(),
    db.captures.clear(),
    db.dashboardConfigs.clear(),
    db.bodyPhotos.clear(),
    db.medications.clear(),
    db.medicationLogs.clear(),
    db.sleepSessions.clear(),
    db.dreamJournalEntries.clear(),
    db.healthRecords.clear(),
    db.integrationConnections.clear(),
    db.integrationSyncStates.clear(),
    db.integrationSyncRuns.clear(),
    db.sourcePreferences.clear(),
    db.fastingSchedules.clear(),
    db.personalWorkouts.clear(),
  ])
}
