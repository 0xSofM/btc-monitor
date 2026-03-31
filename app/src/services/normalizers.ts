import type { IndicatorData, LatestData } from '@/types';

import type { ApiDatePayload } from './contracts';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 1 || value === '1' || value === 'true') {
    return true;
  }

  if (value === 0 || value === '0' || value === 'false') {
    return false;
  }

  return undefined;
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = toFiniteNumber(value, Number.NaN);
  return Number.isNaN(parsed) ? null : parsed;
}

export function hasUsableValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'number') {
    return !Number.isNaN(value);
  }

  return true;
}

function normalizeApiDatePayload(value: unknown): ApiDatePayload | undefined {
  const payload = asRecord(value);
  if (!payload) {
    return undefined;
  }

  return {
    priceMa200w: asString(payload.priceMa200w),
    price_ma200w: asString(payload.price_ma200w),
    priceRealized: asString(payload.priceRealized),
    price_realized: asString(payload.price_realized),
    reserveRisk: asString(payload.reserveRisk),
    reserve_risk: asString(payload.reserve_risk),
    sthSopr: asString(payload.sthSopr),
    sth_sopr: asString(payload.sth_sopr),
    sthMvrv: asString(payload.sthMvrv),
    sth_mvrv: asString(payload.sth_mvrv),
    puell: asString(payload.puell),
  };
}

