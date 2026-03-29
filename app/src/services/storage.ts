import type { IndicatorData, LatestData } from '@/types';

import { normalizeIndicatorData, normalizeLatestData } from './normalizers';
import { enrichLatestDataWithHistory, getLatestFromHistory } from './selectors';

const DATA_VERSION = 'v1.1.0';
const HISTORY_KEY = 'btc_indicators_history';
const LATEST_KEY = 'btc_indicators_latest';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function getLocalData(): IndicatorData[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = localStorage.getItem(HISTORY_KEY);
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
    console.error('Error parsing local history data:', error);
    return [];
  }
}

export function getLocalLatestData(): LatestData | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = localStorage.getItem(LATEST_KEY);
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
    console.error('Error parsing local latest data:', error);
    return null;
  }
}

export function saveLocalData(data: { history?: IndicatorData[]; latest?: LatestData }): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    if (data.history) {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify({
          version: DATA_VERSION,
          timestamp: Date.now(),
          data: data.history,
        }),
      );
    }

    if (data.latest) {
      localStorage.setItem(
        LATEST_KEY,
        JSON.stringify({
          version: DATA_VERSION,
          timestamp: Date.now(),
          data: data.latest,
        }),
      );
    }
  } catch (error) {
    console.error('Error saving local data:', error);
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
