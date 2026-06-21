import { toNumberOrNull } from './normalizerPrimitives';

export function normalizeIndicatorMetricValues(record: Record<string, unknown>) {
  return {
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
  };
}