function normalizeIndicatorDates(
  value: unknown,
  fallbackDate: string,
): NonNullable<LatestData['indicatorDates']> {
  const payload = normalizeApiDatePayload(value);

  return {
    priceMa200w: payload?.priceMa200w ?? payload?.price_ma200w ?? fallbackDate,
    priceRealized: payload?.priceRealized ?? payload?.price_realized ?? fallbackDate,
    reserveRisk: payload?.reserveRisk ?? payload?.reserve_risk ?? fallbackDate,
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

  const rawApiDates = record.apiDataDate ?? record.api_data_date;
  const indicatorDates = normalizeIndicatorDates(rawApiDates, date);

  return {
    d: date,
    unixTs: Number.isNaN(unixTs ?? Number.NaN) ? undefined : unixTs,
    btcPrice: toNumberOrNull(record.btcPrice ?? record.btc_price) ?? undefined,
    ma200w: toNumberOrNull(record.ma200w) ?? undefined,
    realizedPrice: toNumberOrNull(record.realizedPrice ?? record.realized_price) ?? undefined,
    priceMa200wRatio: toNumberOrNull(record.priceMa200wRatio ?? record.price_ma200w_ratio) ?? undefined,
    priceRealizedRatio: toNumberOrNull(record.priceRealizedRatio ?? record.price_realized_ratio) ?? undefined,
    reserveRisk: toNumberOrNull(record.reserveRisk ?? record.reserve_risk) ?? undefined,
    sthSopr: toNumberOrNull(record.sthSopr ?? record.sth_sopr) ?? undefined,
    sthMvrv: toNumberOrNull(record.sthMvrv ?? record.sth_mvrv) ?? undefined,
    puellMultiple: toNumberOrNull(record.puellMultiple ?? record.puell_multiple) ?? undefined,
    signalPriceMa200w: asBoolean(record.signalPriceMa200w ?? record.signal_price_ma200w ?? record.signalPriceMa ?? record.signal_price_ma),
    signalPriceRealized: asBoolean(record.signalPriceRealized ?? record.signal_price_realized),
    signalReserveRisk: asBoolean(record.signalReserveRisk ?? record.signal_reserve_risk),
    signalSthSopr: asBoolean(record.signalSthSopr ?? record.signal_sth_sopr),
    signalSthMvrv: asBoolean(record.signalSthMvrv ?? record.signal_sth_mvrv),
    signalSthGroup: asBoolean(record.signalSthGroup ?? record.signal_sth_group),
    signalPuell: asBoolean(record.signalPuell ?? record.signal_puell),
    signalCount: toNumberOrNull(record.signalCount ?? record.signal_count) ?? undefined,
    activeIndicatorCount: toNumberOrNull(record.activeIndicatorCount ?? record.active_indicator_count) ?? undefined,
    maxSignalScoreV2: toNumberOrNull(record.maxSignalScoreV2 ?? record.max_signal_score_v2) ?? undefined,
    scorePriceMa200w: toNumberOrNull(record.scorePriceMa200w ?? record.score_price_ma200w) ?? undefined,
    scorePriceRealized: toNumberOrNull(record.scorePriceRealized ?? record.score_price_realized) ?? undefined,
    scoreReserveRisk: toNumberOrNull(record.scoreReserveRisk ?? record.score_reserve_risk) ?? undefined,
    scoreSthSopr: toNumberOrNull(record.scoreSthSopr ?? record.score_sth_sopr) ?? undefined,
    scoreSthMvrv: toNumberOrNull(record.scoreSthMvrv ?? record.score_sth_mvrv) ?? undefined,
    scoreSthGroup: toNumberOrNull(record.scoreSthGroup ?? record.score_sth_group) ?? undefined,
    scorePuell: toNumberOrNull(record.scorePuell ?? record.score_puell) ?? undefined,
    signalScoreV2: toNumberOrNull(record.signalScoreV2 ?? record.signal_score_v2) ?? undefined,
    signalScoreV2Min3d: toNumberOrNull(record.signalScoreV2Min3d ?? record.signal_score_v2_min3d) ?? undefined,
    signalConfirmed3d: asBoolean(record.signalConfirmed3d ?? record.signal_confirmed_3d),
    signalBandV2: asString(record.signalBandV2 ?? record.signal_band_v2),
    indicatorDates,
    // Legacy V1 fields for backward compatibility
    mvrvZscore: toNumberOrNull(record.mvrvZscore ?? record.mvrv_zscore) ?? undefined,
    lthMvrv: toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? undefined,
    nupl: toNumberOrNull(record.nupl) ?? undefined,
    signalPriceMa: asBoolean(record.signalPriceMa ?? record.signal_price_ma),
    signalMvrvZ: asBoolean(record.signalMvrvZ ?? record.signal_mvrv_z),
    signalLthMvrv: asBoolean(record.signalLthMvrv ?? record.signal_lth_mvrv),
    signalNupl: asBoolean(record.signalNupl ?? record.signal_nupl),
  };
}

export function normalizeLatestData(item: unknown): LatestData | null {
  const record = asRecord(item);
  if (!record) {
    return null;
  }

  const date = asString(record.date ?? record.d);
  if (!date) {
    return null;
  }

  const incomingSignals = asRecord(record.signals);
  const incomingIndicatorDates = record.indicatorDates ?? record.apiDataDate ?? record.api_data_date;

  const btcPrice = toNumberOrNull(record.btcPrice ?? record.btc_price) ?? 0;
  const priceMa200wRatio = toNumberOrNull(record.priceMa200wRatio ?? record.price_ma200w_ratio) ?? 0;
  const priceRealizedRatio = toNumberOrNull(record.priceRealizedRatio ?? record.price_realized_ratio) ?? 0;
  const reserveRisk = toNumberOrNull(record.reserveRisk ?? record.reserve_risk) ?? 0;
  const sthSopr = toNumberOrNull(record.sthSopr ?? record.sth_sopr) ?? 0;
  const sthMvrv = toNumberOrNull(record.sthMvrv ?? record.sth_mvrv) ?? 0;
  const puellMultiple = toNumberOrNull(record.puellMultiple ?? record.puell_multiple) ?? 0;
  const ma200w = toNumberOrNull(record.ma200w) ?? undefined;
  const realizedPrice = toNumberOrNull(record.realizedPrice ?? record.realized_price) ?? undefined;

  const signals = {
    priceMa200w: asBoolean(incomingSignals?.priceMa200w ?? record.signalPriceMa200w ?? record.signal_price_ma200w ?? record.signalPriceMa ?? record.signal_price_ma)
      ?? (priceMa200wRatio < 1),
    priceRealized: asBoolean(incomingSignals?.priceRealized ?? record.signalPriceRealized ?? record.signal_price_realized)
      ?? (priceRealizedRatio < 1),
    reserveRisk: asBoolean(incomingSignals?.reserveRisk ?? record.signalReserveRisk ?? record.signal_reserve_risk)
      ?? (reserveRisk < 0.0016),
    sthSopr: asBoolean(incomingSignals?.sthSopr ?? record.signalSthSopr ?? record.signal_sth_sopr)
      ?? (sthSopr < 1),
    sthMvrv: asBoolean(incomingSignals?.sthMvrv ?? record.signalSthMvrv ?? record.signal_sth_mvrv)
      ?? (sthMvrv < 1),
    sthGroup: asBoolean(incomingSignals?.sthGroup ?? record.signalSthGroup ?? record.signal_sth_group)
      ?? (sthSopr < 1 || sthMvrv < 1),
    puell: asBoolean(incomingSignals?.puell ?? record.signalPuell ?? record.signal_puell)
      ?? (puellMultiple < 0.6),
  };

  const signalCountRaw = record.signalCount ?? record.signal_count;
  const groupedSignalCount = [
    signals.priceMa200w,
    signals.priceRealized,
    signals.reserveRisk,
    signals.sthGroup ?? (signals.sthSopr || signals.sthMvrv),
    signals.puell,
  ].filter(Boolean).length;
  const signalCount = signalCountRaw === undefined || signalCountRaw === null
    ? groupedSignalCount
    : toFiniteNumber(signalCountRaw, groupedSignalCount);

  return {
    date,
    btcPrice,
    priceMa200wRatio,
    priceRealizedRatio,
    ma200w,
    realizedPrice,
    reserveRisk,
    sthSopr,
    sthMvrv,
    puellMultiple,
    signalCount,
    activeIndicatorCount: toNumberOrNull(record.activeIndicatorCount ?? record.active_indicator_count) ?? undefined,
    maxSignalScoreV2: toNumberOrNull(record.maxSignalScoreV2 ?? record.max_signal_score_v2) ?? undefined,
    signalScoreV2: toNumberOrNull(record.signalScoreV2 ?? record.signal_score_v2) ?? undefined,
    signalScoreV2Min3d: toNumberOrNull(record.signalScoreV2Min3d ?? record.signal_score_v2_min3d),
    signalConfirmed3d: asBoolean(record.signalConfirmed3d ?? record.signal_confirmed_3d),
    signalBandV2: asString(record.signalBandV2 ?? record.signal_band_v2),
    scoreSthGroup: toNumberOrNull(record.scoreSthGroup ?? record.score_sth_group) ?? undefined,
    signalSthGroup: asBoolean(record.signalSthGroup ?? record.signal_sth_group),
    scoringModelVersion: asString(record.scoringModelVersion ?? record.scoring_model_version),
    signals,
    indicatorDates: normalizeIndicatorDates(incomingIndicatorDates, date),
    thresholds: asRecord(record.thresholds) as Record<string, { trigger: number; deep: number }> | undefined,
    // Legacy fields
    mvrvZscore: toNumberOrNull(record.mvrvZscore ?? record.mvrv_zscore) ?? undefined,
    lthMvrv: toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? undefined,
    nupl: toNumberOrNull(record.nupl) ?? undefined,
  };
}
