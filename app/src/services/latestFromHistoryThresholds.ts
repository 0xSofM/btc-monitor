import type { IndicatorData, LatestData } from '@/types';

import {
  DEFAULT_DEEP_THRESHOLDS,
  DEFAULT_THRESHOLDS,
} from './indicatorConfig';
import { toFiniteNumber } from './normalizers';

export function toNumericPrice(value: number | string | undefined): number {
  return toFiniteNumber(value, 0);
}

function getThresholdRange(
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

export function getLatestHistoryThresholds(thresholds: IndicatorData['thresholds']) {
  return {
    priceMa200w: getThresholdRange(
      thresholds,
      'priceMa200wRatio',
      DEFAULT_THRESHOLDS.priceMa200w,
      DEFAULT_DEEP_THRESHOLDS.priceMa200w,
    ),
    priceRealized: getThresholdRange(
      thresholds,
      'priceRealizedRatio',
      DEFAULT_THRESHOLDS.priceRealized,
      DEFAULT_DEEP_THRESHOLDS.priceRealized,
    ),
    reserveRisk: getThresholdRange(
      thresholds,
      'reserveRisk',
      DEFAULT_THRESHOLDS.reserveRisk,
      DEFAULT_DEEP_THRESHOLDS.reserveRisk,
    ),
    mvrvZscore: getThresholdRange(
      thresholds,
      'mvrvZscoreCore',
      DEFAULT_THRESHOLDS.mvrvZscore,
      DEFAULT_DEEP_THRESHOLDS.mvrvZscore,
    ),
    nupl: getThresholdRange(
      thresholds,
      'nuplCore',
      DEFAULT_THRESHOLDS.nupl,
      DEFAULT_DEEP_THRESHOLDS.nupl,
    ),
    sthSopr: getThresholdRange(
      thresholds,
      'sthSopr',
      DEFAULT_THRESHOLDS.sthSopr,
      DEFAULT_DEEP_THRESHOLDS.sthSopr,
    ),
    sthMvrv: getThresholdRange(
      thresholds,
      'sthMvrv',
      DEFAULT_THRESHOLDS.sthMvrv,
      DEFAULT_DEEP_THRESHOLDS.sthMvrv,
    ),
    lthMvrv: getThresholdRange(
      thresholds,
      'lthMvrv',
      DEFAULT_THRESHOLDS.lthMvrv,
      DEFAULT_DEEP_THRESHOLDS.lthMvrv,
    ),
    lthSopr: getThresholdRange(
      thresholds,
      'lthSopr',
      DEFAULT_THRESHOLDS.lthSopr,
      DEFAULT_DEEP_THRESHOLDS.lthSopr,
    ),
    puell: getThresholdRange(
      thresholds,
      'puellMultiple',
      DEFAULT_THRESHOLDS.puell,
      DEFAULT_DEEP_THRESHOLDS.puell,
    ),
  };
}
