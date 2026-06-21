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
      let value: number | null = null;
      let triggerValue: number | null = null;
      let deepValue: number | null = null;
      let signal = false;
      let preserveGap = false;

      if (indicator === 'priceMa200w') {
        value = item.priceMa200wRatio ?? null;
        triggerValue = DEFAULT_THRESHOLDS.priceMa200w;
        deepValue = DEFAULT_DEEP_THRESHOLDS.priceMa200w;
        signal = item.signalPriceMa200w ?? item.signalPriceMa ?? false;
      }

      if (indicator === 'priceRealized') {
        value = item.priceRealizedRatio ?? null;
        triggerValue = DEFAULT_THRESHOLDS.priceRealized;
        deepValue = DEFAULT_DEEP_THRESHOLDS.priceRealized;
        signal = item.signalPriceRealized ?? false;
      }

      if (indicator === 'reserveRisk') {
        const threshold = getThresholdRange(
          item.thresholds,
          'reserveRisk',
          DEFAULT_THRESHOLDS.reserveRisk,
          DEFAULT_DEEP_THRESHOLDS.reserveRisk,
        );
        value = getObservedValue(item.reserveRisk, item.indicatorDates?.reserveRisk, item.d);
        triggerValue = threshold.trigger;
        deepValue = threshold.deep;
        signal = item.signalReserveRisk ?? item.signalReserveRiskV4 ?? false;
        preserveGap = true;
      }

      if (indicator === 'valuationBlend') {
        const mvrvScore = toFiniteNumber(item.scoreMvrvZscoreCore, 0);
        const nuplScore = toFiniteNumber(item.scoreNuplCore, 0);
        const blendScore = item.valuationBlendScoreV6 ?? Math.max(mvrvScore, nuplScore);
        value = blendScore;
        triggerValue = 0.5;
        deepValue = 1.5;
        signal = item.signalsV6?.valuationBlend
          ?? item.signalValuationBlendV6
          ?? (blendScore > 0);
      }

      if (indicator === 'mvrvZscore') {
        const threshold = getThresholdRange(
          item.thresholds,
          'mvrvZscoreCore',
          DEFAULT_THRESHOLDS.mvrvZscore,
          DEFAULT_DEEP_THRESHOLDS.mvrvZscore,
        );
        value = getObservedValue(item.mvrvZscore, item.indicatorDates?.mvrvZscore, item.d);
        triggerValue = threshold.trigger;
        deepValue = threshold.deep;
        signal = item.signalMvrvZscoreCore ?? item.signalReserveRiskV4 ?? item.signalMvrvZ ?? false;
        preserveGap = true;
      }

      if (indicator === 'nupl') {
        const threshold = getThresholdRange(
          item.thresholds,
          'nuplCore',
          DEFAULT_THRESHOLDS.nupl,
          DEFAULT_DEEP_THRESHOLDS.nupl,
        );
        value = getObservedValue(item.nupl, item.indicatorDates?.nupl, item.d);
        triggerValue = threshold.trigger;
        deepValue = threshold.deep;
        signal = item.signalNuplCore ?? item.signalNupl ?? false;
        preserveGap = true;
      }

      if (indicator === 'lthMvrv') {
        value = item.lthMvrv ?? null;
        triggerValue = DEFAULT_THRESHOLDS.lthMvrv;
        deepValue = DEFAULT_DEEP_THRESHOLDS.lthMvrv;
        signal = item.signalLthMvrv ?? false;
      }

      if (indicator === 'sthSopr') {
        const threshold = getThresholdRange(
          item.thresholds,
          'sthSopr',
          DEFAULT_THRESHOLDS.sthSopr,
          DEFAULT_DEEP_THRESHOLDS.sthSopr,
        );
        value = item.sthSoprMa3 ?? item.sthSopr ?? null;
        triggerValue = threshold.trigger;
        deepValue = threshold.deep;
        signal = item.signalsV6?.sthSoprTrigger
          ?? item.signalSthSoprTrigger
          ?? item.signalSthSoprAux
          ?? item.signalSthSopr
          ?? false;
      }

      if (indicator === 'sthMvrv') {
        const threshold = getThresholdRange(
          item.thresholds,
          'sthMvrv',
          DEFAULT_THRESHOLDS.sthMvrv,
          DEFAULT_DEEP_THRESHOLDS.sthMvrv,
        );
        value = item.sthMvrv ?? null;
        triggerValue = threshold.trigger;
        deepValue = threshold.deep;
        signal = item.signalSthMvrv ?? false;
      }

      if (indicator === 'lthSopr') {
        const threshold = getThresholdRange(
          item.thresholds,
          'lthSopr',
          DEFAULT_THRESHOLDS.lthSopr,
          DEFAULT_DEEP_THRESHOLDS.lthSopr,
        );
        value = item.lthSoprMa3 ?? item.lthSopr ?? null;
        triggerValue = threshold.trigger;
        deepValue = threshold.deep;
        signal = item.signalsV6?.lthSopr ?? item.signalLthSopr ?? false;
      }

      if (indicator === 'puell') {
        value = item.puellMultiple ?? null;
        triggerValue = DEFAULT_THRESHOLDS.puell;
        deepValue = DEFAULT_DEEP_THRESHOLDS.puell;
        signal = item.signalPuell ?? false;
      }

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
