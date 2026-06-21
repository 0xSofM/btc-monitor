import type { IndicatorData, LatestData } from '@/types';

export function getLatestHistoryMetricFields(
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
