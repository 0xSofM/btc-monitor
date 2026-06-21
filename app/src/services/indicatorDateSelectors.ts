import type { IndicatorData, LatestData } from '@/types';

import { hasUsableValue } from './normalizers';

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readRawIndicatorDates(row: IndicatorData): LatestData['indicatorDates'] | undefined {
  const record = row as unknown as Record<string, unknown>;
  const payload = record.indicatorDates
    ?? record.indicator_dates
    ?? record.apiDataDate
    ?? record.api_data_date;
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const dates = payload as Record<string, unknown>;
  return {
    btcPrice: asNonEmptyString(dates.btcPrice ?? dates.btc_price),
    priceMa200w: asNonEmptyString(dates.priceMa200w ?? dates.price_ma200w),
    priceRealized: asNonEmptyString(dates.priceRealized ?? dates.price_realized),
    reserveRisk: asNonEmptyString(dates.reserveRisk ?? dates.reserve_risk),
    lthMvrv: asNonEmptyString(dates.lthMvrv ?? dates.lth_mvrv),
    lthSopr: asNonEmptyString(dates.lthSopr ?? dates.lth_sopr),
    mvrvZscore: asNonEmptyString(dates.mvrvZscore ?? dates.mvrv_zscore),
    nupl: asNonEmptyString(dates.nupl),
    sthSopr: asNonEmptyString(dates.sthSopr ?? dates.sth_sopr),
    sthMvrv: asNonEmptyString(dates.sthMvrv ?? dates.sth_mvrv),
    puell: asNonEmptyString(dates.puell),
  };
}

export function findIndicatorDates(data: IndicatorData[]): NonNullable<LatestData['indicatorDates']> {
  const latest = data[data.length - 1];
  if (!latest) {
    return {
      priceMa200w: undefined,
      priceRealized: undefined,
      reserveRisk: undefined,
      lthMvrv: undefined,
      lthSopr: undefined,
      mvrvZscore: undefined,
      nupl: undefined,
      sthSopr: undefined,
      sthMvrv: undefined,
      puell: undefined,
    };
  }

  // Start with backward scan to find dates from data presence.
  const dates: NonNullable<LatestData['indicatorDates']> = {
    priceMa200w: latest.d,
    priceRealized: undefined,
    reserveRisk: undefined,
    lthMvrv: undefined,
    lthSopr: undefined,
    mvrvZscore: undefined,
    nupl: undefined,
    sthSopr: undefined,
    sthMvrv: undefined,
    puell: undefined,
  };

  for (let index = data.length - 1; index >= 0; index -= 1) {
    const row = data[index];

    if (!dates.priceRealized && hasUsableValue(row.realizedPrice)) {
      dates.priceRealized = row.d;
    }

    if (!dates.reserveRisk && hasUsableValue(row.reserveRisk)) {
      dates.reserveRisk = row.d;
    }

    if (!dates.lthMvrv && hasUsableValue(row.lthMvrv)) {
      dates.lthMvrv = row.d;
    }

    if (!dates.lthSopr && hasUsableValue(row.lthSopr)) {
      dates.lthSopr = row.d;
    }

    if (!dates.mvrvZscore && hasUsableValue(row.mvrvZscore)) {
      dates.mvrvZscore = row.d;
    }

    if (!dates.nupl && hasUsableValue(row.nupl)) {
      dates.nupl = row.d;
    }

    if (!dates.sthSopr && hasUsableValue(row.sthSopr)) {
      dates.sthSopr = row.d;
    }

    if (!dates.sthMvrv && hasUsableValue(row.sthMvrv)) {
      dates.sthMvrv = row.d;
    }

    if (!dates.puell && hasUsableValue(row.puellMultiple)) {
      dates.puell = row.d;
    }
  }

  // Overlay explicit indicatorDates from payload; they take priority
  // over backward-scan dates.
  const fromPayload = latest.indicatorDates ?? readRawIndicatorDates(latest);
  if (fromPayload) {
    if (fromPayload.btcPrice) dates.btcPrice = fromPayload.btcPrice;
    if (fromPayload.priceMa200w) dates.priceMa200w = fromPayload.priceMa200w;
    if (fromPayload.priceRealized) dates.priceRealized = fromPayload.priceRealized;
    if (fromPayload.reserveRisk) dates.reserveRisk = fromPayload.reserveRisk;
    if (fromPayload.lthMvrv) dates.lthMvrv = fromPayload.lthMvrv;
    if (fromPayload.lthSopr) dates.lthSopr = fromPayload.lthSopr;
    if (fromPayload.mvrvZscore) dates.mvrvZscore = fromPayload.mvrvZscore;
    if (fromPayload.nupl) dates.nupl = fromPayload.nupl;
    if (fromPayload.sthSopr) dates.sthSopr = fromPayload.sthSopr;
    if (fromPayload.sthMvrv) dates.sthMvrv = fromPayload.sthMvrv;
    if (fromPayload.puell) dates.puell = fromPayload.puell;
  }

  return dates;
}
