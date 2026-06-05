import type { ChartDataPoint, IndicatorData, LatestData, SignalEvent, TimeRange } from '@/types';

import type { IndicatorKey } from './contracts';
import { hasUsableValue, toFiniteNumber } from './normalizers';

const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  '6m': 180 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
  all: Infinity,
};

const DEFAULT_THRESHOLDS = {
  priceMa200w: 1,
  priceRealized: 1,
  reserveRisk: 0.0016,
  mvrvZscore: 0,
  nupl: 0.15,
  lthMvrv: 1,
  lthSopr: 0.9,
  sthSopr: 1,
  sthMvrv: 1,
  puell: 0.6,
};

const DEFAULT_DEEP_THRESHOLDS = {
  priceMa200w: 0.85,
  priceRealized: 0.9,
  reserveRisk: 0.0012,
  mvrvZscore: -0.5,
  nupl: 0,
  lthMvrv: 0.9,
  lthSopr: 0.75,
  sthSopr: 0.97,
  sthMvrv: 0.85,
  puell: 0.5,
};

const CORE_INDICATOR_DATE_KEYS = [
  'priceMa200w',
  'priceRealized',
  'lthMvrv',
  'lthSopr',
  'sthSopr',
  'sthMvrv',
  'puell',
] as const;

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

function toNumericPrice(value: number | string | undefined): number {
  return toFiniteNumber(value, 0);
}

function getValuationBlendDate(indicatorDates?: LatestData['indicatorDates']): string | undefined {
  const candidates = [indicatorDates?.mvrvZscore, indicatorDates?.nupl]
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (candidates.length === 0) {
    return undefined;
  }

  return candidates.reduce((newest, value) => (value > newest ? value : newest), candidates[0]);
}

