import { newId } from './db'
import {
  healthRecordRepository,
  integrationSyncRunRepository,
  integrationSyncStateRepository,
} from './repositories'
import {
  dedupeHealthRecords,
  normalizeProviderRecord,
  nextSyncBackoffMs,
  type ProviderRecordInput,
} from '../domain/integrations'
import type {
  IntegrationConnection,
  IntegrationSyncRun,
  IntegrationSyncState,
  NormalizedHealthRecord,
  SourcePreference,
} from '../domain/models'

export interface ProviderPage<TRaw> {
  records: TRaw[]
  nextCursor?: string
  complete: boolean
}

export interface IntegrationAdapter<TRaw> {
  provider: IntegrationConnection['provider']
  resource: string
  readPage(input: {
    cursor?: string
    mode: IntegrationSyncRun['trigger']
  }): Promise<ProviderPage<TRaw>>
  normalize(raw: TRaw, fetchedAt: string): ProviderRecordInput
}

export interface SyncEngineOptions {
  connection: IntegrationConnection
  adapter: IntegrationAdapter<unknown>
  trigger?: IntegrationSyncRun['trigger']
  preferences?: SourcePreference[]
  maxPages?: number
}

export interface SyncEngineResult {
  run: IntegrationSyncRun
  state: IntegrationSyncState
}

function emptyState(
  connection: IntegrationConnection,
  resource: string,
  now: string,
): IntegrationSyncState {
  return {
    id: `${connection.id}:${resource}`,
    connectionId: connection.id,
    provider: connection.provider,
    resource,
    consecutiveFailures: 0,
    recordsSeen: 0,
    recordsAdded: 0,
    recordsUpdated: 0,
    duplicatesSkipped: 0,
    updatedAt: now,
  }
}

export async function syncIntegration(options: SyncEngineOptions): Promise<SyncEngineResult> {
  const startedAt = new Date().toISOString()
  const trigger = options.trigger ?? 'manual'
  const maxPages = Math.max(1, options.maxPages ?? 100)
  const previous = await integrationSyncStateRepository.getForConnection(
    options.connection.id,
    options.adapter.resource,
  )
  const initialState =
    previous ?? emptyState(options.connection, options.adapter.resource, startedAt)
  const run: IntegrationSyncRun = {
    id: newId(),
    connectionId: options.connection.id,
    provider: options.connection.provider,
    resource: options.adapter.resource,
    trigger,
    outcome: 'running',
    startedAt,
    recordsSeen: 0,
    recordsAdded: 0,
    recordsUpdated: 0,
    duplicatesSkipped: 0,
    errors: [],
    cursorBefore: initialState.cursor,
  }
  await integrationSyncRunRepository.save(run)

  let state: IntegrationSyncState = {
    ...initialState,
    lastAttemptedSyncAt: startedAt,
  }
  let cursor = initialState.cursor
  let pages = 0
  let completed = false
  const normalized: NormalizedHealthRecord[] = []

  try {
    while (pages < maxPages) {
      const page = await options.adapter.readPage({ cursor, mode: trigger })
      pages += 1
      const fetchedAt = new Date().toISOString()
      normalized.push(
        ...page.records.map((raw) =>
          // Adapter normalization is intentionally the only provider-specific step.
          // The engine owns the rest of the lifecycle.
          normalizeWithProvider(options.adapter.normalize(raw, fetchedAt)),
        ),
      )
      run.recordsSeen += page.records.length

      if (page.complete || !page.nextCursor) {
        completed = true
        break
      }
      if (page.nextCursor === cursor) throw new Error('Provider returned a repeated sync cursor')
      cursor = page.nextCursor
    }

    if (pages >= maxPages && cursor && !completed)
      throw new Error('Provider exceeded the sync page limit')

    const deduped = dedupeHealthRecords(normalized, options.preferences)
    run.duplicatesSkipped = deduped.duplicatesSkipped
    const existing = await healthRecordRepository.listByProvider(options.connection.provider)
    const existingByKey = new Map(existing.map((record) => [record.dedupeKey, record]))
    run.recordsAdded = deduped.records.filter(
      (record) => !existingByKey.has(record.dedupeKey),
    ).length
    run.recordsUpdated = deduped.records.length - run.recordsAdded
    await healthRecordRepository.bulkSave(deduped.records)

    const finishedAt = new Date().toISOString()
    run.outcome = 'succeeded'
    run.finishedAt = finishedAt
    run.durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
    run.cursorAfter = cursor
    state = {
      ...state,
      cursor,
      lastSuccessfulSyncAt: finishedAt,
      consecutiveFailures: 0,
      recordsSeen: state.recordsSeen + run.recordsSeen,
      recordsAdded: state.recordsAdded + run.recordsAdded,
      recordsUpdated: state.recordsUpdated + run.recordsUpdated,
      duplicatesSkipped: state.duplicatesSkipped + run.duplicatesSkipped,
      lastError: undefined,
      updatedAt: finishedAt,
    }
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const message = error instanceof Error ? error.message : 'Integration sync failed'
    run.outcome = normalized.length > 0 ? 'partial' : 'failed'
    run.finishedAt = finishedAt
    run.durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
    run.errors = [message]

    // Preserve valid pages fetched before a later provider page fails.
    if (normalized.length > 0) {
      const deduped = dedupeHealthRecords(normalized, options.preferences)
      const existing = await healthRecordRepository.listByProvider(options.connection.provider)
      const existingByKey = new Map(existing.map((record) => [record.dedupeKey, record]))
      run.duplicatesSkipped = deduped.duplicatesSkipped
      run.recordsAdded = deduped.records.filter(
        (record) => !existingByKey.has(record.dedupeKey),
      ).length
      run.recordsUpdated = deduped.records.length - run.recordsAdded
      await healthRecordRepository.bulkSave(deduped.records)
    }
    if (pages > 0) run.cursorAfter = cursor

    state = {
      ...state,
      cursor: pages > 0 ? cursor : state.cursor,
      consecutiveFailures: state.consecutiveFailures + 1,
      nextSyncAt: new Date(Date.now() + nextSyncBackoffMs(state.consecutiveFailures)).toISOString(),
      lastError: message,
      recordsSeen: state.recordsSeen + run.recordsSeen,
      recordsAdded: state.recordsAdded + run.recordsAdded,
      recordsUpdated: state.recordsUpdated + run.recordsUpdated,
      duplicatesSkipped: state.duplicatesSkipped + run.duplicatesSkipped,
      updatedAt: finishedAt,
    }
  }

  await Promise.all([
    integrationSyncRunRepository.save(run),
    integrationSyncStateRepository.save(state),
  ])
  return { run, state }
}

function normalizeWithProvider(input: ProviderRecordInput): NormalizedHealthRecord {
  return normalizeProviderRecord(input)
}
