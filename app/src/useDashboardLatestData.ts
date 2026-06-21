import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import type { IndicatorData, LatestData } from '@/types';
import { mergeLatestIntoHistory } from '@/services/dataService';
import { buildDataTimestampLabel, type DataSource } from './appDisplay';
import {
  loadDashboardLatestData,
  type LatestLoadMode,
  type LatestLoadToast,
} from './appLatestLoader';

type UseDashboardLatestDataOptions = {
  loadHistoryFallback: () => Promise<IndicatorData[]>;
  loadStrategyMnav: (forceRefresh?: boolean) => Promise<unknown>;
  setHistoricalData: Dispatch<SetStateAction<IndicatorData[]>>;
};

function showLatestToast(latestToast: LatestLoadToast | undefined) {
  if (!latestToast) {
    return;
  }

  const options = {
    description: latestToast.description,
    duration: latestToast.duration,
  };

  if (latestToast.type === 'success') {
    toast.success(latestToast.message, options);
    return;
  }

  toast.info(latestToast.message, options);
}

export function useDashboardLatestData({
  loadHistoryFallback,
  loadStrategyMnav,
  setHistoricalData,
}: UseDashboardLatestDataOptions) {
  const [latestData, setLatestData] = useState<LatestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataTimestampLabel, setDataTimestampLabel] = useState('-');
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('static');
  const loadHistoryFallbackRef = useRef(loadHistoryFallback);
  const loadStrategyMnavRef = useRef(loadStrategyMnav);
  const mountedRef = useRef(true);

  useEffect(() => {
    loadHistoryFallbackRef.current = loadHistoryFallback;
    loadStrategyMnavRef.current = loadStrategyMnav;
  }, [loadHistoryFallback, loadStrategyMnav]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyLatestData = useCallback((data: LatestData, source: DataSource) => {
    setLatestData(data);
    setDataSource(source);
    setDataTimestampLabel(buildDataTimestampLabel(data, source));
    setHistoricalData((currentHistory) => (
      currentHistory.length > 0
        ? mergeLatestIntoHistory(currentHistory, data)
        : currentHistory
    ));
  }, [setHistoricalData]);

  const refreshLatestData = useCallback(async (mode: LatestLoadMode = 'auto') => {
    if (!mountedRef.current) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      void loadStrategyMnavRef.current(mode === 'manual');

      const latestResult = await loadDashboardLatestData(mode, loadHistoryFallbackRef.current);
      if (!mountedRef.current) {
        return;
      }

      applyLatestData(latestResult.data, latestResult.source);
      showLatestToast(latestResult.toast);
    } catch (err) {
      console.error('Error fetching data:', err);
      if (mountedRef.current) {
        setError('数据加载失败，请检查连接后重试。');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [applyLatestData]);

  return {
    latestData,
    loading,
    error,
    dataSource,
    dataTimestampLabel,
    refreshLatestData,
  };
}
