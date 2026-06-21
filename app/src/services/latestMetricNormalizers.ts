import { toNumberOrNull } from './normalizerPrimitives';

export function normalizeLatestMetricValues(record: Record<string, unknown>) {
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
