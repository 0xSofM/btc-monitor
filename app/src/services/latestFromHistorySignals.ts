import type { IndicatorData } from '@/types';

import type { getLatestHistoryThresholds } from './latestFromHistoryThresholds';

type LatestHistoryThresholds = ReturnType<typeof getLatestHistoryThresholds>;

type LatestHistorySignalInputs = {
  latest: IndicatorData;
  priceMa200wRatio: number;
  priceRealizedRatio: number;
  reserveRisk: number;
  mvrvZscore: number;
  nupl: number;
  sthSoprSignalValue: number;
  sthMvrv: number;
  puellMultiple: number;
  lthMvrv: number;
  lthSoprSignalValue: number;
  thresholds: LatestHistoryThresholds;
};

export function deriveLatestHistorySignals({
  latest,
  priceMa200wRatio,
  priceRealizedRatio,
  reserveRisk,
  mvrvZscore,
  nupl,
  sthSoprSignalValue,
  sthMvrv,
  puellMultiple,
  lthMvrv,
  lthSoprSignalValue,
  thresholds,
}: LatestHistorySignalInputs) {
  const signalMvrvZscoreCore = latest.signalMvrvZscoreCore
    ?? latest.signalReserveRiskV4
    ?? latest.signalMvrvZ
    ?? (mvrvZscore < thresholds.mvrvZscore.trigger);
  const signalNuplCore = latest.signalNuplCore
    ?? latest.signalNupl
    ?? (nupl < thresholds.nupl.trigger);
  const signalValuationBlendV6 = latest.signalValuationBlendV6
    ?? latest.signalsV6?.valuationBlend
    ?? (signalMvrvZscoreCore || signalNuplCore);

  const signals = {
    priceMa200w: latest.signalPriceMa200w ?? latest.signalPriceMa ?? priceMa200wRatio < thresholds.priceMa200w.trigger,
    priceRealized: latest.signalPriceRealized ?? priceRealizedRatio < thresholds.priceRealized.trigger,
    reserveRisk: latest.signalReserveRisk ?? reserveRisk < thresholds.reserveRisk.trigger,
    sthSopr: latest.signalSthSopr ?? sthSoprSignalValue < thresholds.sthSopr.trigger,
    sthMvrv: latest.signalSthMvrv ?? sthMvrv < thresholds.sthMvrv.trigger,
    sthGroup: latest.signalSthGroup ?? ((latest.signalSthSopr ?? (sthSoprSignalValue < thresholds.sthSopr.trigger)) || (latest.signalSthMvrv ?? (sthMvrv < thresholds.sthMvrv.trigger))),
    puell: latest.signalPuell ?? puellMultiple < thresholds.puell.trigger,
  };
  const signalsV4 = {
    priceMa200w: latest.signalPriceMa200w ?? latest.signalPriceMa ?? priceMa200wRatio < thresholds.priceMa200w.trigger,
    priceRealized: latest.signalPriceRealized ?? priceRealizedRatio < thresholds.priceRealized.trigger,
    reserveRisk: signalMvrvZscoreCore,
    mvrvZscore: signalMvrvZscoreCore,
    sthMvrv: latest.signalSthMvrv ?? sthMvrv < thresholds.sthMvrv.trigger,
    lthMvrv: latest.signalLthMvrv ?? lthMvrv < thresholds.lthMvrv.trigger,
    lthSopr: latest.signalLthSopr ?? (lthSoprSignalValue < thresholds.lthSopr.trigger),
    puell: latest.signalPuell ?? puellMultiple < thresholds.puell.trigger,
    sthSoprTrigger: latest.signalSthSoprTrigger ?? latest.signalSthSoprAux ?? latest.signalSthSopr ?? (sthSoprSignalValue < thresholds.sthSopr.trigger),
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

  return {
    signals,
    signalsV4,
    signalsV6,
    signalMvrvZscoreCore,
    signalNuplCore,
    signalValuationBlendV6,
  };
}
