import type { IndicatorData } from '@/types';

import {
  STATIC_HISTORY_FULL_LIGHT_PATH,
  STATIC_HISTORY_FULL_PATH,
  STATIC_HISTORY_LIGHT_PATH,
  fetchStaticHistoryRaw,
} from './apiClient';
import type { HistoryMode } from './contracts';
import { normalizeIndicatorData } from './normalizers';

export const HISTORY_LIGHT_TIMEOUT_MS = 30000;
export const HISTORY_FULL_TIMEOUT_MS = 120000;

export interface HistoryRequestPlan {
  mode: Exclude<HistoryMode, 'none'>;
  primaryPath: string;
  primaryTimeoutMs: number;
  fallbackPath: string;
  fallbackTimeoutMs: number;
  legacyFullPath?: string;
  legacyFullTimeoutMs?: number;
}

export interface LoadedHistoryRows {
  rows: IndicatorData[];
  mode: Exclude<HistoryMode, 'none'>;
  path: string;
}

export function buildHistoryRequestPlan(full: boolean): HistoryRequestPlan {
  return {
    mode: full ? 'full' : 'light',
    primaryPath: full ? STATIC_HISTORY_FULL_LIGHT_PATH : STATIC_HISTORY_LIGHT_PATH,
    primaryTimeoutMs: full ? HISTORY_FULL_TIMEOUT_MS : HISTORY_LIGHT_TIMEOUT_MS,
    fallbackPath: full ? STATIC_HISTORY_FULL_PATH : STATIC_HISTORY_FULL_LIGHT_PATH,
    fallbackTimeoutMs: full ? HISTORY_FULL_TIMEOUT_MS : HISTORY_LIGHT_TIMEOUT_MS,
    legacyFullPath: full ? undefined : STATIC_HISTORY_FULL_PATH,
    legacyFullTimeoutMs: full ? undefined : HISTORY_FULL_TIMEOUT_MS,
  };
}

export function hasUsableCachedHistory(
  currentMode: HistoryMode,
  requestedMode: Exclude<HistoryMode, 'none'>,
  rowCount: number,
): boolean {
  return rowCount > 0 && (currentMode === requestedMode || currentMode === 'full');
}

export function normalizeHistoryRows(rawRows: unknown[]): IndicatorData[] {
  return rawRows
    .map((item) => normalizeIndicatorData(item))
    .filter((item): item is IndicatorData => item !== null)
    .sort((left, right) => left.d.localeCompare(right.d));
}

export async function fetchHistoryRows(
  path: string,
  timeoutMs: number,
  mode: Exclude<HistoryMode, 'none'>,
): Promise<LoadedHistoryRows> {
  const raw = await fetchStaticHistoryRaw(path, timeoutMs);
  return {
    rows: normalizeHistoryRows(raw),
    mode,
    path,
  };
}
