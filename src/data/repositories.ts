import { db, newId } from './db'
import type {
  BodyPhotoEntry,
  CaptureEntry,
  ConsentPreference,
  DashboardConfiguration,
  DreamJournalEntry,
  ExerciseEntry,
  FastingSchedule,
  PersonalWorkout,
  Food,
  FoodLogEntry,
  Goal,
  HealthMetricEntry,
  LifeEvent,
  MedicationLog,
  MedicationSchedule,
  Profile,
  SleepSession,
  IntegrationConnection,
  IntegrationProviderId,
  IntegrationSyncRun,
  IntegrationSyncState,
  NormalizedHealthRecord,
  SourcePreference,
  WellbeingEntry,
  WeightEntry,
} from '../domain/models'

export const profileRepository = {
  get: () => db.profiles.toCollection().first(),
  save: (profile: Profile) => db.profiles.put(profile),
}

export const goalRepository = {
  listActive: async () => (await db.goals.toArray()).filter((goal) => goal.active),
  list: async () =>
    (await db.goals.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  save: (goal: Goal) => db.goals.put(goal),
}

export const weightRepository = {
  list: () => db.weights.orderBy('date').toArray(),
  add: (entry: Omit<WeightEntry, 'id'>) => db.weights.add({ ...entry, id: newId() }),
  remove: (id: string) => db.weights.delete(id),
}

export const dashboardRepository = {
  get: () => db.dashboardConfigs.get('today'),
  save: (configuration: DashboardConfiguration) => db.dashboardConfigs.put(configuration),
}

export const bodyPhotoRepository = {
  list: () => db.bodyPhotos.orderBy('date').toArray(),
  add: (entry: Omit<BodyPhotoEntry, 'id'>) => db.bodyPhotos.add({ ...entry, id: newId() }),
  remove: (id: string) => db.bodyPhotos.delete(id),
}

export const healthMetricRepository = {
  list: () => db.healthMetrics.orderBy('date').toArray(),
  listForDate: (date: string) => db.healthMetrics.where('date').equals(date).toArray(),
  add: (entry: Omit<HealthMetricEntry, 'id'>) => db.healthMetrics.add({ ...entry, id: newId() }),
  update: (entry: HealthMetricEntry) => db.healthMetrics.put(entry),
  remove: (id: string) => db.healthMetrics.delete(id),
}

export const captureRepository = {
  list: () => db.captures.orderBy('occurredAt').toArray(),
  listBetween: async (from: string, to: string) =>
    (await db.captures.orderBy('occurredAt').toArray()).filter(
      (entry) => entry.occurredAt >= from && entry.occurredAt <= to,
    ),
  add: (entry: Omit<CaptureEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString()
    return db.captures.add({ ...entry, id: newId(), createdAt: now, updatedAt: now })
  },
  update: (entry: CaptureEntry) =>
    db.captures.put({ ...entry, updatedAt: new Date().toISOString() }),
  remove: (id: string) => db.captures.delete(id),
}

export const foodRepository = {
  list: () => db.foods.orderBy('name').toArray(),
  search: async (query: string) => {
    const normalized = query.trim().toLowerCase()
    const foods = await db.foods.orderBy('name').toArray()
    return normalized
      ? foods.filter((food) =>
          `${food.name} ${food.brand ?? ''}`.toLowerCase().includes(normalized),
        )
      : foods
  },
  save: (food: Food) => db.foods.put(food),
  remove: (id: string) => db.foods.delete(id),
}

export const foodLogRepository = {
  listForDate: (date: string) => db.foodLogs.where('date').equals(date).toArray(),
  list: () => db.foodLogs.orderBy('date').toArray(),
  add: (entry: Omit<FoodLogEntry, 'id'>) => db.foodLogs.add({ ...entry, id: newId() }),
  remove: (id: string) => db.foodLogs.delete(id),
}

export const fastingScheduleRepository = {
  get: () => db.fastingSchedules.toCollection().first(),
  save: (schedule: FastingSchedule) => db.fastingSchedules.put(schedule),
  remove: (id: string) => db.fastingSchedules.delete(id),
}

export const personalWorkoutRepository = {
  list: () => db.personalWorkouts.orderBy('updatedAt').reverse().toArray(),
  save: (workout: PersonalWorkout) => db.personalWorkouts.put(workout),
  remove: (id: string) => db.personalWorkouts.delete(id),
}

export const exerciseRepository = {
  list: () => db.exercises.orderBy('date').toArray(),
  listForDate: (date: string) => db.exercises.where('date').equals(date).toArray(),
  add: (entry: Omit<ExerciseEntry, 'id'>) => db.exercises.add({ ...entry, id: newId() }),
}

export const wellbeingRepository = {
  list: () => db.wellbeingEntries.orderBy('date').toArray(),
  listForDate: (date: string) => db.wellbeingEntries.where('date').equals(date).toArray(),
  add: (entry: Omit<WellbeingEntry, 'id'>) => db.wellbeingEntries.add({ ...entry, id: newId() }),
  remove: (id: string) => db.wellbeingEntries.delete(id),
}

export const medicationRepository = {
  list: () => db.medications.orderBy('updatedAt').reverse().toArray(),
  listByExternalId: (externalId: string) =>
    db.medications.where('reference.externalId').equals(externalId).toArray(),
  save: (entry: MedicationSchedule) => db.medications.put(entry),
  remove: (id: string) => db.medications.delete(id),
  listLogsForDate: (date: string) =>
    db.medicationLogs.where('scheduledDate').equals(date).toArray(),
  listLogs: () => db.medicationLogs.orderBy('scheduledDate').reverse().toArray(),
  addLog: (entry: Omit<MedicationLog, 'id'>) => db.medicationLogs.add({ ...entry, id: newId() }),
}

export const sleepRepository = {
  list: () => db.sleepSessions.orderBy('date').toArray(),
  listRecent: async (limit = 30) =>
    (await db.sleepSessions.orderBy('date').reverse().limit(limit).toArray()).reverse(),
  listForDate: (date: string) => db.sleepSessions.where('date').equals(date).toArray(),
  add: (entry: Omit<SleepSession, 'id'>) => db.sleepSessions.add({ ...entry, id: newId() }),
  update: (entry: SleepSession) => db.sleepSessions.put(entry),
  remove: (id: string) => db.sleepSessions.delete(id),
}

export const dreamJournalRepository = {
  list: () => db.dreamJournalEntries.orderBy('date').reverse().toArray(),
  listForDate: (date: string) => db.dreamJournalEntries.where('date').equals(date).toArray(),
  save: (entry: DreamJournalEntry) => db.dreamJournalEntries.put(entry),
  remove: (id: string) => db.dreamJournalEntries.delete(id),
}

export const healthRecordRepository = {
  list: () => db.healthRecords.orderBy('startAt').toArray(),
  listForDate: (date: string) => db.healthRecords.where('localDate').equals(date).toArray(),
  listByProvider: (provider: IntegrationProviderId) =>
    db.healthRecords.filter((record) => record.provenance.provider === provider).toArray(),
  save: (record: NormalizedHealthRecord) => db.healthRecords.put(record),
  bulkSave: (records: NormalizedHealthRecord[]) => db.healthRecords.bulkPut(records),
  remove: (id: string) => db.healthRecords.delete(id),
}

export const integrationConnectionRepository = {
  list: () => db.integrationConnections.orderBy('updatedAt').reverse().toArray(),
  get: (id: string) => db.integrationConnections.get(id),
  getByProvider: async (provider: IntegrationProviderId) =>
    db.integrationConnections.where('provider').equals(provider).first(),
  save: (connection: IntegrationConnection) => db.integrationConnections.put(connection),
  remove: (id: string) => db.integrationConnections.delete(id),
}

export const integrationSyncStateRepository = {
  getForConnection: async (connectionId: string, resource?: string) => {
    const states = await db.integrationSyncStates
      .where('connectionId')
      .equals(connectionId)
      .toArray()
    return states.find((state) => resource === undefined || state.resource === resource)
  },
  save: (state: IntegrationSyncState) => db.integrationSyncStates.put(state),
}

export const integrationSyncRunRepository = {
  listRecent: (limit = 50) =>
    db.integrationSyncRuns.orderBy('startedAt').reverse().limit(limit).toArray(),
  listForConnection: (connectionId: string) =>
    db.integrationSyncRuns.where('connectionId').equals(connectionId).toArray(),
  save: (run: IntegrationSyncRun) => db.integrationSyncRuns.put(run),
}

export const sourcePreferenceRepository = {
  list: () => db.sourcePreferences.orderBy('domain').toArray(),
  get: async (domain: SourcePreference['domain'], metric: string) =>
    (await db.sourcePreferences.where('domain').equals(domain).toArray()).find(
      (preference) => preference.metric === metric,
    ),
  save: (preference: SourcePreference) => db.sourcePreferences.put(preference),
}

export const lifeEventRepository = {
  list: () => db.lifeEvents.orderBy('startDate').toArray(),
  save: (event: LifeEvent) => db.lifeEvents.put(event),
  remove: (id: string) => db.lifeEvents.delete(id),
}

export const consentRepository = {
  list: () => db.consentPreferences.orderBy('scope').toArray(),
  save: (preference: ConsentPreference) => db.consentPreferences.put(preference),
}
