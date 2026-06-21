import { asBoolean } from './normalizerPrimitives';

export function normalizeIndicatorSignalValues(record: Record<string, unknown>) {
  return {
    signalPriceMa200w: asBoolean(record.signalPriceMa200w ?? record.signal_price_ma200w ?? record.signalPriceMa ?? record.signal_price_ma),
    signalPriceRealized: asBoolean(record.signalPriceRealized ?? record.signal_price_realized),
    signalReserveRisk: asBoolean(record.signalReserveRisk ?? record.signal_reserve_risk),
    signalReserveRiskV4: asBoolean(record.signalReserveRiskV4 ?? record.signal_reserve_risk_v4),
    signalMvrvZscoreCore: asBoolean(record.signalMvrvZscoreCore ?? record.signal_mvrv_zscore_core),
    signalNupl: asBoolean(record.signalNupl ?? record.signal_nupl),
    signalNuplCore: asBoolean(record.signalNuplCore ?? record.signal_nupl_core ?? record.signalNupl ?? record.signal_nupl),
    signalValuationBlendV6: asBoolean(record.signalValuationBlendV6 ?? record.signal_valuation_blend_v6),
    signalSthSopr: asBoolean(record.signalSthSopr ?? record.signal_sth_sopr),
    signalSthMvrv: asBoolean(record.signalSthMvrv ?? record.signal_sth_mvrv),
    signalSthGroup: asBoolean(record.signalSthGroup ?? record.signal_sth_group),
    signalLthMvrv: asBoolean(record.signalLthMvrv ?? record.signal_lth_mvrv),
    signalLthSopr: asBoolean(record.signalLthSopr ?? record.signal_lth_sopr),
    signalSthSoprTrigger: asBoolean(record.signalSthSoprTrigger ?? record.signal_sth_sopr_trigger),
    signalSthSoprAux: asBoolean(record.signalSthSoprAux ?? record.signal_sth_sopr_aux),
    signalPuell: asBoolean(record.signalPuell ?? record.signal_puell),
  };
}
