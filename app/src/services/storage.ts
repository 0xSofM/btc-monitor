import type { IndicatorData, LatestData } from '@/types';

import { normalizeIndicatorData, normalizeLatestData } from './normalizers';
import { CORE_HISTORY_FIELDS } from './schema';
import { enrichLatestDataWithHistory, getLatestFromHistory } from './selectors';
import {
  asRecord,
  buildStoredEnvelope,
  getStorage,
  readStoredValue,
  removeStoredValue,
  writeStoredValue,
} from './storageEnvelope';

const HISTORY_KEY = 'btc_indicators_history';
const LATEST_KEY = 'btc_indicators_latest';
const MAX_PERSISTED_HISTORY_ROWS = 900;

const storageWarnings = {
  latestQuota: false,
  historyQuota: false,
  latestWriteFailure: false,
  historyWriteFailure: false,
  historyParseFailure: false,
  latestParseFailure: false,
};

function warnStorageOnce(
  key: keyof typeof storageWarnings,
  message: string,
  error?: unknown,
): void {
  if (storageWarnings[key]) {
    return;
  }

  storageWarnings[key] = true;
  if (error === undefined) {
    console.warn(message);
    return;
  }

  console.warn(message, error);
}

function compactHistoryRow(row: IndicatorData): IndicatorData {
  const compact: IndicatorData = { d: row.d };
  const compactRecord = compact as unknown as Record<string, unknown>;

  for (const field of CORE_HISTORY_FIELDS) {
    const value = row[field];
    if (value !== undefined && value !== null) {
      compactRecord[field] = value;
    }
  }

  return compact;
}

function buildHistoryRowLimits(totalRows: number): number[] {
  if (totalRows <= 0) {
    return [];
  }

  // Keep local history as a recent fallback; full history remains in memory after loading.
  const targetRows = Math.min(totalRows, MAX_PERSISTED_HISTORY_ROWS);
  const limits = new Set<number>([targetRows]);
  let current = targetRows;

  while (current > 365) {
    current = Math.floor(current / 2);
    if (current > 365) {
      limits.add(current);
    }
  }

  [365, 180, 90, 30].forEach((limit) => {
    limits.add(Math.min(totalRows, limit));
  });

  return Array.from(limits)
    .filter((limit) => limit > 0)
    .sort((left, right) => right - left);
}

function persistLatest(storage: Storage, latest: LatestData): void {
  const payload = JSON.stringify(buildStoredEnvelope(latest));

  const initialWrite = writeStoredValue(storage, LATEST_KEY, payload);
  if (initialWrite.ok) {
    return;
  }

  if (initialWrite.quotaExceeded) {
    removeStoredValue(storage, HISTORY_KEY);
    removeStoredValue(storage, LATEST_KEY);

    const retryWrite = writeStoredValue(storage, LATEST_KEY, payload);
    if (retryWrite.ok) {
      return;
    }

    warnStorageOnce(
      'latestQuota',
      '[Storage] Latest cache was skipped because browser storage quota is exhausted.',
      retryWrite.error,
    );
    return;
  }

  warnStorageOnce(
    'latestWriteFailure',
    '[Storage] Failed to save latest cache; continuing without local latest persistence.',
    initialWrite.error,
  );
}

function persistHistory(storage: Storage, history: IndicatorData[]): void {
  if (history.length === 0) {
    removeStoredValue(storage, HISTORY_KEY);
    return;
  }

  const limits = buildHistoryRowLimits(history.length);

  for (const limit of limits) {
    const rows = history.slice(-limit).map(compactHistoryRow);
    const payload = JSON.stringify(buildStoredEnvelope(rows, {
      storedRows: rows.length,
      truncated: rows.length < history.length,
    }));

    const result = writeStoredValue(storage, HISTORY_KEY, payload);
    if (result.ok) {
      return;
    }

    if (!result.quotaExceeded) {
      warnStorageOnce(
        'historyWriteFailure',
        '[Storage] Failed to save history cache; continuing without local history persistence.',
        result.error,
      );
      return;
    }
  }

  removeStoredValue(storage, HISTORY_KEY);
  warnStorageOnce(
    'historyQuota',
    '[Storage] History cache was skipped because browser storage quota is limited.',
  );
}

export function getLocalData(): IndicatorData[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  try {
    const stored = readStoredValue(storage, HISTORY_KEY);
    const candidate = Array.isArray(stored?.data) ? stored.data as unknown[] : [];

    return candidate
      .map((item) => normalizeIndicatorData(item))
      .filter((item): item is IndicatorData => item !== null);
  } catch (error) {
    warnStorageOnce(
      'historyParseFailure',
      '[Storage] Failed to parse local history cache; ignoring cached history.',
      error,
    );
    return [];
  }
}

export function getLocalLatestData(): LatestData | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const stored = readStoredValue(storage, LATEST_KEY);
    if (!stored) {
      return null;
    }

    const candidate = asRecord(stored.data) ?? stored.parsed;

    const normalized = normalizeLatestData(candidate);
    if (!normalized) {
      return null;
    }

    const localHistory = getLocalData();
    return enrichLatestDataWithHistory(normalized, localHistory);
  } catch (error) {
    warnStorageOnce(
      'latestParseFailure',
      '[Storage] Failed to parse local latest cache; ignoring cached latest data.',
      error,
    );
    return null;
  }
}

export function saveLocalData(data: { history?: IndicatorData[]; latest?: LatestData }): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (data.latest) {
    persistLatest(storage, data.latest);
  }

  if (data.history) {
    persistHistory(storage, data.history);
  }
}

export function validateLocalDataConsistency(): {
  historyValid: boolean;
  latestValid: boolean;
  needsSync: boolean;
} {
  const history = getLocalData();
  const latest = getLocalLatestData() ?? getLatestFromHistory(history);

  const historyValid = Array.isArray(history);
  const latestValid = latest !== null;

  let needsSync = false;
  if (history.length > 0 && latest) {
    const lastHistoryDate = history[history.length - 1]?.d;
    needsSync = lastHistoryDate !== latest.date;
  }

  return {
    historyValid,
    latestValid,
    needsSync,
  };
}
