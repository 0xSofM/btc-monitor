import type { IndicatorData, LatestData } from '@/types';

import { normalizeIndicatorData, normalizeLatestData } from './normalizers';
import { enrichLatestDataWithHistory, getLatestFromHistory } from './selectors';

const DATA_VERSION = 'v1.2.0';
const HISTORY_KEY = 'btc_indicators_history';
const LATEST_KEY = 'btc_indicators_latest';

const HISTORY_STORAGE_FIELDS: Array<keyof IndicatorData> = [
  'unixTs',
  'btcPrice',
  'priceMa200wRatio',
  'priceRealizedRatio',
  'ma200w',
  'realizedPrice',
  'reserveRisk',
  'mvrvZscore',
  'lthMvrv',
  'sthSopr',
  'sthMvrv',
  'puellMultiple',
  'signalPriceMa200w',
  'signalPriceMa',
  'signalPriceRealized',
  'signalReserveRisk',
  'signalReserveRiskV4',
  'signalMvrvZscoreCore',
  'signalSthSopr',
  'signalSthMvrv',
  'signalSthGroup',
  'signalLthMvrv',
  'signalSthSoprAux',
  'signalPuell',
  'signalCount',
  'signalCountV4',
  'activeIndicatorCount',
  'activeIndicatorCountV4',
  'maxSignalScoreV2',
  'scoreMvrvZscoreCore',
  'signalScoreV2',
  'signalScoreV2Min3d',
  'signalConfirmed3d',
  'valuationScore',
  'maxValuationScore',
  'triggerScore',
  'maxTriggerScore',
  'confirmationScore',
  'maxConfirmationScore',
  'auxiliaryScore',
  'maxAuxiliaryScore',
  'totalScoreV4',
  'maxTotalScoreV4',
  'totalScoreV4Min3d',
  'signalConfirmed3dV4',
  'signalConfidence',
  'dataFreshnessScore',
];

const storageWarnings = {
  latestQuota: false,
  historyQuota: false,
  latestWriteFailure: false,
  historyWriteFailure: false,
  historyParseFailure: false,
  latestParseFailure: false,
};

type StoredEnvelope<T> = {
  version: string;
  timestamp: number;
  data: T;
  truncated?: boolean;
  storedRows?: number;
};

type WriteResult = {
  ok: boolean;
  quotaExceeded: boolean;
  error?: unknown;
};

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

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

function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const name = 'name' in error && typeof error.name === 'string' ? error.name : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const code = 'code' in error && typeof error.code === 'number' ? error.code : 0;

  return (
    name === 'QuotaExceededError'
    || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || code === 22
    || code === 1014
    || /quota|storage.*full|exceeded the quota/i.test(message)
  );
}

function removeStoredValue(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures; cache persistence is best-effort only.
  }
}

function writeStoredValue(storage: Storage, key: string, value: string): WriteResult {
  try {
    storage.setItem(key, value);
    return {
      ok: true,
      quotaExceeded: false,
    };
  } catch (error) {
    return {
      ok: false,
      quotaExceeded: isQuotaExceededError(error),
      error,
    };
  }
}

function compactHistoryRow(row: IndicatorData): IndicatorData {
  const compact: IndicatorData = { d: row.d };
  const compactRecord = compact as unknown as Record<string, unknown>;

  for (const field of HISTORY_STORAGE_FIELDS) {
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

  const limits = new Set<number>([totalRows]);
  let current = totalRows;

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
  const payload = JSON.stringify({
    version: DATA_VERSION,
    timestamp: Date.now(),
    data: latest,
  } satisfies StoredEnvelope<LatestData>);

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
    const payload = JSON.stringify({
      version: DATA_VERSION,
      timestamp: Date.now(),
      storedRows: rows.length,
      truncated: rows.length < history.length,
      data: rows,
    } satisfies StoredEnvelope<IndicatorData[]>);

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
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    const candidate = (
      parsed &&
      typeof parsed === 'object' &&
      'data' in (parsed as Record<string, unknown>) &&
      Array.isArray((parsed as Record<string, unknown>).data)
    )
      ? ((parsed as Record<string, unknown>).data as unknown[])
      : (Array.isArray(parsed) ? parsed : []);

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
    const raw = storage.getItem(LATEST_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    const candidate = (
      parsed &&
      typeof parsed === 'object' &&
      'data' in (parsed as Record<string, unknown>) &&
      (parsed as Record<string, unknown>).data &&
      typeof (parsed as Record<string, unknown>).data === 'object'
    )
      ? (parsed as Record<string, unknown>).data
      : parsed;

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
