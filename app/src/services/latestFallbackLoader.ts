import type { IndicatorData, LatestData } from '@/types';

import { enrichLatestWithOptionalHistory } from './latestDataLoader';

export function loadLocalLatestFallback({
  enrichWithHistory,
  readLocalLatest,
  readLocalHistory,
}: {
  enrichWithHistory: boolean;
  readLocalLatest: () => LatestData | null;
  readLocalHistory: () => IndicatorData[];
}): LatestData | null {
  const localLatest = readLocalLatest();
  if (!localLatest) {
    return null;
  }

  if (!enrichWithHistory) {
    return localLatest;
  }

  return enrichLatestWithOptionalHistory(localLatest, readLocalHistory());
}

export async function loadLatestFromHistoryFallback({
  timestamp,
  fetchHistory,
  getLatestFromHistory,
  rememberLatest,
}: {
  timestamp: number;
  fetchHistory: () => Promise<IndicatorData[]>;
  getLatestFromHistory: (history: IndicatorData[]) => LatestData | null;
  rememberLatest: (latest: LatestData, timestamp: number) => LatestData;
}): Promise<LatestData | null> {
  const history = await fetchHistory();
  const latest = getLatestFromHistory(history);
  if (!latest) {
    return null;
  }

  return rememberLatest(latest, timestamp);
}
