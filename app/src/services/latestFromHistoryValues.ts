import type { IndicatorData } from '@/types';

import { getLatestHistoryThresholds, toNumericPrice } from './latestFromHistoryThresholds';
import { toFiniteNumber } from './normalizers';

export function resolveLatestHistoryValues(latest: IndicatorData) {
  const sthSopr = toFiniteNumber(latest.sthSopr, 0);
  const sthSoprMa3 = latest.sthSoprMa3;
  const lthSopr = toFiniteNumber(latest.lthSopr, 0);
  const lthSoprMa3 = latest.lthSoprMa3;

  return {
    btcPrice: toNumericPrice(latest.btcPrice),
    priceMa200wRatio: toFiniteNumber(latest.priceMa200wRatio, 0),
    priceRealizedRatio: toFiniteNumber(latest.priceRealizedRatio, 0),
    reserveRisk: toFiniteNumber(latest.reserveRisk, 0),
    mvrvZscore: toFiniteNumber(latest.mvrvZscore, 0),
    nupl: toFiniteNumber(latest.nupl, 0),
    sthSopr,
    sthSoprMa3,
    sthSoprSignalValue: toFiniteNumber(sthSoprMa3 ?? latest.sthSopr, 0),
    sthMvrv: toFiniteNumber(latest.sthMvrv, 0),
    puellMultiple: toFiniteNumber(latest.puellMultiple, 0),
    lthMvrv: toFiniteNumber(latest.lthMvrv, 0),
    lthSopr,
    lthSoprMa3,
    lthSoprSignalValue: toFiniteNumber(lthSoprMa3 ?? latest.lthSopr, 0),
    thresholds: getLatestHistoryThresholds(latest.thresholds),
  };
}
