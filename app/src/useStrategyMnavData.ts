import { useCallback, useEffect, useState } from 'react';

import type { StrategyMnavData } from '@/types';
import { fetchStrategyMnavData } from '@/services/dataService';

export function useStrategyMnavData() {
  const [strategyMnavData, setStrategyMnavData] = useState<StrategyMnavData | null>(null);

  const loadStrategyMnav = useCallback(async (forceRefresh = false) => {
    const data = await fetchStrategyMnavData(forceRefresh);
    if (data) {
      setStrategyMnavData(data);
    }
    return data;
  }, []);

  useEffect(() => {
    let active = true;

    void fetchStrategyMnavData(false).then((data) => {
      if (active && data) {
        setStrategyMnavData(data);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return {
    strategyMnavData,
    loadStrategyMnav,
  };
}
