import type { IndicatorData, LatestData } from '@/types';

import type { ApiDatePayload } from './contracts';
import { normalizeIndicatorMetricValues } from './indicatorMetricNormalizers';
import { normalizeIndicatorScoreValues } from './indicatorScoreNormalizers';
import { normalizeIndicatorSignalValues } from './indicatorSignalNormalizers';
import { asBoolean, asRecord, asString, toFiniteNumber, toNumberOrNull } from './normalizerPrimitives';
import { normalizeThresholdMap } from './thresholdNormalizers';

function normalizeApiDatePayload(value: unknown): ApiDatePayload | undefined {
  const payload = asRecord(value);
  if (!payload) {
    return undefined;
  }

  return {
    btcPrice: asString(payload.btcPrice),
    priceMa200w: asString(payload.priceMa200w),
    price_ma200w: asString(payload.price_ma200w),
    priceRealized: asString(payload.priceRealized),
    price_realized: asString(payload.price_realized),
    reserveRisk: asString(payload.reserveRisk),
    reserve_risk: asString(payload.reserve_risk),
    lthMvrv: asString(payload.lthMvrv),
    lth_mvrv: asString(payload.lth_mvrv),
    lthSopr: asString(payload.lthSopr),
    lth_sopr: asString(payload.lth_sopr),
    mvrvZscore: asString(payload.mvrvZscore),
    mvrv_zscore: asString(payload.mvrv_zscore),
    nupl: asString(payload.nupl),
    sthSopr: asString(payload.sthSopr),
    sth_sopr: asString(payload.sth_sopr),
    sthMvrv: asString(payload.sthMvrv),
    sth_mvrv: asString(payload.sth_mvrv),
    puell: asString(payload.puell),
  };
}

export function normalizeIndicatorDates(
  value: unknown,
  fallbackDate: string,
): NonNullable<LatestData['indicatorDates']> {
  const payload = normalizeApiDatePayload(value);

  return {
    btcPrice: payload?.btcPrice,
    priceMa200w: payload?.priceMa200w ?? payload?.price_ma200w ?? fallbackDate,
    priceRealized: payload?.priceRealized ?? payload?.price_realized ?? fallbackDate,
    reserveRisk: payload?.reserveRisk ?? payload?.reserve_risk ?? fallbackDate,
    lthMvrv: payload?.lthMvrv ?? payload?.lth_mvrv ?? fallbackDate,
    lthSopr: payload?.lthSopr ?? payload?.lth_sopr ?? fallbackDate,
    mvrvZscore: payload?.mvrvZscore ?? payload?.mvrv_zscore ?? fallbackDate,
    nupl: payload?.nupl ?? fallbackDate,
    sthSopr: payload?.sthSopr ?? payload?.sth_sopr ?? fallbackDate,
    sthMvrv: payload?.sthMvrv ?? payload?.sth_mvrv ?? fallbackDate,
    puell: payload?.puell ?? fallbackDate,
  };
}

export function normalizeIndicatorData(item: unknown): IndicatorData | null {
  const record = asRecord(item);
  if (!record) {
    return null;
  }

  const date = asString(record.d);
  if (!date) {
    return null;
  }

  const unixTsRaw = record.unixTs ?? record.unix_ts;
  const unixTs = unixTsRaw === undefined || unixTsRaw === null
    ? undefined
    : toFiniteNumber(unixTsRaw, Number.NaN);

  const rawIndicatorDates = record.indicatorDates
    ?? record.indicator_dates
    ?? record.apiDataDate
    ?? record.api_data_date;
  const indicatorDates = normalizeIndicatorDates(rawIndicatorDates, date);

  return {
    d: date,
    unixTs: Number.isNaN(unixTs ?? Number.NaN) ? undefined : unixTs,
    ...normalizeIndicatorMetricValues(record),
    ...normalizeIndicatorSignalValues(record),
    ...normalizeIndicatorScoreValues(record),
    staleIndicators: Array.isArray(record.staleIndicators ?? record.stale_indicators)
      ? ((record.staleIndicators ?? record.stale_indicators) as IndicatorData['staleIndicators'])
      : undefined,
    indicatorSet: asString(record.indicatorSet ?? record.indicator_set ?? record.coreIndicatorSet ?? record.core_indicator_set),
    coreIndicatorSet: asString(record.coreIndicatorSet ?? record.core_indicator_set ?? record.indicatorSet ?? record.indicator_set),
    scoringModelVersion: asString(record.scoringModelVersion ?? record.scoring_model_version),
    thresholds: normalizeThresholdMap(record.thresholds),
    indicatorDates,
    signalsV6: asRecord(record.signalsV6 ?? record.signals_v6) as IndicatorData['signalsV6'],
    // Legacy V1 fields for backward compatibility
    mvrvZscore: toNumberOrNull(record.mvrvZscore ?? record.mvrv_zscore) ?? undefined,
    lthMvrv: toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? undefined,
    signalPriceMa: asBoolean(record.signalPriceMa ?? record.signal_price_ma),
    signalMvrvZ: asBoolean(record.signalMvrvZ ?? record.signal_mvrv_z),
  };
}
