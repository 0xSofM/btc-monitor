import type { LatestData } from '@/types';

import { normalizeIndicatorDates } from './indicatorDataNormalizer';
import { normalizeCanonicalLatest, normalizeLegacyLatest } from './latestContractNormalizers';
import { normalizeLatestSignals } from './latestSignalNormalizers';
import { asBoolean, asRecord, asString, toFiniteNumber, toNumberOrNull } from './normalizerPrimitives';
import { normalizeThresholdMap } from './thresholdNormalizers';

function normalizeLatestMetricValues(record: Record<string, unknown>) {
  const sthSopr = toNumberOrNull(record.sthSopr ?? record.sth_sopr) ?? 0;
  const sthSoprMa3 = toNumberOrNull(record.sthSoprMa3 ?? record.sth_sopr_ma3) ?? undefined;
  const lthSoprMa3 = toNumberOrNull(record.lthSoprMa3 ?? record.lth_sopr_ma3) ?? undefined;

  return {
    btcPrice: toNumberOrNull(record.btcPrice ?? record.btc_price) ?? 0,
    priceMa200wRatio: toNumberOrNull(record.priceMa200wRatio ?? record.price_ma200w_ratio) ?? 0,
    priceRealizedRatio: toNumberOrNull(record.priceRealizedRatio ?? record.price_realized_ratio) ?? 0,
    reserveRisk: toNumberOrNull(record.reserveRisk ?? record.reserve_risk) ?? 0,
    mvrvZscore: toNumberOrNull(record.mvrvZscore ?? record.mvrv_zscore) ?? 0,
    nupl: toNumberOrNull(record.nupl) ?? undefined,
    sthSopr,
    sthSoprMa3,
    sthSoprSignalValue: sthSoprMa3 ?? sthSopr,
    sthMvrv: toNumberOrNull(record.sthMvrv ?? record.sth_mvrv) ?? 0,
    puellMultiple: toNumberOrNull(record.puellMultiple ?? record.puell_multiple) ?? 0,
    ma200w: toNumberOrNull(record.ma200w) ?? undefined,
    realizedPrice: toNumberOrNull(record.realizedPrice ?? record.realized_price) ?? undefined,
    lthSoprMa3,
    lthSoprSignalValue: lthSoprMa3 ?? (toNumberOrNull(record.lthSopr ?? record.lth_sopr) ?? 0),
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

  const {
    btcPrice,
    priceMa200wRatio,
    priceRealizedRatio,
    reserveRisk,
    mvrvZscore,
    nupl,
    sthSopr,
    sthSoprMa3,
    sthSoprSignalValue,
    sthMvrv,
    puellMultiple,
    ma200w,
    realizedPrice,
    lthSoprMa3,
    lthSoprSignalValue,
  } = normalizeLatestMetricValues(record);

  const { signals, signalsV4, signalsV6 } = normalizeLatestSignals({
    record,
    incomingSignals,
    incomingSignalsV4,
    incomingSignalsV6,
    priceMa200wRatio,
    priceRealizedRatio,
    reserveRisk,
    mvrvZscore,
    nupl,
    sthSoprSignalValue,
    sthMvrv,
    puellMultiple,
    lthSoprSignalValue,
  });

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
