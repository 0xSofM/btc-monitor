import type { IndicatorData, LatestData } from '@/types';

import { getLatestHistoryScoreFields } from './historyScoreMergeSelectors';

function getLatestHistoryMetricFields(
  latest: LatestData,
  existingRow: IndicatorData | undefined,
): Pick<
  IndicatorData,
  | 'btcPrice'
  | 'priceMa200wRatio'
  | 'priceRealizedRatio'
  | 'ma200w'
  | 'realizedPrice'
  | 'reserveRisk'
  | 'mvrvZscore'
  | 'nupl'
  | 'lthMvrv'
  | 'lthSopr'
  | 'lthSoprMa3'
  | 'sthSopr'
  | 'sthSoprMa3'
  | 'sthMvrv'
  | 'puellMultiple'
> {
  return {
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
  };
}

function getLatestHistorySignalFields(
  latest: LatestData,
  existingRow: IndicatorData | undefined,
): Pick<
  IndicatorData,
  | 'signalPriceMa200w'
  | 'signalPriceRealized'
  | 'signalReserveRisk'
  | 'signalReserveRiskV4'
  | 'signalMvrvZscoreCore'
  | 'signalNupl'
  | 'signalNuplCore'
  | 'signalValuationBlendV6'
  | 'signalSthSopr'
  | 'signalSthMvrv'
  | 'signalSthGroup'
  | 'signalLthMvrv'
  | 'signalLthSopr'
  | 'signalSthSoprTrigger'
  | 'signalSthSoprAux'
  | 'signalPuell'
> {
  const signalsV4 = latest.signalsV4;
  const signalsV6 = latest.signalsV6;

  return {
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
  };
}

export function latestDataToHistoryRow(
  latest: LatestData,
  existingRow?: IndicatorData,
): IndicatorData {
  return {
    ...existingRow,
    d: latest.date,
    ...getLatestHistoryMetricFields(latest, existingRow),
    ...getLatestHistorySignalFields(latest, existingRow),
    ...getLatestHistoryScoreFields(latest, existingRow),
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
