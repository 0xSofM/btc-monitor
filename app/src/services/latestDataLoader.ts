import type { IndicatorData, LatestData } from '@/types';

import {
  fetchRuntimeLatestRaw,
  fetchStaticLatestRaw,
} from './apiClient';
import { normalizeLatestData } from './normalizers';
import { enrichLatestDataWithHistory } from './selectors';

export function enrichLatestWithOptionalHistory(
  latest: LatestData,
  history: IndicatorData[],
): LatestData {
  return history.length > 0
    ? enrichLatestDataWithHistory(latest, history)
    : latest;
}

export async function loadStaticLatestData(
  history: IndicatorData[],
  enrichWithHistory: boolean,
): Promise<LatestData> {
  const raw = await fetchStaticLatestRaw();
  const normalized = normalizeLatestData(raw);
  if (!normalized) {
    throw new Error('Invalid latest static data format');
  }

  return enrichWithHistory
    ? enrichLatestWithOptionalHistory(normalized, history)
    : normalized;
}

export async function loadRuntimeLatestData(
  history: IndicatorData[],
): Promise<LatestData> {
  const raw = await fetchRuntimeLatestRaw();
  const normalized = normalizeLatestData(raw);
  if (!normalized) {
    throw new Error('Invalid runtime latest data format');
  }

  return enrichLatestWithOptionalHistory(normalized, history);
}
