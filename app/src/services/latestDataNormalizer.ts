import type { LatestData } from '@/types';

import { normalizeIndicatorDates } from './indicatorDataNormalizer';
import { normalizeCanonicalLatest, normalizeLegacyLatest } from './latestContractNormalizers';
import { normalizeLatestMetricValues } from './latestMetricNormalizers';
import { normalizeLatestScoreValues } from './latestScoreNormalizers';
import { normalizeLatestSignals } from './latestSignalNormalizers';
import { asRecord, asString, toFiniteNumber, toNumberOrNull } from './normalizerPrimitives';
import { normalizeThresholdMap } from './thresholdNormalizers';

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
    ...normalizeLatestScoreValues(record),
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
