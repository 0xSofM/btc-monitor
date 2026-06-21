import type { IndicatorData, LatestData } from '@/types';

import { toFiniteNumber } from './normalizers';

export function toNumericPrice(value: number | string | undefined): number {
  return toFiniteNumber(value, 0);
}

export function getThresholdRange(
  thresholds: LatestData['thresholds'] | IndicatorData['thresholds'],
  key: string,
  fallbackTrigger: number,
  fallbackDeep: number,
): { trigger: number; deep: number } {
  const threshold = thresholds?.[key];

  return {
    trigger:
      typeof threshold?.trigger === 'number' && Number.isFinite(threshold.trigger)
        ? threshold.trigger
        : fallbackTrigger,
    deep:
      typeof threshold?.deep === 'number' && Number.isFinite(threshold.deep)
        ? threshold.deep
        : fallbackDeep,
  };
}
