import type { LatestData } from '@/types';

import { asBoolean, toNumberOrNull } from './normalizerPrimitives';

type LatestSignals = LatestData['signals'];

type LatestSignalInputs = {
  record: Record<string, unknown>;
  incomingSignals: Record<string, unknown> | null;
  incomingSignalsV4: Record<string, unknown> | null;
  incomingSignalsV6: Record<string, unknown> | null;
  priceMa200wRatio: number;
  priceRealizedRatio: number;
  reserveRisk: number;
  mvrvZscore: number;
  nupl: number | undefined;
  sthSoprSignalValue: number;
  sthMvrv: number;
  puellMultiple: number;
  lthSoprSignalValue: number;
};

function firstBoolean(...values: unknown[]): boolean | undefined {
  return asBoolean(values.reduce<unknown>((selected, value) => selected ?? value, undefined));
}

export function normalizeLatestSignals({
  record,
  incomingSignals,
  incomingSignalsV4,
  incomingSignalsV6,
  priceMa200wRatio,
  priceRealizedRatio,
  reserveRisk,
  mvrvZscore,
  nupl,
  sthSoprSignalValue,
  sthMvrv,
  puellMultiple,
  lthSoprSignalValue,
}: LatestSignalInputs): Pick<LatestData, 'signals' | 'signalsV4' | 'signalsV6'> {
  const signals: LatestSignals = {
    priceMa200w: firstBoolean(
      incomingSignals?.priceMa200w,
      record.signalPriceMa200w,
      record.signal_price_ma200w,
      record.signalPriceMa,
      record.signal_price_ma,
    )
      ?? (priceMa200wRatio < 1),
    priceRealized: firstBoolean(
      incomingSignals?.priceRealized,
      record.signalPriceRealized,
      record.signal_price_realized,
    )
      ?? (priceRealizedRatio < 1),
    reserveRisk: firstBoolean(
      incomingSignals?.reserveRisk,
      record.signalReserveRisk,
      record.signal_reserve_risk,
    )
      ?? (reserveRisk < 0.0016),
    sthSopr: firstBoolean(
      incomingSignals?.sthSopr,
      record.signalSthSopr,
      record.signal_sth_sopr,
    )
      ?? (sthSoprSignalValue < 1),
    sthMvrv: firstBoolean(
      incomingSignals?.sthMvrv,
      record.signalSthMvrv,
      record.signal_sth_mvrv,
    )
      ?? (sthMvrv < 1),
    sthGroup: firstBoolean(
      incomingSignals?.sthGroup,
      record.signalSthGroup,
      record.signal_sth_group,
    )
      ?? (sthSoprSignalValue < 1 || sthMvrv < 1),
    puell: firstBoolean(
      incomingSignals?.puell,
      record.signalPuell,
      record.signal_puell,
    )
      ?? (puellMultiple < 0.6),
  };

  const signalsV4: LatestData['signalsV4'] = incomingSignalsV4
    ? {
      priceMa200w: asBoolean(incomingSignalsV4.priceMa200w) ?? signals.priceMa200w,
      priceRealized: asBoolean(incomingSignalsV4.priceRealized) ?? signals.priceRealized,
      reserveRisk: firstBoolean(
        incomingSignalsV4.reserveRisk,
        incomingSignalsV4.mvrvZscore,
        record.signalReserveRiskV4,
        record.signal_reserve_risk_v4,
      ) ?? (mvrvZscore < 0),
      mvrvZscore: firstBoolean(
        incomingSignalsV4.mvrvZscore,
        incomingSignalsV4.reserveRisk,
        record.signalMvrvZscoreCore,
        record.signal_mvrv_zscore_core,
        record.signalReserveRiskV4,
        record.signal_reserve_risk_v4,
        record.signalMvrvZ,
        record.signal_mvrv_z,
      ) ?? (mvrvZscore < 0),
      sthMvrv: firstBoolean(
        incomingSignalsV4.sthMvrv,
        record.signalSthMvrv,
        record.signal_sth_mvrv,
      ) ?? signals.sthMvrv,
      lthMvrv: firstBoolean(
        incomingSignalsV4.lthMvrv,
        record.signalLthMvrv,
        record.signal_lth_mvrv,
      )
        ?? ((toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? 0) < 1),
      puell: firstBoolean(
        incomingSignalsV4.puell,
        record.signalPuell,
        record.signal_puell,
      ) ?? signals.puell,
      lthSopr: firstBoolean(
        incomingSignalsV4.lthSopr,
        record.signalLthSopr,
        record.signal_lth_sopr,
      )
        ?? (lthSoprSignalValue < 0.9),
      sthSoprTrigger: firstBoolean(
        incomingSignalsV4.sthSoprTrigger,
        incomingSignalsV4.sthSoprAux,
        record.signalSthSoprTrigger,
        record.signal_sth_sopr_trigger,
        record.signalSthSoprAux,
        record.signal_sth_sopr_aux,
      ) ?? signals.sthSopr,
    }
    : undefined;

  const signalsV6: LatestData['signalsV6'] = incomingSignalsV6
    ? {
      priceMa200w: asBoolean(incomingSignalsV6.priceMa200w) ?? signals.priceMa200w,
      priceRealized: asBoolean(incomingSignalsV6.priceRealized) ?? signals.priceRealized,
      mvrvZscore: firstBoolean(
        incomingSignalsV6.mvrvZscore,
        incomingSignalsV4?.mvrvZscore,
        incomingSignalsV4?.reserveRisk,
        record.signalMvrvZscoreCore,
        record.signal_mvrv_zscore_core,
      ) ?? (mvrvZscore < 0),
      nupl: firstBoolean(
        incomingSignalsV6.nupl,
        record.signalNuplCore,
        record.signal_nupl_core,
        record.signalNupl,
        record.signal_nupl,
      ) ?? ((nupl ?? 1) < 0.15),
      valuationBlend: firstBoolean(
        incomingSignalsV6.valuationBlend,
        record.signalValuationBlendV6,
        record.signal_valuation_blend_v6,
      ) ?? ((mvrvZscore < 0) || ((nupl ?? 1) < 0.15)),
      sthMvrv: firstBoolean(
        incomingSignalsV6.sthMvrv,
        record.signalSthMvrv,
        record.signal_sth_mvrv,
      ) ?? signals.sthMvrv,
      lthMvrv: firstBoolean(
        incomingSignalsV6.lthMvrv,
        record.signalLthMvrv,
        record.signal_lth_mvrv,
      )
        ?? ((toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? 0) < 1),
      lthSopr: firstBoolean(
        incomingSignalsV6.lthSopr,
        record.signalLthSopr,
        record.signal_lth_sopr,
      )
        ?? (lthSoprSignalValue < 0.9),
      puell: firstBoolean(
        incomingSignalsV6.puell,
        record.signalPuell,
        record.signal_puell,
      ) ?? signals.puell,
      sthSoprTrigger: firstBoolean(
        incomingSignalsV6.sthSoprTrigger,
        incomingSignalsV4?.sthSoprTrigger,
        incomingSignalsV4?.sthSoprAux,
        record.signalSthSoprTrigger,
        record.signal_sth_sopr_trigger,
        record.signalSthSoprAux,
        record.signal_sth_sopr_aux,
      ) ?? signals.sthSopr,
    }
    : undefined;

  return {
    signals,
    signalsV4,
    signalsV6,
  };
}
