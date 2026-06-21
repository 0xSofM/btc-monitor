import { useState } from 'react';

import type { IndicatorType, TIME_RANGES } from './indicatorChartUtils';
import { RANGE_DAYS } from './indicatorChartUtils';

type TimeRangeKey = (typeof TIME_RANGES)[number]['key'];

type ActivateIndicatorOptions = {
  expandDetail?: boolean;
  shouldRequestFullHistory?: boolean;
  onRequestFullHistory?: () => Promise<void> | void;
};

export function useIndicatorChartState() {
  const [activeIndicator, setActiveIndicator] = useState<IndicatorType>('priceMa200w');
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [hasRequestedFullHistory, setHasRequestedFullHistory] = useState(false);
  const [showThresholds, setShowThresholds] = useState(true);
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>('all');
  const [brushStartIndex, setBrushStartIndex] = useState(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  const [brushKey, setBrushKey] = useState(0);

  const resetRange = () => {
    setSelectedRange('all');
    setBrushStartIndex(0);
    setBrushEndIndex(undefined);
    setBrushKey((prev) => prev + 1);
  };

  const activateIndicator = (
    indicator: IndicatorType,
    {
      expandDetail = false,
      shouldRequestFullHistory = false,
      onRequestFullHistory,
    }: ActivateIndicatorOptions = {},
  ) => {
    setActiveIndicator(indicator);
    resetRange();

    if (!expandDetail) {
      return;
    }

    setIsDetailExpanded(true);
    if (shouldRequestFullHistory) {
      setHasRequestedFullHistory(true);
      void onRequestFullHistory?.();
    }
  };

  const selectTimeRange = (rangeKey: TimeRangeKey, totalPoints: number) => {
    if (!totalPoints) {
      return;
    }

    const days = RANGE_DAYS[rangeKey];
    const startIndex = rangeKey === 'all' ? 0 : Math.max(0, totalPoints - days);

    setSelectedRange(rangeKey);
    setBrushStartIndex(startIndex);
    setBrushEndIndex(totalPoints - 1);
    setBrushKey((prev) => prev + 1);
  };

  const handleBrushChange = (range: { startIndex?: number; endIndex?: number } | null | undefined) => {
    if (!range) {
      return;
    }

    if (typeof range.startIndex === 'number') {
      setBrushStartIndex(range.startIndex);
    }

    if (typeof range.endIndex === 'number') {
      setBrushEndIndex(range.endIndex);
    }
  };

  return {
    activeIndicator,
    isDetailExpanded,
    hasRequestedFullHistory,
    showThresholds,
    selectedRange,
    brushStartIndex,
    brushEndIndex,
    brushKey,
    activateIndicator,
    selectTimeRange,
    resetRange,
    handleBrushChange,
    setShowThresholds,
    setIsDetailExpanded,
  };
}
