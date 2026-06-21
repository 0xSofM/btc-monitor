import type { IndicatorData, LatestData } from '@/types';

export function getLatestHistorySignalFields(
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
