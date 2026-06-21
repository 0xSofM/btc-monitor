import type { IndicatorData } from '@/types';

import type { HistoryMode } from './contracts';
import type { HistoryRequestPlan, LoadedHistoryRows } from './historyDataLoader';
import { fetchHistoryRows } from './historyDataLoader';

type HistoryFallbackLoaderOptions = {
  plan: HistoryRequestPlan;
  cachedHistory: IndicatorData[];
  cacheHistoryMode: HistoryMode;
  mergeLatestIntoRows: (rows: IndicatorData[]) => IndicatorData[];
  rememberHistory: (
    history: IndicatorData[],
    mode: Exclude<HistoryMode, 'none'>,
  ) => IndicatorData[];
};

export type HistoryFallbackResult = {
  history: IndicatorData[];
  loaded: boolean;
};

export async function loadHistoryWithFallbacks({
  plan,
  cachedHistory,
  cacheHistoryMode,
  mergeLatestIntoRows,
  rememberHistory,
}: HistoryFallbackLoaderOptions): Promise<HistoryFallbackResult> {
  try {
    const loaded = await fetchHistoryRows(plan.primaryPath, plan.primaryTimeoutMs, plan.mode);
    const history = mergeLatestIntoRows(loaded.rows);
    if (plan.mode === 'light' && cacheHistoryMode === 'full') {
      return {
        history: cachedHistory,
        loaded: true,
      };
    }

    return {
      history: rememberLoadedHistory(loaded, history, rememberHistory),
      loaded: true,
    };
  } catch (error) {
    console.error(`[DataService] Error fetching historical data (${plan.primaryPath}):`, error);
  }

  try {
    const loaded = await fetchHistoryRows(plan.fallbackPath, plan.fallbackTimeoutMs, 'full');
    const history = mergeLatestIntoRows(loaded.rows);
    return {
      history: rememberLoadedHistory(loaded, history, rememberHistory),
      loaded: true,
    };
  } catch (fallbackError) {
    console.error(`[DataService] Error fetching fallback historical data (${plan.fallbackPath}):`, fallbackError);
  }

  if (plan.legacyFullPath && plan.legacyFullTimeoutMs) {
    try {
      const loaded = await fetchHistoryRows(plan.legacyFullPath, plan.legacyFullTimeoutMs, 'full');
      const history = mergeLatestIntoRows(loaded.rows);
      return {
        history: rememberLoadedHistory(loaded, history, rememberHistory),
        loaded: true,
      };
    } catch (fallbackError) {
      console.error(`[DataService] Error fetching fallback full historical data (${plan.legacyFullPath}):`, fallbackError);
    }
  }

  return {
    history: [],
    loaded: false,
  };
}

function rememberLoadedHistory(
  loaded: LoadedHistoryRows,
  history: IndicatorData[],
  rememberHistory: HistoryFallbackLoaderOptions['rememberHistory'],
): IndicatorData[] {
  return rememberHistory(history, loaded.mode);
}