function getCoreDisplayDates(indicatorDates?: LatestData['indicatorDates']): string[] {
  const valuationBlendDate = getValuationBlendDate(indicatorDates);
  return [
    valuationBlendDate,
    ...CORE_INDICATOR_DATE_KEYS.map((key) => indicatorDates?.[key]),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
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

  // Overlay explicit indicatorDates from payload — they take priority
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

export function getLatestFromHistory(data: IndicatorData[]): LatestData | null {
  if (!data.length) {
    return null;
  }

  const latest = data[data.length - 1];

  const btcPrice = toNumericPrice(latest.btcPrice);
  const priceMa200wRatio = toFiniteNumber(latest.priceMa200wRatio, 0);
  const priceRealizedRatio = toFiniteNumber(latest.priceRealizedRatio, 0);
  const reserveRisk = toFiniteNumber(latest.reserveRisk, 0);
  const mvrvZscore = toFiniteNumber(latest.mvrvZscore, 0);
  const nupl = toFiniteNumber(latest.nupl, 0);
  const sthSoprRaw = toFiniteNumber(latest.sthSopr, 0);
  const sthSoprMa3 = latest.sthSoprMa3;
  const sthSopr = sthSoprRaw;
  const sthSoprSignalValue = toFiniteNumber(sthSoprMa3 ?? latest.sthSopr, 0);
  const sthMvrv = toFiniteNumber(latest.sthMvrv, 0);
  const puellMultiple = toFiniteNumber(latest.puellMultiple, 0);
  const lthMvrv = toFiniteNumber(latest.lthMvrv, 0);
  const lthSoprRaw = toFiniteNumber(latest.lthSopr, 0);
  const lthSoprMa3 = latest.lthSoprMa3;
  const lthSoprValue = lthSoprRaw;
  const lthSoprSignalValue = toFiniteNumber(lthSoprMa3 ?? latest.lthSopr, 0);
  const priceMa200wThreshold = getThresholdRange(
    latest.thresholds,
    'priceMa200wRatio',
    DEFAULT_THRESHOLDS.priceMa200w,
    DEFAULT_DEEP_THRESHOLDS.priceMa200w,
  );
  const priceRealizedThreshold = getThresholdRange(
    latest.thresholds,
    'priceRealizedRatio',
    DEFAULT_THRESHOLDS.priceRealized,
    DEFAULT_DEEP_THRESHOLDS.priceRealized,
  );
  const reserveRiskThreshold = getThresholdRange(
    latest.thresholds,
    'reserveRisk',
    DEFAULT_THRESHOLDS.reserveRisk,
    DEFAULT_DEEP_THRESHOLDS.reserveRisk,
  );
  const mvrvZscoreThreshold = getThresholdRange(
    latest.thresholds,
    'mvrvZscoreCore',
    DEFAULT_THRESHOLDS.mvrvZscore,
    DEFAULT_DEEP_THRESHOLDS.mvrvZscore,
  );
  const nuplThreshold = getThresholdRange(
    latest.thresholds,
    'nuplCore',
    DEFAULT_THRESHOLDS.nupl,
    DEFAULT_DEEP_THRESHOLDS.nupl,
  );
  const sthSoprThreshold = getThresholdRange(
    latest.thresholds,
    'sthSopr',
    DEFAULT_THRESHOLDS.sthSopr,
    DEFAULT_DEEP_THRESHOLDS.sthSopr,
  );
  const sthMvrvThreshold = getThresholdRange(
    latest.thresholds,
    'sthMvrv',
    DEFAULT_THRESHOLDS.sthMvrv,
    DEFAULT_DEEP_THRESHOLDS.sthMvrv,
  );
  const lthMvrvThreshold = getThresholdRange(
    latest.thresholds,
    'lthMvrv',
    DEFAULT_THRESHOLDS.lthMvrv,
    DEFAULT_DEEP_THRESHOLDS.lthMvrv,
  );
  const lthSoprThreshold = getThresholdRange(
    latest.thresholds,
    'lthSopr',
    DEFAULT_THRESHOLDS.lthSopr,
    DEFAULT_DEEP_THRESHOLDS.lthSopr,
  );
  const puellThreshold = getThresholdRange(
    latest.thresholds,
    'puellMultiple',
    DEFAULT_THRESHOLDS.puell,
    DEFAULT_DEEP_THRESHOLDS.puell,
  );
  const signalMvrvZscoreCore = latest.signalMvrvZscoreCore
    ?? latest.signalReserveRiskV4
    ?? latest.signalMvrvZ
    ?? (mvrvZscore < mvrvZscoreThreshold.trigger);
  const signalNuplCore = latest.signalNuplCore
    ?? latest.signalNupl
    ?? (nupl < nuplThreshold.trigger);
  const signalValuationBlendV6 = latest.signalValuationBlendV6
    ?? latest.signalsV6?.valuationBlend
    ?? (signalMvrvZscoreCore || signalNuplCore);

  const signals = {
    priceMa200w: latest.signalPriceMa200w ?? latest.signalPriceMa ?? priceMa200wRatio < priceMa200wThreshold.trigger,
    priceRealized: latest.signalPriceRealized ?? priceRealizedRatio < priceRealizedThreshold.trigger,
    reserveRisk: latest.signalReserveRisk ?? reserveRisk < reserveRiskThreshold.trigger,
    sthSopr: latest.signalSthSopr ?? sthSoprSignalValue < sthSoprThreshold.trigger,
    sthMvrv: latest.signalSthMvrv ?? sthMvrv < sthMvrvThreshold.trigger,
    sthGroup: latest.signalSthGroup ?? ((latest.signalSthSopr ?? (sthSoprSignalValue < sthSoprThreshold.trigger)) || (latest.signalSthMvrv ?? (sthMvrv < sthMvrvThreshold.trigger))),
    puell: latest.signalPuell ?? puellMultiple < puellThreshold.trigger,
  };
  const signalsV4 = {
    priceMa200w: latest.signalPriceMa200w ?? latest.signalPriceMa ?? priceMa200wRatio < priceMa200wThreshold.trigger,
    priceRealized: latest.signalPriceRealized ?? priceRealizedRatio < priceRealizedThreshold.trigger,
    reserveRisk: signalMvrvZscoreCore,
    mvrvZscore: signalMvrvZscoreCore,
    sthMvrv: latest.signalSthMvrv ?? sthMvrv < sthMvrvThreshold.trigger,
    lthMvrv: latest.signalLthMvrv ?? lthMvrv < lthMvrvThreshold.trigger,
    lthSopr: latest.signalLthSopr ?? (lthSoprSignalValue < lthSoprThreshold.trigger),
    puell: latest.signalPuell ?? puellMultiple < puellThreshold.trigger,
    sthSoprTrigger: latest.signalSthSoprTrigger ?? latest.signalSthSoprAux ?? latest.signalSthSopr ?? (sthSoprSignalValue < sthSoprThreshold.trigger),
  };
  const signalsV6 = {
    priceMa200w: latest.signalsV6?.priceMa200w ?? signalsV4.priceMa200w,
    priceRealized: latest.signalsV6?.priceRealized ?? signalsV4.priceRealized,
    mvrvZscore: latest.signalsV6?.mvrvZscore ?? signalMvrvZscoreCore,
    nupl: latest.signalsV6?.nupl ?? signalNuplCore,
    valuationBlend: latest.signalsV6?.valuationBlend ?? signalValuationBlendV6,
    sthMvrv: latest.signalsV6?.sthMvrv ?? signalsV4.sthMvrv,
    sthSoprTrigger: latest.signalsV6?.sthSoprTrigger ?? signalsV4.sthSoprTrigger,
    lthMvrv: latest.signalsV6?.lthMvrv ?? signalsV4.lthMvrv,
    lthSopr: latest.signalsV6?.lthSopr ?? signalsV4.lthSopr,
    puell: latest.signalsV6?.puell ?? signalsV4.puell,
  };

  const groupedSignalCount = [
    signals.priceMa200w,
    signals.priceRealized,
    signals.reserveRisk,
    signals.sthGroup ?? (signals.sthSopr || signals.sthMvrv),
    signals.puell,
  ].filter(Boolean).length;
  const activeIndicatorCount = latest.activeIndicatorCount ?? 5;
  const maxSignalScoreV2 = latest.maxSignalScoreV2 ?? (activeIndicatorCount * 2);
  const groupedSignalCountV4 = [
    signalsV4.priceMa200w,
    signalsV4.priceRealized,
    signalsV4.mvrvZscore,
    signalsV4.sthMvrv,
    signalsV4.lthMvrv,
    signalsV4.lthSopr,
    signalsV4.puell,
  ].filter(Boolean).length;
  const activeIndicatorCountV4 = latest.activeIndicatorCountV4 ?? (hasUsableValue(latest.mvrvZscore) ? 7 : 6);
  const groupedSignalCountV6 = [
    signalsV6.priceMa200w,
    signalsV6.priceRealized,
    signalsV6.valuationBlend,
    signalsV6.sthMvrv,
    signalsV6.sthSoprTrigger,
    signalsV6.lthMvrv,
    signalsV6.lthSopr,
    signalsV6.puell,
  ].filter(Boolean).length;
  const activeIndicatorCountV6 = latest.activeIndicatorCountV6 ?? 8;

  return {
    date: latest.d,
    btcPrice,
    priceMa200wRatio,
    priceRealizedRatio,
    ma200w: latest.ma200w,
    realizedPrice: latest.realizedPrice,
    reserveRisk,
    mvrvZscore,
    nupl,
    lthMvrv,
    lthSopr: lthSoprValue,
    lthSoprMa3,
    sthSopr,
    sthSoprMa3,
    sthMvrv,
    puellMultiple,
    signalCount: latest.signalCount ?? groupedSignalCount,
    activeIndicatorCount,
    signalCountV4: latest.signalCountV4 ?? groupedSignalCountV4,
    activeIndicatorCountV4,
    signalCountV6: latest.signalCountV6 ?? groupedSignalCountV6,
    activeIndicatorCountV6,
    maxSignalScoreV2,
    signalScoreV2: latest.signalScoreV2,
    signalScoreV2Min3d: latest.signalScoreV2Min3d ?? null,
    signalConfirmed3d: latest.signalConfirmed3d,
    signalBandV2: latest.signalBandV2,
    valuationScore: latest.valuationScore,
    maxValuationScore: latest.maxValuationScore,
    triggerScore: latest.triggerScore,
    maxTriggerScore: latest.maxTriggerScore,
    confirmationScore: latest.confirmationScore,
    maxConfirmationScore: latest.maxConfirmationScore,
    auxiliaryScore: latest.auxiliaryScore,
    maxAuxiliaryScore: latest.maxAuxiliaryScore,
    totalScoreV4: latest.totalScoreV4,
    maxTotalScoreV4: latest.maxTotalScoreV4,
    totalScoreV4Min3d: latest.totalScoreV4Min3d ?? null,
    signalConfirmed3dV4: latest.signalConfirmed3dV4,
    signalBandV4: latest.signalBandV4,
    valuationScoreV6: latest.valuationScoreV6,
    maxValuationScoreV6: latest.maxValuationScoreV6,
    triggerScoreV6: latest.triggerScoreV6,
    maxTriggerScoreV6: latest.maxTriggerScoreV6,
    confirmationScoreV6: latest.confirmationScoreV6,
    maxConfirmationScoreV6: latest.maxConfirmationScoreV6,
    totalScoreV6: latest.totalScoreV6,
    maxTotalScoreV6: latest.maxTotalScoreV6,
    totalScoreV6Min3d: latest.totalScoreV6Min3d ?? null,
    signalConfirmed3dV6: latest.signalConfirmed3dV6,
    signalBandV6: latest.signalBandV6,
    signalConfidence: latest.signalConfidence,
    signalConfidenceV6: latest.signalConfidenceV6,
    dataFreshnessScore: latest.dataFreshnessScore,
    dataFreshnessScoreV6: latest.dataFreshnessScoreV6,
    fallbackMode: latest.fallbackMode,
    fallbackModeV6: latest.fallbackModeV6,
    scoreMvrvZscoreCore: latest.scoreMvrvZscoreCore,
    signalMvrvZscoreCore,
    scoreNupl: latest.scoreNupl,
    scoreNuplCore: latest.scoreNuplCore,
    valuationBlendScoreV6: latest.valuationBlendScoreV6,
    signalNupl: latest.signalNupl,
    signalNuplCore,
    signalValuationBlendV6,
    scoreSthGroup: latest.scoreSthGroup,
    signalSthGroup: latest.signalSthGroup,
    signals,
    signalsV4,
    signalsV6,
    thresholds: latest.thresholds,
    indicatorDates: findIndicatorDates(data),
  };
}

export function enrichLatestDataWithHistory(latest: LatestData, history: IndicatorData[]): LatestData {
  if (!history.length) {
    return latest;
  }

  return {
    ...latest,
    indicatorDates: latest.indicatorDates ?? findIndicatorDates(history),
  };
}

export function latestDataToHistoryRow(
  latest: LatestData,
  existingRow?: IndicatorData,
): IndicatorData {
  const signalsV4 = latest.signalsV4;
  const signalsV6 = latest.signalsV6;

  return {
    ...existingRow,
    d: latest.date,
    btcPrice: latest.btcPrice,
    priceMa200wRatio: latest.priceMa200wRatio,
    priceRealizedRatio: latest.priceRealizedRatio,
    ma200w: latest.ma200w ?? existingRow?.ma200w,
    realizedPrice: latest.realizedPrice ?? existingRow?.realizedPrice,
    reserveRisk: latest.reserveRisk,
    mvrvZscore: latest.mvrvZscore ?? existingRow?.mvrvZscore,
    nupl: latest.nupl ?? existingRow?.nupl,
    lthMvrv: latest.lthMvrv ?? existingRow?.lthMvrv,
    lthSopr: latest.lthSopr ?? existingRow?.lthSopr,
    lthSoprMa3: latest.lthSoprMa3 ?? existingRow?.lthSoprMa3,
    sthSopr: latest.sthSopr,
    sthSoprMa3: latest.sthSoprMa3 ?? existingRow?.sthSoprMa3,
    sthMvrv: latest.sthMvrv,
    puellMultiple: latest.puellMultiple,
    signalPriceMa200w: signalsV4?.priceMa200w ?? latest.signals.priceMa200w,
    signalPriceRealized: signalsV4?.priceRealized ?? latest.signals.priceRealized,
    signalReserveRisk: latest.signals.reserveRisk,
    signalReserveRiskV4: signalsV4?.reserveRisk ?? signalsV4?.mvrvZscore ?? existingRow?.signalReserveRiskV4,
    signalMvrvZscoreCore: latest.signalMvrvZscoreCore
      ?? signalsV6?.mvrvZscore
      ?? signalsV4?.mvrvZscore
      ?? signalsV4?.reserveRisk
      ?? existingRow?.signalMvrvZscoreCore,
    signalNupl: latest.signalNupl ?? signalsV6?.nupl ?? existingRow?.signalNupl,
    signalNuplCore: latest.signalNuplCore ?? signalsV6?.nupl ?? existingRow?.signalNuplCore,
    signalValuationBlendV6: latest.signalValuationBlendV6 ?? signalsV6?.valuationBlend ?? existingRow?.signalValuationBlendV6,
    signalSthSopr: latest.signals.sthSopr,
    signalSthMvrv: signalsV6?.sthMvrv ?? signalsV4?.sthMvrv ?? latest.signals.sthMvrv,
    signalSthGroup: latest.signalSthGroup ?? latest.signals.sthGroup ?? existingRow?.signalSthGroup,
    signalLthMvrv: signalsV6?.lthMvrv ?? signalsV4?.lthMvrv ?? existingRow?.signalLthMvrv,
    signalLthSopr: signalsV6?.lthSopr ?? signalsV4?.lthSopr ?? existingRow?.signalLthSopr,
    signalSthSoprTrigger: signalsV6?.sthSoprTrigger ?? signalsV4?.sthSoprTrigger ?? existingRow?.signalSthSoprTrigger,
    signalSthSoprAux: existingRow?.signalSthSoprAux,
    signalPuell: signalsV6?.puell ?? signalsV4?.puell ?? latest.signals.puell,
    signalCount: latest.signalCount,
    signalCountV4: latest.signalCountV4 ?? existingRow?.signalCountV4,
    signalCountV6: latest.signalCountV6 ?? existingRow?.signalCountV6,
    activeIndicatorCount: latest.activeIndicatorCount ?? existingRow?.activeIndicatorCount,
    activeIndicatorCountV4: latest.activeIndicatorCountV4 ?? existingRow?.activeIndicatorCountV4,
    activeIndicatorCountV6: latest.activeIndicatorCountV6 ?? existingRow?.activeIndicatorCountV6,
    maxSignalScoreV2: latest.maxSignalScoreV2 ?? existingRow?.maxSignalScoreV2,
    scorePriceMa200w: latest.scorePriceMa200w ?? existingRow?.scorePriceMa200w,
    scorePriceRealized: latest.scorePriceRealized ?? existingRow?.scorePriceRealized,
    scoreReserveRisk: latest.scoreReserveRisk ?? existingRow?.scoreReserveRisk,
    scoreReserveRiskV4: latest.scoreReserveRiskV4 ?? existingRow?.scoreReserveRiskV4,
    scoreMvrvZscore: latest.scoreMvrvZscore ?? existingRow?.scoreMvrvZscore,
    scoreMvrvZscoreCore: latest.scoreMvrvZscoreCore ?? existingRow?.scoreMvrvZscoreCore,
    scoreNupl: latest.scoreNupl ?? existingRow?.scoreNupl,
    scoreNuplCore: latest.scoreNuplCore ?? existingRow?.scoreNuplCore,
    valuationBlendScoreV6: latest.valuationBlendScoreV6 ?? existingRow?.valuationBlendScoreV6,
    scoreLthMvrv: latest.scoreLthMvrv ?? existingRow?.scoreLthMvrv,
    scoreLthSopr: latest.scoreLthSopr ?? existingRow?.scoreLthSopr,
    scoreSthSopr: latest.scoreSthSopr ?? existingRow?.scoreSthSopr,
    scoreSthMvrv: latest.scoreSthMvrv ?? existingRow?.scoreSthMvrv,
    scoreSthGroup: latest.scoreSthGroup ?? existingRow?.scoreSthGroup,
    scorePuell: latest.scorePuell ?? existingRow?.scorePuell,
    signalScoreV2: latest.signalScoreV2 ?? existingRow?.signalScoreV2,
    signalScoreV2Min3d: latest.signalScoreV2Min3d ?? existingRow?.signalScoreV2Min3d,
    signalConfirmed3d: latest.signalConfirmed3d ?? existingRow?.signalConfirmed3d,
    signalBandV2: latest.signalBandV2 ?? existingRow?.signalBandV2,
    valuationScore: latest.valuationScore ?? existingRow?.valuationScore,
    maxValuationScore: latest.maxValuationScore ?? existingRow?.maxValuationScore,
    triggerScore: latest.triggerScore ?? existingRow?.triggerScore,
    maxTriggerScore: latest.maxTriggerScore ?? existingRow?.maxTriggerScore,
    confirmationScore: latest.confirmationScore ?? existingRow?.confirmationScore,
    maxConfirmationScore: latest.maxConfirmationScore ?? existingRow?.maxConfirmationScore,
    auxiliaryScore: latest.auxiliaryScore ?? existingRow?.auxiliaryScore,
    maxAuxiliaryScore: latest.maxAuxiliaryScore ?? existingRow?.maxAuxiliaryScore,
    totalScoreV4: latest.totalScoreV4 ?? existingRow?.totalScoreV4,
    maxTotalScoreV4: latest.maxTotalScoreV4 ?? existingRow?.maxTotalScoreV4,
    totalScoreV4Min3d: latest.totalScoreV4Min3d ?? existingRow?.totalScoreV4Min3d,
    signalConfirmed3dV4: latest.signalConfirmed3dV4 ?? existingRow?.signalConfirmed3dV4,
    signalBandV4: latest.signalBandV4 ?? existingRow?.signalBandV4,
    valuationScoreV6: latest.valuationScoreV6 ?? existingRow?.valuationScoreV6,
    maxValuationScoreV6: latest.maxValuationScoreV6 ?? existingRow?.maxValuationScoreV6,
    triggerScoreV6: latest.triggerScoreV6 ?? existingRow?.triggerScoreV6,
    maxTriggerScoreV6: latest.maxTriggerScoreV6 ?? existingRow?.maxTriggerScoreV6,
    confirmationScoreV6: latest.confirmationScoreV6 ?? existingRow?.confirmationScoreV6,
    maxConfirmationScoreV6: latest.maxConfirmationScoreV6 ?? existingRow?.maxConfirmationScoreV6,
    totalScoreV6: latest.totalScoreV6 ?? existingRow?.totalScoreV6,
    maxTotalScoreV6: latest.maxTotalScoreV6 ?? existingRow?.maxTotalScoreV6,
    totalScoreV6Min3d: latest.totalScoreV6Min3d ?? existingRow?.totalScoreV6Min3d,
    signalConfirmed3dV6: latest.signalConfirmed3dV6 ?? existingRow?.signalConfirmed3dV6,
    signalBandV6: latest.signalBandV6 ?? existingRow?.signalBandV6,
    signalConfidence: latest.signalConfidence ?? existingRow?.signalConfidence,
    signalConfidenceV6: latest.signalConfidenceV6 ?? existingRow?.signalConfidenceV6,
    dataFreshnessScore: latest.dataFreshnessScore ?? existingRow?.dataFreshnessScore,
    dataFreshnessScoreV6: latest.dataFreshnessScoreV6 ?? existingRow?.dataFreshnessScoreV6,
    fallbackMode: latest.fallbackMode ?? existingRow?.fallbackMode,
    fallbackModeV6: latest.fallbackModeV6 ?? existingRow?.fallbackModeV6,
    staleIndicators: latest.staleIndicators ?? existingRow?.staleIndicators,
    coreIndicatorSet: latest.coreIndicatorSet ?? existingRow?.coreIndicatorSet,
    scoringModelVersion: latest.scoringModelVersion ?? existingRow?.scoringModelVersion,
    thresholds: latest.thresholds ?? existingRow?.thresholds,
    indicatorDates: latest.indicatorDates ?? existingRow?.indicatorDates,
    signalsV6: latest.signalsV6 ?? existingRow?.signalsV6,
    signalMvrvZ: latest.signalMvrvZ ?? existingRow?.signalMvrvZ,
  };
}

export function mergeLatestIntoHistory(
  history: IndicatorData[],
  latest: LatestData | null,
): IndicatorData[] {
  if (!latest?.date) {
    return history;
  }

  const existingIndex = history.findIndex((row) => row.d === latest.date);
  if (existingIndex >= 0) {
    const next = history.slice();
    next[existingIndex] = latestDataToHistoryRow(latest, next[existingIndex]);
    return next;
  }

  const lastHistoryDate = history.at(-1)?.d;
  if (lastHistoryDate && latest.date < lastHistoryDate) {
    return history;
  }

  return [
    ...history,
    latestDataToHistoryRow(latest),
  ];
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

  return filteredData
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
        const observedDate = item.indicatorDates?.reserveRisk;
        const hasObservedDate = typeof observedDate === 'string' && observedDate.length > 0;
        value = hasObservedDate
          ? (observedDate === item.d ? (item.reserveRisk ?? null) : null)
          : (item.reserveRisk ?? null);
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
        const observedDate = item.indicatorDates?.mvrvZscore;
        const hasObservedDate = typeof observedDate === 'string' && observedDate.length > 0;
        value = hasObservedDate
          ? (observedDate === item.d ? (item.mvrvZscore ?? null) : null)
          : (item.mvrvZscore ?? null);
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
        const observedDate = item.indicatorDates?.nupl;
        const hasObservedDate = typeof observedDate === 'string' && observedDate.length > 0;
        value = hasObservedDate
          ? (observedDate === item.d ? (item.nupl ?? null) : null)
          : (item.nupl ?? null);
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
}

export function getMA200ChartData(
  data: IndicatorData[],
  range: TimeRange,
): { date: string; price: number; ma200: number; signal: boolean }[] {
  return filterDataByTimeRange(data, range)
    .filter((item) => hasUsableValue(item.btcPrice) && (hasUsableValue(item.ma200w) || hasUsableValue(item.priceMa200wRatio)))
    .map((item) => {
      const price = toNumericPrice(item.btcPrice);
      let ma200 = item.ma200w;

      if ((!ma200 || ma200 <= 0) && item.priceMa200wRatio && item.priceMa200wRatio > 0) {
        ma200 = price / item.priceMa200wRatio;
      }

      return {
        date: item.d,
        price,
        ma200: toFiniteNumber(ma200, 0),
        signal: item.signalPriceMa200w ?? item.signalPriceMa ?? false,
      };
    });
}

export function getSignalEvents(data: IndicatorData[], minSignals = 4): SignalEvent[] {
  return data
    .filter((item) => ((item.signalCountV6 ?? item.signalCountV4 ?? item.signalCount) ?? 0) >= minSignals)
    .map((item) => ({
      date: item.d,
      btcPrice: toNumericPrice(item.btcPrice),
      signalCount: item.signalCountV6 ?? item.signalCountV4 ?? item.signalCount ?? 0,
      triggeredIndicators: [
        item.signalPriceMa200w || item.signalPriceMa ? 'Price / 200W-MA' : '',
        item.signalPriceRealized ? 'Price / Realized Price' : '',
        (item.signalsV6?.valuationBlend ?? item.signalValuationBlendV6 ?? item.signalMvrvZscoreCore ?? item.signalNuplCore)
          ? '估值融合(MVRV Z/NUPL)'
          : '',
        item.signalSthMvrv ? 'STH-MVRV' : '',
        (item.signalSthSoprTrigger ?? item.signalSthSoprAux ?? item.signalSthSopr) ? 'STH-SOPR' : '',
        item.signalLthMvrv ? 'LTH-MVRV' : '',
        item.signalLthSopr ? 'LTH-SOPR' : '',
        item.signalPuell ? 'Puell Multiple' : '',
      ].filter(Boolean),
    }));
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

/** On-chain indicator keys — exclude btcPrice and priceMa200w (price-based). */
const ONCHAIN_INDICATOR_DATE_KEYS = [
  'priceRealized',
  'lthMvrv',
  'lthSopr',
  'sthSopr',
  'sthMvrv',
  'puell',
] as const;

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
    getValuationBlendDate(indicatorDates),
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

export const INDICATOR_CONFIG = {
  priceMa200w: {
    name: 'Price / 200W-MA',
    unit: '',
    targetValue: 1,
    color: '#F7931A',
    description: '现价相对 200 周均线的位置。',
  },
  priceRealized: {
    name: 'Price / Realized Price',
    unit: '',
    targetValue: 1,
    color: '#0EA5E9',
    description: '现价相对链上实现价格的位置。',
  },
  valuationBlend: {
    name: '估值融合',
    unit: '',
    targetValue: 1,
    color: '#14B8A6',
    description: 'MVRV Z-Score 与 NUPL 共享估值槽位，取两者核心分较高者。',
  },
  mvrvZscore: {
    name: 'MVRV Z-Score',
    unit: '',
    targetValue: 0,
    color: '#10B981',
    description: '估值过热/过冷的标准化位置。',
  },
  nupl: {
    name: 'NUPL',
    unit: '',
    targetValue: 0.15,
    color: '#14B8A6',
    description: '净未实现盈亏，用于补强估值层并与 MVRV Z-Score 共享计分槽位。',
  },
  reserveRisk: {
    name: 'Reserve Risk (Observation)',
    unit: '',
    targetValue: 0.0016,
    color: '#10B981',
    description: '长期持有者风险回报区间，仅保留为观测项。',
  },
  lthMvrv: {
    name: 'LTH-MVRV',
    unit: '',
    targetValue: 1,
    color: '#8B5CF6',
    description: '长期持有者未实现盈亏比，确认层。',
  },
  lthSopr: {
    name: 'LTH-SOPR',
    unit: '',
    targetValue: 0.9,
    color: '#A855F7',
    description: '长期持有者已实现盈亏比，确认层，使用 3 日均值和滚动 p20/p10 阈值。',
  },
  sthSopr: {
    name: 'STH-SOPR',
    unit: '',
    targetValue: 1,
    color: '#EAB308',
    description: '短期持有者已实现盈亏比，触发层，使用 3 日均值和滚动分位数。',
  },
  sthMvrv: {
    name: 'STH-MVRV',
    unit: '',
    targetValue: 1,
    color: '#22C55E',
    description: '短期持有者未实现盈亏压力，触发阈值使用过去 1460 天滚动 p27。',
  },
  puell: {
    name: 'Puell Multiple',
    unit: '',
    targetValue: 0.6,
    color: '#F97316',
    description: '矿工收入相对历史基准。',
  },
} as const;

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1w': '近1周',
  '1m': '近1月',
  '6m': '近6月',
  '1y': '近1年',
  all: '全部历史',
};
