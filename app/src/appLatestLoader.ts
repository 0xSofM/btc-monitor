import type { IndicatorData, LatestData } from '@/types';
import type { DataSource } from './appDisplay';
import {
  fetchRuntimeLatestData,
  fetchStaticLatestData,
  getLatestFromHistory,
} from '@/services/dataService';

export type LatestLoadMode = 'auto' | 'manual';

export type LatestLoadToast = {
  type: 'success' | 'info';
  message: string;
  description?: string;
  duration?: number;
};

export type LatestLoadResult = {
  data: LatestData;
  source: DataSource;
  toast?: LatestLoadToast;
};

function buildRefreshSuccessToast(data: LatestData): LatestLoadToast {
  const score = data.totalScoreV6 ?? data.totalScoreV4 ?? data.signalScoreV2 ?? 0;
  const maxScore = data.maxTotalScoreV6 ?? data.maxTotalScoreV4 ?? data.maxSignalScoreV2 ?? 10;

  return {
    type: 'success',
    message: `最新数据已刷新：${score}/${maxScore}`,
    description: `BTC 价格：$${data.btcPrice.toLocaleString()}`,
    duration: 6000,
  };
}

function buildStaticFallbackToast(data: LatestData): LatestLoadToast {
  return {
    type: 'info',
    message: '实时数据暂不可用，已展示本地数据。',
    description: `BTC 价格：$${data.btcPrice.toLocaleString()}`,
    duration: 6000,
  };
}

export async function loadDashboardLatestData(
  mode: LatestLoadMode,
  loadHistoryFallback: () => Promise<IndicatorData[]>,
): Promise<LatestLoadResult> {
  const manual = mode === 'manual';

  const runtimeData = await fetchRuntimeLatestData();
  if (runtimeData) {
    return {
      data: runtimeData,
      source: 'api',
      toast: manual ? buildRefreshSuccessToast(runtimeData) : undefined,
    };
  }

  const staticData = await fetchStaticLatestData({
    enrichWithHistory: true,
    forceRefresh: manual,
  });
  if (staticData) {
    return {
      data: staticData,
      source: 'static',
      toast: manual ? buildStaticFallbackToast(staticData) : undefined,
    };
  }

  const history = await loadHistoryFallback();
  const backupData = getLatestFromHistory(history);
  if (backupData) {
    return {
      data: backupData,
      source: 'history',
      toast: manual
        ? {
            type: 'info',
            message: '最新数据暂不可用，已展示历史数据。',
          }
        : undefined,
    };
  }

  throw new Error('无可用最新数据');
}
