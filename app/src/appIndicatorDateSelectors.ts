import type { LatestData } from '@/types';
import type { IndicatorDateKey } from './appDisplay';

const indicatorDateLabels: Partial<Record<IndicatorDateKey, string>> = {
  priceMa200w: 'Price / 200W-MA',
  mvrvZscore: 'MVRV Z-Score',
  nupl: 'NUPL',
  lthMvrv: 'LTH-MVRV',
  lthSopr: 'LTH-SOPR',
  sthSopr: 'STH-SOPR',
  sthMvrv: 'STH-MVRV',
  puell: 'Puell Multiple',
};

function buildIndicatorDateEntries(latestData: LatestData) {
  return ([
    ['priceMa200w', latestData.indicatorDates?.priceMa200w],
    ['mvrvZscore', latestData.indicatorDates?.mvrvZscore],
    ['nupl', latestData.indicatorDates?.nupl],
    ['puell', latestData.indicatorDates?.puell],
    ['sthMvrv', latestData.indicatorDates?.sthMvrv],
    ['sthSopr', latestData.indicatorDates?.sthSopr],
    ['lthMvrv', latestData.indicatorDates?.lthMvrv],
    ['lthSopr', latestData.indicatorDates?.lthSopr],
  ] as Array<[IndicatorDateKey, string | undefined]>)
    .filter((entry): entry is [IndicatorDateKey, string] => Boolean(entry[1]));
}

export function buildLaggingIndicatorLabels(latestData: LatestData): string[] {
  return buildIndicatorDateEntries(latestData)
    .filter(([, value]) => value < latestData.date)
    .map(([key]) => indicatorDateLabels[key] ?? key);
}
