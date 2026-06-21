import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';

import type { IndicatorData } from '@/types';
import type { HistoryMode } from './appDisplay';
import { fetchHistoricalData } from '@/services/dataService';

export function useDashboardHistory() {
  const [historicalData, setHistoricalData] = useState<IndicatorData[]>([]);
  const [historyMode, setHistoryMode] = useState<HistoryMode>('none');
  const historyModeRef = useRef<HistoryMode>('none');
  const historyLoadingModesRef = useRef<Set<HistoryMode>>(new Set());
  const [historyLoadingModes, setHistoryLoadingModes] = useState<HistoryMode[]>([]);
  const deferredHistoricalData = useDeferredValue(historicalData);
  const isHistoryLoading = historyLoadingModes.length > 0;
  const isFullHistoryLoading = historyLoadingModes.includes('full');

  useEffect(() => {
    historyModeRef.current = historyMode;
  }, [historyMode]);

  const beginHistoryLoad = useCallback((mode: HistoryMode) => {
    historyLoadingModesRef.current.add(mode);
    setHistoryLoadingModes(Array.from(historyLoadingModesRef.current));
  }, []);

  const endHistoryLoad = useCallback((mode: HistoryMode) => {
    historyLoadingModesRef.current.delete(mode);
    setHistoryLoadingModes(Array.from(historyLoadingModesRef.current));
  }, []);

  const loadHistory = useCallback(async (forceRefresh = false, full = false) => {
    const targetMode: HistoryMode = full ? 'full' : 'light';
    if (
      !forceRefresh
      && historicalData.length > 0
      && (historyModeRef.current === targetMode || historyModeRef.current === 'full')
    ) {
      return historicalData;
    }

    if (
      historyLoadingModesRef.current.has(targetMode)
      || (targetMode === 'light' && historyLoadingModesRef.current.has('full'))
    ) {
      return historicalData;
    }

    beginHistoryLoad(targetMode);
    try {
      const data = await fetchHistoricalData({ forceRefresh, full });
      if (data.length > 0) {
        if (targetMode === 'full' || historyModeRef.current !== 'full') {
          historyModeRef.current = targetMode;
          setHistoricalData(data);
          setHistoryMode(targetMode);
        }
      }
      return data;
    } catch (err) {
      console.error('Error loading history:', err);
      return historicalData;
    } finally {
      endHistoryLoad(targetMode);
    }
  }, [beginHistoryLoad, endHistoryLoad, historicalData]);

  const loadHistoryFallback = useCallback(async () => {
    if (historicalData.length > 0) {
      return historicalData;
    }

    return loadHistory(false, false);
  }, [historicalData, loadHistory]);

  return {
    historicalData,
    setHistoricalData,
    historyMode,
    deferredHistoricalData,
    isHistoryLoading,
    isFullHistoryLoading,
    loadHistory,
    loadHistoryFallback,
  };
}
