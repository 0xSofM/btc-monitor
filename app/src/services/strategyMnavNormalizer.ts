import type { StrategyMnavData } from '@/types';

import { asBoolean, asRecord, asString, toNumberOrNull } from './normalizerPrimitives';

export function normalizeStrategyMnavData(item: unknown): StrategyMnavData | null {
  const record = asRecord(item);
  if (!record) {
    return null;
  }

  const date = asString(record.date);
  const mstrPayload = asRecord(record.mstr);
  const reservePayload = asRecord(record.btcReserve ?? record.btc_reserve);
  const mnavPayload = asRecord(record.mnav);
  if (!date || !mstrPayload || !reservePayload || !mnavPayload) {
    return null;
  }

  return {
    date,
    generatedAt: asString(record.generatedAt ?? record.generated_at),
    source: asString(record.source),
    formula: asString(record.formula),
    mstr: {
      price: toNumberOrNull(mstrPayload.price) ?? undefined,
      marketCapUsdM: toNumberOrNull(mstrPayload.marketCapUsdM ?? mstrPayload.market_cap_usd_m) ?? undefined,
      enterpriseValueUsdM: toNumberOrNull(mstrPayload.enterpriseValueUsdM ?? mstrPayload.enterprise_value_usd_m) ?? undefined,
      previousEnterpriseValueUsdM: toNumberOrNull(
        mstrPayload.previousEnterpriseValueUsdM ?? mstrPayload.previous_enterprise_value_usd_m,
      ) ?? undefined,
      debtUsdM: toNumberOrNull(mstrPayload.debtUsdM ?? mstrPayload.debt_usd_m) ?? undefined,
      preferredEquityUsdM: toNumberOrNull(mstrPayload.preferredEquityUsdM ?? mstrPayload.preferred_equity_usd_m) ?? undefined,
      debtPreferredByMarketCapPct: toNumberOrNull(
        mstrPayload.debtPreferredByMarketCapPct ?? mstrPayload.debt_preferred_by_market_cap_pct,
      ) ?? undefined,
      sharesVolume: toNumberOrNull(mstrPayload.sharesVolume ?? mstrPayload.shares_volume) ?? undefined,
      timestampUtc: asString(mstrPayload.timestampUtc ?? mstrPayload.timestamp_utc),
    },
    btcReserve: {
      btcHoldings: toNumberOrNull(reservePayload.btcHoldings ?? reservePayload.btc_holdings) ?? undefined,
      btcPriceUsd: toNumberOrNull(reservePayload.btcPriceUsd ?? reservePayload.btc_price_usd) ?? undefined,
      btcReserveUsdM: toNumberOrNull(reservePayload.btcReserveUsdM ?? reservePayload.btc_reserve_usd_m) ?? undefined,
      previousBtcReserveUsdM: toNumberOrNull(
        reservePayload.previousBtcReserveUsdM ?? reservePayload.previous_btc_reserve_usd_m,
      ) ?? undefined,
      satsPerShare: toNumberOrNull(reservePayload.satsPerShare ?? reservePayload.sats_per_share) ?? undefined,
      timestamp: asString(reservePayload.timestamp),
      msTimestamp: toNumberOrNull(reservePayload.msTimestamp ?? reservePayload.ms_timestamp) ?? undefined,
    },
    mnav: {
      value: toNumberOrNull(mnavPayload.value) ?? undefined,
      previousValue: toNumberOrNull(mnavPayload.previousValue ?? mnavPayload.previous_value) ?? undefined,
      change: toNumberOrNull(mnavPayload.change) ?? undefined,
      band: asString(mnavPayload.band),
      riskFlag: asString(mnavPayload.riskFlag ?? mnavPayload.risk_flag),
      equityPremium: toNumberOrNull(mnavPayload.equityPremium ?? mnavPayload.equity_premium) ?? undefined,
    },
    dataHealth: asRecord(record.dataHealth ?? record.data_health)
      ? {
          isStale: asBoolean(asRecord(record.dataHealth ?? record.data_health)?.isStale),
          mstrTimestampUtc: asString(asRecord(record.dataHealth ?? record.data_health)?.mstrTimestampUtc),
          btcTimestamp: asString(asRecord(record.dataHealth ?? record.data_health)?.btcTimestamp),
        }
      : undefined,
  };
}
