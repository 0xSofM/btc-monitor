import type { ChartDataPoint, IndicatorData, LatestData, TimeRange } from '@/types';

import type { IndicatorKey } from './contracts';
import { DEFAULT_DEEP_THRESHOLDS, DEFAULT_THRESHOLDS, TIME_RANGE_MS } from './indicatorConfig';
import { hasUsableValue, toFiniteNumber } from './normalizers';

function toNumericPrice(value: number | string | undefined): number {
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

function getObservedValue(
  value: number | null | undefined,
  observedDate: string | undefined,
  rowDate: string,
): number | null {
  const hasObservedDate = typeof observedDate === 'string' && observedDate.length > 0;
  return hasObservedDate
    ? (observedDate === rowDate ? (value ?? null) : null)
    : (value ?? null);
}

type ThresholdIndicatorKey = keyof typeof DEFAULT_THRESHOLDS;

type IndicatorChartFields = {
  value: number | null;
  triggerValue: number | null;
  deepValue: number | null;
  signal: boolean;
  preserveGap: boolean;
};

function getIndicatorThresholdValues(
  item: IndicatorData,
  thresholdKey: string,
  fallbackKey: ThresholdIndicatorKey,
): Pick<IndicatorChartFields, 'triggerValue' | 'deepValue'> {
  const threshold = getThresholdRange(
    item.thresholds,
    thresholdKey,
    DEFAULT_THRESHOLDS[fallbackKey],
    DEFAULT_DEEP_THRESHOLDS[fallbackKey],
  );

  return {
    triggerValue: threshold.trigger,
    deepValue: threshold.deep,
  };
}

function resolveIndicatorChartFields(
  item: IndicatorData,
  indicator: IndicatorKey,
): IndicatorChartFields {
  switch (indicator) {
    case 'priceMa200w':
      return {
        value: item.priceMa200wRatio ?? null,
        triggerValue: DEFAULT_THRESHOLDS.priceMa200w,
        deepValue: DEFAULT_DEEP_THRESHOLDS.priceMa200w,
        signal: item.signalPriceMa200w ?? item.signalPriceMa ?? false,
        preserveGap: false,
      };

    case 'priceRealized':
      return {
        value: item.priceRealizedRatio ?? null,
        triggerValue: DEFAULT_THRESHOLDS.priceRealized,
        deepValue: DEFAULT_DEEP_THRESHOLDS.priceRealized,
        signal: item.signalPriceRealized ?? false,
        preserveGap: false,
      };

    case 'reserveRisk':
      return {
        value: getObservedValue(item.reserveRisk, item.indicatorDates?.reserveRisk, item.d),
        ...getIndicatorThresholdValues(item, 'reserveRisk', 'reserveRisk'),
        signal: item.signalReserveRisk ?? item.signalReserveRiskV4 ?? false,
        preserveGap: true,
      };

    case 'valuationBlend': {
      const mvrvScore = toFiniteNumber(item.scoreMvrvZscoreCore, 0);
      const nuplScore = toFiniteNumber(item.scoreNuplCore, 0);
      const blendScore = item.valuationBlendScoreV6 ?? Math.max(mvrvScore, nuplScore);

      return {
        value: blendScore,
        triggerValue: 0.5,
        deepValue: 1.5,
        signal: item.signalsV6?.valuationBlend
          ?? item.signalValuationBlendV6
          ?? (blendScore > 0),
        preserveGap: false,
      };
    }

    case 'mvrvZscore':
      return {
        value: getObservedValue(item.mvrvZscore, item.indicatorDates?.mvrvZscore, item.d),
        ...getIndicatorThresholdValues(item, 'mvrvZscoreCore', 'mvrvZscore'),
        signal: item.signalMvrvZscoreCore ?? item.signalReserveRiskV4 ?? item.signalMvrvZ ?? false,
        preserveGap: true,
      };

    case 'nupl':
      return {
        value: getObservedValue(item.nupl, item.indicatorDates?.nupl, item.d),
        ...getIndicatorThresholdValues(item, 'nuplCore', 'nupl'),
        signal: item.signalNuplCore ?? item.signalNupl ?? false,
        preserveGap: true,
      };

    case 'lthMvrv':
      return {
        value: item.lthMvrv ?? null,
        triggerValue: DEFAULT_THRESHOLDS.lthMvrv,
        deepValue: DEFAULT_DEEP_THRESHOLDS.lthMvrv,
        signal: item.signalLthMvrv ?? false,
        preserveGap: false,
      };

    case 'sthSopr':
      return {
        value: item.sthSoprMa3 ?? item.sthSopr ?? null,
        ...getIndicatorThresholdValues(item, 'sthSopr', 'sthSopr'),
        signal: item.signalsV6?.sthSoprTrigger
          ?? item.signalSthSoprTrigger
          ?? item.signalSthSoprAux
          ?? item.signalSthSopr
          ?? false,
        preserveGap: false,
      };

    case 'sthMvrv':
      return {
        value: item.sthMvrv ?? null,
        ...getIndicatorThresholdValues(item, 'sthMvrv', 'sthMvrv'),
        signal: item.signalSthMvrv ?? false,
        preserveGap: false,
      };

    case 'lthSopr':
      return {
        value: item.lthSoprMa3 ?? item.lthSopr ?? null,
        ...getIndicatorThresholdValues(item, 'lthSopr', 'lthSopr'),
        signal: item.signalsV6?.lthSopr ?? item.signalLthSopr ?? false,
        preserveGap: false,
      };

    case 'puell':
      return {
        value: item.puellMultiple ?? null,
        triggerValue: DEFAULT_THRESHOLDS.puell,
        deepValue: DEFAULT_DEEP_THRESHOLDS.puell,
        signal: item.signalPuell ?? false,
        preserveGap: false,
      };
  }
}

export function filterDataByTimeRange(data: IndicatorData[], range: TimeRange): IndicatorData[] {
  if (range === 'all') {
    return data;
  }

  const cutoffTime = Date.now() - TIME_RANGE_MS[range];
  return data.filter((item) => Date.parse(`${item.d}T00:00:00Z`) >= cutoffTime);
}

export function getIndicatorChartData(
  data: IndicatorData[],
  indicator: IndicatorKey,
  range: TimeRange,
): ChartDataPoint[] {
  const filteredData = filterDataByTimeRange(data, range);

  const points = filteredData
    .map((item): ChartDataPoint | null => {
      const { value, triggerValue, deepValue, signal, preserveGap } = resolveIndicatorChartFields(
        item,
        indicator,
      );

      const btcPrice = toNumericPrice(item.btcPrice);
      if ((value === null && !preserveGap) || (value === 0 && btcPrice === 0)) {
        return null;
      }

      return {
        date: item.d,
        value,
        triggerValue,
        deepValue,
        btcPrice,
        signal,
      };
    })
    .filter((item): item is ChartDataPoint => item !== null);

  const firstObservedIndex = points.findIndex((point) => point.value !== null);
  return firstObservedIndex > 0 ? points.slice(firstObservedIndex) : points;
}

export function getMA200ChartData(
  data: IndicatorData[],
  range: TimeRange,
): { date: string; price: number; ma200: number | null; signal: boolean }[] {
  return filterDataByTimeRange(data, range)
    .filter((item) => hasUsableValue(item.btcPrice))
    .map((item) => {
      const price = toNumericPrice(item.btcPrice);
      let ma200: number | null = hasUsableValue(item.ma200w) ? toFiniteNumber(item.ma200w, 0) : null;

      if ((!ma200 || ma200 <= 0) && item.priceMa200wRatio && item.priceMa200wRatio > 0) {
        ma200 = price / item.priceMa200wRatio;
      }

      const hasMa200 = typeof ma200 === 'number' && Number.isFinite(ma200) && ma200 > 0;

      return {
        date: item.d,
        price,
        ma200: hasMa200 ? ma200 : null,
        signal: hasMa200 ? (item.signalPriceMa200w ?? item.signalPriceMa ?? false) : false,
      };
    });
}
