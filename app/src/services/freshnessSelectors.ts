import type { LatestData } from '@/types';

import { CORE_INDICATOR_DATE_KEYS, ONCHAIN_INDICATOR_DATE_KEYS } from './indicatorConfig';

function getCoreDisplayDates(indicatorDates?: LatestData['indicatorDates']): string[] {
  return CORE_INDICATOR_DATE_KEYS
    .map((key) => indicatorDates?.[key])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

export function getEffectiveDataDate(
  latestDate: string,
  indicatorDates?: LatestData['indicatorDates'],
): string {
  if (!latestDate) {
    return '';
  }

  const candidates = getCoreDisplayDates(indicatorDates);

  if (candidates.length === 0) {
    return latestDate;
  }

  return candidates.reduce((oldest, value) => (value < oldest ? value : oldest), candidates[0]);
}

export function getDataFreshnessHours(value: string): number {
  if (!value) {
    return 0;
  }

  const hasExplicitTime = value.includes('T');
  const timestamp = hasExplicitTime
    ? Date.parse(value)
    : Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(timestamp)) {
    return 0;
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs <= 0) {
    return 0;
  }

  return Number((diffMs / (1000 * 60 * 60)).toFixed(1));
}

export function getPriceFreshnessHours(
  indicatorDates?: LatestData['indicatorDates'],
): number {
  if (!indicatorDates?.btcPrice) {
    return 0;
  }
  return getDataFreshnessHours(indicatorDates.btcPrice);
}

export function getOnchainFreshnessHours(
  latestDate: string,
  indicatorDates?: LatestData['indicatorDates'],
): number {
  if (!indicatorDates) {
    return 0;
  }

  const candidates = [
    ...ONCHAIN_INDICATOR_DATE_KEYS.map((key) => indicatorDates[key]),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (candidates.length === 0) {
    return getDataFreshnessHours(latestDate);
  }

  const oldest = candidates.reduce(
    (oldest, value) => (value < oldest ? value : oldest),
    candidates[0],
  );
  return getDataFreshnessHours(oldest);
}
