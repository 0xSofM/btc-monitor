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
    lthMvrv: asString(payload.lthMvrv),
    lth_mvrv: asString(payload.lth_mvrv),
    mvrvZscore: asString(payload.mvrvZscore),
    mvrv_zscore: asString(payload.mvrv_zscore),
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
    lthMvrv: payload?.lthMvrv ?? payload?.lth_mvrv ?? fallbackDate,
    mvrvZscore: payload?.mvrvZscore ?? payload?.mvrv_zscore ?? fallbackDate,
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
    signalReserveRiskV4: asBoolean(record.signalReserveRiskV4 ?? record.signal_reserve_risk_v4),
    signalSthSopr: asBoolean(record.signalSthSopr ?? record.signal_sth_sopr),
    signalSthMvrv: asBoolean(record.signalSthMvrv ?? record.signal_sth_mvrv),
    signalSthGroup: asBoolean(record.signalSthGroup ?? record.signal_sth_group),
    signalLthMvrv: asBoolean(record.signalLthMvrv ?? record.signal_lth_mvrv),
    signalSthSoprAux: asBoolean(record.signalSthSoprAux ?? record.signal_sth_sopr_aux),
    signalPuell: asBoolean(record.signalPuell ?? record.signal_puell),
    signalCount: toNumberOrNull(record.signalCount ?? record.signal_count) ?? undefined,
    signalCountV4: toNumberOrNull(record.signalCountV4 ?? record.signal_count_v4) ?? undefined,
    activeIndicatorCount: toNumberOrNull(record.activeIndicatorCount ?? record.active_indicator_count) ?? undefined,
    activeIndicatorCountV4: toNumberOrNull(record.activeIndicatorCountV4 ?? record.active_indicator_count_v4) ?? undefined,
    maxSignalScoreV2: toNumberOrNull(record.maxSignalScoreV2 ?? record.max_signal_score_v2) ?? undefined,
    scorePriceMa200w: toNumberOrNull(record.scorePriceMa200w ?? record.score_price_ma200w) ?? undefined,
    scorePriceRealized: toNumberOrNull(record.scorePriceRealized ?? record.score_price_realized) ?? undefined,
    scoreReserveRisk: toNumberOrNull(record.scoreReserveRisk ?? record.score_reserve_risk) ?? undefined,
    scoreReserveRiskV4: toNumberOrNull(record.scoreReserveRiskV4 ?? record.score_reserve_risk_v4) ?? undefined,
    scoreSthSopr: toNumberOrNull(record.scoreSthSopr ?? record.score_sth_sopr) ?? undefined,
    scoreSthMvrv: toNumberOrNull(record.scoreSthMvrv ?? record.score_sth_mvrv) ?? undefined,
    scoreSthGroup: toNumberOrNull(record.scoreSthGroup ?? record.score_sth_group) ?? undefined,
    scorePuell: toNumberOrNull(record.scorePuell ?? record.score_puell) ?? undefined,
    signalScoreV2: toNumberOrNull(record.signalScoreV2 ?? record.signal_score_v2) ?? undefined,
    signalScoreV2Min3d: toNumberOrNull(record.signalScoreV2Min3d ?? record.signal_score_v2_min3d) ?? undefined,
    signalConfirmed3d: asBoolean(record.signalConfirmed3d ?? record.signal_confirmed_3d),
    signalBandV2: asString(record.signalBandV2 ?? record.signal_band_v2),
    valuationScore: toNumberOrNull(record.valuationScore ?? record.valuation_score) ?? undefined,
    maxValuationScore: toNumberOrNull(record.maxValuationScore ?? record.max_valuation_score) ?? undefined,
    triggerScore: toNumberOrNull(record.triggerScore ?? record.trigger_score) ?? undefined,
    maxTriggerScore: toNumberOrNull(record.maxTriggerScore ?? record.max_trigger_score) ?? undefined,
    confirmationScore: toNumberOrNull(record.confirmationScore ?? record.confirmation_score) ?? undefined,
    maxConfirmationScore: toNumberOrNull(record.maxConfirmationScore ?? record.max_confirmation_score) ?? undefined,
    auxiliaryScore: toNumberOrNull(record.auxiliaryScore ?? record.auxiliary_score) ?? undefined,
    maxAuxiliaryScore: toNumberOrNull(record.maxAuxiliaryScore ?? record.max_auxiliary_score) ?? undefined,
    totalScoreV4: toNumberOrNull(record.totalScoreV4 ?? record.total_score_v4) ?? undefined,
    maxTotalScoreV4: toNumberOrNull(record.maxTotalScoreV4 ?? record.max_total_score_v4) ?? undefined,
    totalScoreV4Min3d: toNumberOrNull(record.totalScoreV4Min3d ?? record.total_score_v4_min3d) ?? undefined,
    signalConfirmed3dV4: asBoolean(record.signalConfirmed3dV4 ?? record.signal_confirmed_3d_v4),
    signalBandV4: asString(record.signalBandV4 ?? record.signal_band_v4),
    signalConfidence: toNumberOrNull(record.signalConfidence ?? record.signal_confidence) ?? undefined,
    dataFreshnessScore: toNumberOrNull(record.dataFreshnessScore ?? record.data_freshness_score) ?? undefined,
    fallbackMode: asString(record.fallbackMode ?? record.fallback_mode),
    staleIndicators: Array.isArray(record.staleIndicators ?? record.stale_indicators)
      ? ((record.staleIndicators ?? record.stale_indicators) as IndicatorData['staleIndicators'])
      : undefined,
    coreIndicatorSet: asString(record.coreIndicatorSet ?? record.core_indicator_set),
    scoringModelVersion: asString(record.scoringModelVersion ?? record.scoring_model_version),
    indicatorDates,
    // Legacy V1 fields for backward compatibility
    mvrvZscore: toNumberOrNull(record.mvrvZscore ?? record.mvrv_zscore) ?? undefined,
    lthMvrv: toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? undefined,
    nupl: toNumberOrNull(record.nupl) ?? undefined,
    signalPriceMa: asBoolean(record.signalPriceMa ?? record.signal_price_ma),
    signalMvrvZ: asBoolean(record.signalMvrvZ ?? record.signal_mvrv_z),
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
  const incomingSignalsV4 = asRecord(record.signalsV4 ?? record.signals_v4);
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
  const signalsV4 = incomingSignalsV4
    ? {
        priceMa200w: asBoolean(incomingSignalsV4.priceMa200w) ?? signals.priceMa200w,
        priceRealized: asBoolean(incomingSignalsV4.priceRealized) ?? signals.priceRealized,
        reserveRisk: asBoolean(incomingSignalsV4.reserveRisk ?? record.signalReserveRiskV4 ?? record.signal_reserve_risk_v4) ?? signals.reserveRisk,
        sthMvrv: asBoolean(incomingSignalsV4.sthMvrv ?? record.signalSthMvrv ?? record.signal_sth_mvrv) ?? signals.sthMvrv,
        lthMvrv: asBoolean(incomingSignalsV4.lthMvrv ?? record.signalLthMvrv ?? record.signal_lth_mvrv)
          ?? ((toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? 0) < 1),
        puell: asBoolean(incomingSignalsV4.puell ?? record.signalPuell ?? record.signal_puell) ?? signals.puell,
        sthSoprAux: asBoolean(incomingSignalsV4.sthSoprAux ?? record.signalSthSoprAux ?? record.signal_sth_sopr_aux)
          ?? signals.sthSopr,
      }
    : undefined;

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
    signalCountV4: toNumberOrNull(record.signalCountV4 ?? record.signal_count_v4) ?? undefined,
    activeIndicatorCountV4: toNumberOrNull(record.activeIndicatorCountV4 ?? record.active_indicator_count_v4) ?? undefined,
    maxSignalScoreV2: toNumberOrNull(record.maxSignalScoreV2 ?? record.max_signal_score_v2) ?? undefined,
    signalScoreV2: toNumberOrNull(record.signalScoreV2 ?? record.signal_score_v2) ?? undefined,
    signalScoreV2Min3d: toNumberOrNull(record.signalScoreV2Min3d ?? record.signal_score_v2_min3d),
    signalConfirmed3d: asBoolean(record.signalConfirmed3d ?? record.signal_confirmed_3d),
    signalBandV2: asString(record.signalBandV2 ?? record.signal_band_v2),
    valuationScore: toNumberOrNull(record.valuationScore ?? record.valuation_score) ?? undefined,
    maxValuationScore: toNumberOrNull(record.maxValuationScore ?? record.max_valuation_score) ?? undefined,
    triggerScore: toNumberOrNull(record.triggerScore ?? record.trigger_score) ?? undefined,
    maxTriggerScore: toNumberOrNull(record.maxTriggerScore ?? record.max_trigger_score) ?? undefined,
    confirmationScore: toNumberOrNull(record.confirmationScore ?? record.confirmation_score) ?? undefined,
    maxConfirmationScore: toNumberOrNull(record.maxConfirmationScore ?? record.max_confirmation_score) ?? undefined,
    auxiliaryScore: toNumberOrNull(record.auxiliaryScore ?? record.auxiliary_score) ?? undefined,
    maxAuxiliaryScore: toNumberOrNull(record.maxAuxiliaryScore ?? record.max_auxiliary_score) ?? undefined,
    totalScoreV4: toNumberOrNull(record.totalScoreV4 ?? record.total_score_v4) ?? undefined,
    maxTotalScoreV4: toNumberOrNull(record.maxTotalScoreV4 ?? record.max_total_score_v4) ?? undefined,
    totalScoreV4Min3d: toNumberOrNull(record.totalScoreV4Min3d ?? record.total_score_v4_min3d),
    signalConfirmed3dV4: asBoolean(record.signalConfirmed3dV4 ?? record.signal_confirmed_3d_v4),
    signalBandV4: asString(record.signalBandV4 ?? record.signal_band_v4),
    signalConfidence: toNumberOrNull(record.signalConfidence ?? record.signal_confidence) ?? undefined,
    dataFreshnessScore: toNumberOrNull(record.dataFreshnessScore ?? record.data_freshness_score) ?? undefined,
    fallbackMode: asString(record.fallbackMode ?? record.fallback_mode),
    scoreSthGroup: toNumberOrNull(record.scoreSthGroup ?? record.score_sth_group) ?? undefined,
    signalSthGroup: asBoolean(record.signalSthGroup ?? record.signal_sth_group),
    scoringModelVersion: asString(record.scoringModelVersion ?? record.scoring_model_version),
    legacyScoringModelVersion: asString(record.legacyScoringModelVersion ?? record.legacy_scoring_model_version),
    coreIndicatorSet: asString(record.coreIndicatorSet ?? record.core_indicator_set),
    schemaVersion: asString(record.schemaVersion ?? record.schema_version),
    signals,
    signalsV4,
    indicatorDates: normalizeIndicatorDates(incomingIndicatorDates, date),
    staleIndicators: Array.isArray(record.staleIndicators ?? record.stale_indicators)
      ? ((record.staleIndicators ?? record.stale_indicators) as LatestData['staleIndicators'])
      : undefined,
    thresholds: asRecord(record.thresholds) as Record<string, { trigger: number; deep: number }> | undefined,
    // Legacy fields
    mvrvZscore: toNumberOrNull(record.mvrvZscore ?? record.mvrv_zscore) ?? undefined,
    lthMvrv: toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? undefined,
    nupl: toNumberOrNull(record.nupl) ?? undefined,
  };
}
