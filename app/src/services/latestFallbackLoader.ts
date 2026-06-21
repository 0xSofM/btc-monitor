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
