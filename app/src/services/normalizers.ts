import type { IndicatorData, LatestData } from '@/types';

import type { ApiDatePayload } from './contracts';
import { asBoolean, asRecord, asString, toFiniteNumber, toNumberOrNull } from './normalizerPrimitives';
import { normalizeCanonicalLatest, normalizeLegacyLatest } from './latestContractNormalizers';
import { normalizeThresholdMap } from './thresholdNormalizers';

export { normalizeManifestData } from './manifestNormalizer';
export { normalizeStrategyMnavData } from './strategyMnavNormalizer';
export { hasUsableValue, toFiniteNumber, toNumberOrNull } from './normalizerPrimitives';

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

function normalizeIndicatorDates(
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
    btcPrice: toNumberOrNull(record.btcPrice ?? record.btc_price) ?? undefined,
    ma200w: toNumberOrNull(record.ma200w) ?? undefined,
    realizedPrice: toNumberOrNull(record.realizedPrice ?? record.realized_price) ?? undefined,
    priceMa200wRatio: toNumberOrNull(record.priceMa200wRatio ?? record.price_ma200w_ratio) ?? undefined,
    priceRealizedRatio: toNumberOrNull(record.priceRealizedRatio ?? record.price_realized_ratio) ?? undefined,
    reserveRisk: toNumberOrNull(record.reserveRisk ?? record.reserve_risk) ?? undefined,
    nupl: toNumberOrNull(record.nupl) ?? undefined,
    sthSopr: toNumberOrNull(record.sthSopr ?? record.sth_sopr) ?? undefined,
    sthSoprMa3: toNumberOrNull(record.sthSoprMa3 ?? record.sth_sopr_ma3) ?? undefined,
    sthMvrv: toNumberOrNull(record.sthMvrv ?? record.sth_mvrv) ?? undefined,
    puellMultiple: toNumberOrNull(record.puellMultiple ?? record.puell_multiple) ?? undefined,
    lthSopr: toNumberOrNull(record.lthSopr ?? record.lth_sopr) ?? undefined,
    lthSoprMa3: toNumberOrNull(record.lthSoprMa3 ?? record.lth_sopr_ma3) ?? undefined,
    signalPriceMa200w: asBoolean(record.signalPriceMa200w ?? record.signal_price_ma200w ?? record.signalPriceMa ?? record.signal_price_ma),
    signalPriceRealized: asBoolean(record.signalPriceRealized ?? record.signal_price_realized),
    signalReserveRisk: asBoolean(record.signalReserveRisk ?? record.signal_reserve_risk),
    signalReserveRiskV4: asBoolean(record.signalReserveRiskV4 ?? record.signal_reserve_risk_v4),
    signalMvrvZscoreCore: asBoolean(record.signalMvrvZscoreCore ?? record.signal_mvrv_zscore_core),
    signalNupl: asBoolean(record.signalNupl ?? record.signal_nupl),
    signalNuplCore: asBoolean(record.signalNuplCore ?? record.signal_nupl_core ?? record.signalNupl ?? record.signal_nupl),
    signalValuationBlendV6: asBoolean(record.signalValuationBlendV6 ?? record.signal_valuation_blend_v6),
    signalSthSopr: asBoolean(record.signalSthSopr ?? record.signal_sth_sopr),
    signalSthMvrv: asBoolean(record.signalSthMvrv ?? record.signal_sth_mvrv),
    signalSthGroup: asBoolean(record.signalSthGroup ?? record.signal_sth_group),
    signalLthMvrv: asBoolean(record.signalLthMvrv ?? record.signal_lth_mvrv),
    signalLthSopr: asBoolean(record.signalLthSopr ?? record.signal_lth_sopr),
    signalSthSoprTrigger: asBoolean(record.signalSthSoprTrigger ?? record.signal_sth_sopr_trigger),
    signalSthSoprAux: asBoolean(record.signalSthSoprAux ?? record.signal_sth_sopr_aux),
    signalPuell: asBoolean(record.signalPuell ?? record.signal_puell),
    signalCount: toNumberOrNull(record.signalCount ?? record.signal_count) ?? undefined,
    signalCountV4: toNumberOrNull(record.signalCountV4 ?? record.signal_count_v4) ?? undefined,
    signalCountV6: toNumberOrNull(record.signalCountV6 ?? record.signal_count_v6) ?? undefined,
    activeIndicatorCount: toNumberOrNull(record.activeIndicatorCount ?? record.active_indicator_count) ?? undefined,
    activeIndicatorCountV4: toNumberOrNull(record.activeIndicatorCountV4 ?? record.active_indicator_count_v4) ?? undefined,
    activeIndicatorCountV6: toNumberOrNull(record.activeIndicatorCountV6 ?? record.active_indicator_count_v6) ?? undefined,
    maxSignalScoreV2: toNumberOrNull(record.maxSignalScoreV2 ?? record.max_signal_score_v2) ?? undefined,
    scorePriceMa200w: toNumberOrNull(record.scorePriceMa200w ?? record.score_price_ma200w) ?? undefined,
    scorePriceRealized: toNumberOrNull(record.scorePriceRealized ?? record.score_price_realized) ?? undefined,
    scoreReserveRisk: toNumberOrNull(record.scoreReserveRisk ?? record.score_reserve_risk) ?? undefined,
    scoreReserveRiskV4: toNumberOrNull(record.scoreReserveRiskV4 ?? record.score_reserve_risk_v4) ?? undefined,
    scoreMvrvZscore: toNumberOrNull(record.scoreMvrvZscore ?? record.score_mvrv_zscore) ?? undefined,
    scoreMvrvZscoreCore: toNumberOrNull(record.scoreMvrvZscoreCore ?? record.score_mvrv_zscore_core) ?? undefined,
    scoreNupl: toNumberOrNull(record.scoreNupl ?? record.score_nupl) ?? undefined,
    scoreNuplCore: toNumberOrNull(record.scoreNuplCore ?? record.score_nupl_core) ?? undefined,
    valuationBlendScoreV6: toNumberOrNull(record.valuationBlendScoreV6 ?? record.valuation_blend_score_v6) ?? undefined,
    scoreLthMvrv: toNumberOrNull(record.scoreLthMvrv ?? record.score_lth_mvrv) ?? undefined,
    scoreSthSopr: toNumberOrNull(record.scoreSthSopr ?? record.score_sth_sopr) ?? undefined,
    scoreSthMvrv: toNumberOrNull(record.scoreSthMvrv ?? record.score_sth_mvrv) ?? undefined,
    scoreLthSopr: toNumberOrNull(record.scoreLthSopr ?? record.score_lth_sopr) ?? undefined,
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
    valuationScoreV6: toNumberOrNull(record.valuationScoreV6 ?? record.valuation_score_v6) ?? undefined,
    maxValuationScoreV6: toNumberOrNull(record.maxValuationScoreV6 ?? record.max_valuation_score_v6) ?? undefined,
    triggerScoreV6: toNumberOrNull(record.triggerScoreV6 ?? record.trigger_score_v6) ?? undefined,
    maxTriggerScoreV6: toNumberOrNull(record.maxTriggerScoreV6 ?? record.max_trigger_score_v6) ?? undefined,
    confirmationScoreV6: toNumberOrNull(record.confirmationScoreV6 ?? record.confirmation_score_v6) ?? undefined,
    maxConfirmationScoreV6: toNumberOrNull(record.maxConfirmationScoreV6 ?? record.max_confirmation_score_v6) ?? undefined,
    totalScoreV6: toNumberOrNull(record.totalScoreV6 ?? record.total_score_v6) ?? undefined,
    maxTotalScoreV6: toNumberOrNull(record.maxTotalScoreV6 ?? record.max_total_score_v6) ?? undefined,
    totalScoreV6Min3d: toNumberOrNull(record.totalScoreV6Min3d ?? record.total_score_v6_min3d) ?? undefined,
    signalConfirmed3dV6: asBoolean(record.signalConfirmed3dV6 ?? record.signal_confirmed_3d_v6),
    signalBandV6: asString(record.signalBandV6 ?? record.signal_band_v6),
    signalConfidence: toNumberOrNull(record.signalConfidence ?? record.signal_confidence) ?? undefined,
    signalConfidenceV6: toNumberOrNull(record.signalConfidenceV6 ?? record.signal_confidence_v6) ?? undefined,
    dataFreshnessScore: toNumberOrNull(record.dataFreshnessScore ?? record.data_freshness_score) ?? undefined,
    dataFreshnessScoreV6: toNumberOrNull(record.dataFreshnessScoreV6 ?? record.data_freshness_score_v6) ?? undefined,
    fallbackMode: asString(record.fallbackMode ?? record.fallback_mode),
    fallbackModeV6: asString(record.fallbackModeV6 ?? record.fallback_mode_v6),
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

export function normalizeLatestData(item: unknown): LatestData | null {
  const record = asRecord(item);
  if (!record) {
    return null;
  }

  const date = asString(record.date ?? record.d);
  if (!date) {
    return null;
  }
  const lastUpdated = asString(record.lastUpdated ?? record.last_updated);

  const incomingSignals = asRecord(record.signals);
  const incomingSignalsV4 = asRecord(record.signalsV4 ?? record.signals_v4);
  const incomingSignalsV6 = asRecord(record.signalsV6 ?? record.signals_v6);
  const incomingIndicatorDates = record.indicatorDates
    ?? record.indicator_dates
    ?? record.apiDataDate
    ?? record.api_data_date;

  const btcPrice = toNumberOrNull(record.btcPrice ?? record.btc_price) ?? 0;
  const priceMa200wRatio = toNumberOrNull(record.priceMa200wRatio ?? record.price_ma200w_ratio) ?? 0;
  const priceRealizedRatio = toNumberOrNull(record.priceRealizedRatio ?? record.price_realized_ratio) ?? 0;
  const reserveRisk = toNumberOrNull(record.reserveRisk ?? record.reserve_risk) ?? 0;
  const mvrvZscore = toNumberOrNull(record.mvrvZscore ?? record.mvrv_zscore) ?? 0;
  const nupl = toNumberOrNull(record.nupl) ?? undefined;
  const sthSopr = toNumberOrNull(record.sthSopr ?? record.sth_sopr) ?? 0;
  const sthSoprMa3 = toNumberOrNull(record.sthSoprMa3 ?? record.sth_sopr_ma3) ?? undefined;
  const sthSoprSignalValue = sthSoprMa3 ?? sthSopr;
  const sthMvrv = toNumberOrNull(record.sthMvrv ?? record.sth_mvrv) ?? 0;
  const puellMultiple = toNumberOrNull(record.puellMultiple ?? record.puell_multiple) ?? 0;
  const ma200w = toNumberOrNull(record.ma200w) ?? undefined;
  const realizedPrice = toNumberOrNull(record.realizedPrice ?? record.realized_price) ?? undefined;
  const lthSoprMa3 = toNumberOrNull(record.lthSoprMa3 ?? record.lth_sopr_ma3) ?? undefined;
  const lthSoprSignalValue = lthSoprMa3 ?? (toNumberOrNull(record.lthSopr ?? record.lth_sopr) ?? 0);

  const signals = {
    priceMa200w: asBoolean(incomingSignals?.priceMa200w ?? record.signalPriceMa200w ?? record.signal_price_ma200w ?? record.signalPriceMa ?? record.signal_price_ma)
      ?? (priceMa200wRatio < 1),
    priceRealized: asBoolean(incomingSignals?.priceRealized ?? record.signalPriceRealized ?? record.signal_price_realized)
      ?? (priceRealizedRatio < 1),
    reserveRisk: asBoolean(incomingSignals?.reserveRisk ?? record.signalReserveRisk ?? record.signal_reserve_risk)
      ?? (reserveRisk < 0.0016),
    sthSopr: asBoolean(incomingSignals?.sthSopr ?? record.signalSthSopr ?? record.signal_sth_sopr)
      ?? (sthSoprSignalValue < 1),
    sthMvrv: asBoolean(incomingSignals?.sthMvrv ?? record.signalSthMvrv ?? record.signal_sth_mvrv)
      ?? (sthMvrv < 1),
    sthGroup: asBoolean(incomingSignals?.sthGroup ?? record.signalSthGroup ?? record.signal_sth_group)
      ?? (sthSoprSignalValue < 1 || sthMvrv < 1),
    puell: asBoolean(incomingSignals?.puell ?? record.signalPuell ?? record.signal_puell)
      ?? (puellMultiple < 0.6),
  };
  const signalsV4 = incomingSignalsV4
    ? {
        priceMa200w: asBoolean(incomingSignalsV4.priceMa200w) ?? signals.priceMa200w,
        priceRealized: asBoolean(incomingSignalsV4.priceRealized) ?? signals.priceRealized,
        reserveRisk: asBoolean(
          incomingSignalsV4.reserveRisk
          ?? incomingSignalsV4.mvrvZscore
          ?? record.signalReserveRiskV4
          ?? record.signal_reserve_risk_v4,
        ) ?? (mvrvZscore < 0),
        mvrvZscore: asBoolean(
          incomingSignalsV4.mvrvZscore
          ?? incomingSignalsV4.reserveRisk
          ?? record.signalMvrvZscoreCore
          ?? record.signal_mvrv_zscore_core
          ?? record.signalReserveRiskV4
          ?? record.signal_reserve_risk_v4
          ?? record.signalMvrvZ
          ?? record.signal_mvrv_z,
        ) ?? (mvrvZscore < 0),
        sthMvrv: asBoolean(incomingSignalsV4.sthMvrv ?? record.signalSthMvrv ?? record.signal_sth_mvrv) ?? signals.sthMvrv,
        lthMvrv: asBoolean(incomingSignalsV4.lthMvrv ?? record.signalLthMvrv ?? record.signal_lth_mvrv)
          ?? ((toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? 0) < 1),
        puell: asBoolean(incomingSignalsV4.puell ?? record.signalPuell ?? record.signal_puell) ?? signals.puell,
        lthSopr: asBoolean(incomingSignalsV4.lthSopr ?? record.signalLthSopr ?? record.signal_lth_sopr)
          ?? (lthSoprSignalValue < 0.9),
        sthSoprTrigger: asBoolean(
          incomingSignalsV4.sthSoprTrigger ?? incomingSignalsV4.sthSoprAux
          ?? record.signalSthSoprTrigger ?? record.signal_sth_sopr_trigger
          ?? record.signalSthSoprAux ?? record.signal_sth_sopr_aux,
        ) ?? signals.sthSopr,
      }
    : undefined;
  const signalsV6 = incomingSignalsV6
    ? {
        priceMa200w: asBoolean(incomingSignalsV6.priceMa200w) ?? signals.priceMa200w,
        priceRealized: asBoolean(incomingSignalsV6.priceRealized) ?? signals.priceRealized,
        mvrvZscore: asBoolean(
          incomingSignalsV6.mvrvZscore
          ?? incomingSignalsV4?.mvrvZscore
          ?? incomingSignalsV4?.reserveRisk
          ?? record.signalMvrvZscoreCore
          ?? record.signal_mvrv_zscore_core,
        ) ?? (mvrvZscore < 0),
        nupl: asBoolean(
          incomingSignalsV6.nupl
          ?? record.signalNuplCore
          ?? record.signal_nupl_core
          ?? record.signalNupl
          ?? record.signal_nupl,
        ) ?? ((nupl ?? 1) < 0.15),
        valuationBlend: asBoolean(
          incomingSignalsV6.valuationBlend
          ?? record.signalValuationBlendV6
          ?? record.signal_valuation_blend_v6,
        ) ?? ((mvrvZscore < 0) || ((nupl ?? 1) < 0.15)),
        sthMvrv: asBoolean(incomingSignalsV6.sthMvrv ?? record.signalSthMvrv ?? record.signal_sth_mvrv) ?? signals.sthMvrv,
        lthMvrv: asBoolean(incomingSignalsV6.lthMvrv ?? record.signalLthMvrv ?? record.signal_lth_mvrv)
          ?? ((toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? 0) < 1),
        lthSopr: asBoolean(incomingSignalsV6.lthSopr ?? record.signalLthSopr ?? record.signal_lth_sopr)
          ?? (lthSoprSignalValue < 0.9),
        puell: asBoolean(incomingSignalsV6.puell ?? record.signalPuell ?? record.signal_puell) ?? signals.puell,
        sthSoprTrigger: asBoolean(
          incomingSignalsV6.sthSoprTrigger
          ?? incomingSignalsV4?.sthSoprTrigger
          ?? incomingSignalsV4?.sthSoprAux
          ?? record.signalSthSoprTrigger ?? record.signal_sth_sopr_trigger
          ?? record.signalSthSoprAux ?? record.signal_sth_sopr_aux,
        ) ?? signals.sthSopr,
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
    lastUpdated,
    btcPrice,
    priceMa200wRatio,
    priceRealizedRatio,
    ma200w,
    realizedPrice,
    reserveRisk,
    nupl,
    sthSopr,
    sthSoprMa3,
    sthMvrv,
    lthSopr: toNumberOrNull(record.lthSopr ?? record.lth_sopr) ?? undefined,
    lthSoprMa3,
    puellMultiple,
    signalCount,
    activeIndicatorCount: toNumberOrNull(record.activeIndicatorCount ?? record.active_indicator_count) ?? undefined,
    signalCountV4: toNumberOrNull(record.signalCountV4 ?? record.signal_count_v4) ?? undefined,
    activeIndicatorCountV4: toNumberOrNull(record.activeIndicatorCountV4 ?? record.active_indicator_count_v4) ?? undefined,
    signalCountV6: toNumberOrNull(record.signalCountV6 ?? record.signal_count_v6) ?? undefined,
    activeIndicatorCountV6: toNumberOrNull(record.activeIndicatorCountV6 ?? record.active_indicator_count_v6) ?? undefined,
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
    valuationScoreV6: toNumberOrNull(record.valuationScoreV6 ?? record.valuation_score_v6) ?? undefined,
    maxValuationScoreV6: toNumberOrNull(record.maxValuationScoreV6 ?? record.max_valuation_score_v6) ?? undefined,
    triggerScoreV6: toNumberOrNull(record.triggerScoreV6 ?? record.trigger_score_v6) ?? undefined,
    maxTriggerScoreV6: toNumberOrNull(record.maxTriggerScoreV6 ?? record.max_trigger_score_v6) ?? undefined,
    confirmationScoreV6: toNumberOrNull(record.confirmationScoreV6 ?? record.confirmation_score_v6) ?? undefined,
    maxConfirmationScoreV6: toNumberOrNull(record.maxConfirmationScoreV6 ?? record.max_confirmation_score_v6) ?? undefined,
    totalScoreV6: toNumberOrNull(record.totalScoreV6 ?? record.total_score_v6) ?? undefined,
    maxTotalScoreV6: toNumberOrNull(record.maxTotalScoreV6 ?? record.max_total_score_v6) ?? undefined,
    totalScoreV6Min3d: toNumberOrNull(record.totalScoreV6Min3d ?? record.total_score_v6_min3d),
    signalConfirmed3dV6: asBoolean(record.signalConfirmed3dV6 ?? record.signal_confirmed_3d_v6),
    signalBandV6: asString(record.signalBandV6 ?? record.signal_band_v6),
    signalConfidence: toNumberOrNull(record.signalConfidence ?? record.signal_confidence) ?? undefined,
    signalConfidenceV6: toNumberOrNull(record.signalConfidenceV6 ?? record.signal_confidence_v6) ?? undefined,
    dataFreshnessScore: toNumberOrNull(record.dataFreshnessScore ?? record.data_freshness_score) ?? undefined,
    dataFreshnessScoreV6: toNumberOrNull(record.dataFreshnessScoreV6 ?? record.data_freshness_score_v6) ?? undefined,
    fallbackMode: asString(record.fallbackMode ?? record.fallback_mode),
    fallbackModeV6: asString(record.fallbackModeV6 ?? record.fallback_mode_v6),
    scorePriceMa200w: toNumberOrNull(record.scorePriceMa200w ?? record.score_price_ma200w) ?? undefined,
    scorePriceRealized: toNumberOrNull(record.scorePriceRealized ?? record.score_price_realized) ?? undefined,
    scoreReserveRisk: toNumberOrNull(record.scoreReserveRisk ?? record.score_reserve_risk) ?? undefined,
    scoreReserveRiskV4: toNumberOrNull(record.scoreReserveRiskV4 ?? record.score_reserve_risk_v4) ?? undefined,
    scoreMvrvZscore: toNumberOrNull(record.scoreMvrvZscore ?? record.score_mvrv_zscore) ?? undefined,
    scoreMvrvZscoreCore: toNumberOrNull(record.scoreMvrvZscoreCore ?? record.score_mvrv_zscore_core) ?? undefined,
    scoreNupl: toNumberOrNull(record.scoreNupl ?? record.score_nupl) ?? undefined,
    scoreNuplCore: toNumberOrNull(record.scoreNuplCore ?? record.score_nupl_core) ?? undefined,
    valuationBlendScoreV6: toNumberOrNull(record.valuationBlendScoreV6 ?? record.valuation_blend_score_v6) ?? undefined,
    signalNupl: asBoolean(record.signalNupl ?? record.signal_nupl),
    signalNuplCore: asBoolean(record.signalNuplCore ?? record.signal_nupl_core ?? record.signalNupl ?? record.signal_nupl),
    signalValuationBlendV6: asBoolean(record.signalValuationBlendV6 ?? record.signal_valuation_blend_v6),
    scoreLthMvrv: toNumberOrNull(record.scoreLthMvrv ?? record.score_lth_mvrv) ?? undefined,
    scoreLthSopr: toNumberOrNull(record.scoreLthSopr ?? record.score_lth_sopr) ?? undefined,
    scoreSthSopr: toNumberOrNull(record.scoreSthSopr ?? record.score_sth_sopr) ?? undefined,
    scoreSthMvrv: toNumberOrNull(record.scoreSthMvrv ?? record.score_sth_mvrv) ?? undefined,
    scorePuell: toNumberOrNull(record.scorePuell ?? record.score_puell) ?? undefined,
    signalMvrvZscoreCore: asBoolean(record.signalMvrvZscoreCore ?? record.signal_mvrv_zscore_core),
    scoreSthGroup: toNumberOrNull(record.scoreSthGroup ?? record.score_sth_group) ?? undefined,
    signalSthGroup: asBoolean(record.signalSthGroup ?? record.signal_sth_group),
    scoringModelVersion: asString(record.scoringModelVersion ?? record.scoring_model_version),
    legacyScoringModelVersion: asString(record.legacyScoringModelVersion ?? record.legacy_scoring_model_version),
    indicatorSet: asString(record.indicatorSet ?? record.indicator_set ?? record.coreIndicatorSet ?? record.core_indicator_set),
    coreIndicatorSet: asString(record.coreIndicatorSet ?? record.core_indicator_set ?? record.indicatorSet ?? record.indicator_set),
    schemaVersion: asString(record.schemaVersion ?? record.schema_version),
    signals,
    signalsV4,
    signalsV6,
    indicatorDates: normalizeIndicatorDates(incomingIndicatorDates, date),
    staleIndicators: Array.isArray(record.staleIndicators ?? record.stale_indicators)
      ? ((record.staleIndicators ?? record.stale_indicators) as LatestData['staleIndicators'])
      : undefined,
    thresholds: normalizeThresholdMap(record.thresholds),
    canonical: normalizeCanonicalLatest(record.canonical),
    legacy: normalizeLegacyLatest(record.legacy),
    // Legacy fields
    mvrvZscore: toNumberOrNull(record.mvrvZscore ?? record.mvrv_zscore) ?? undefined,
    lthMvrv: toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? undefined,
  };
}
