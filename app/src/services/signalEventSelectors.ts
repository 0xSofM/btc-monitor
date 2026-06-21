import type { IndicatorData, SignalEvent } from '@/types';

import { toFiniteNumber } from './normalizers';

function toNumericPrice(value: number | string | undefined): number {
  return toFiniteNumber(value, 0);
}

function getSignalCount(item: IndicatorData): number {
  return [
    item.signalPriceMa200w || item.signalPriceMa,
    item.signalsV6?.mvrvZscore ?? item.signalMvrvZscoreCore,
    item.signalsV6?.nupl ?? item.signalNuplCore ?? item.signalNupl,
    item.signalSthMvrv,
    item.signalSthSoprTrigger ?? item.signalSthSoprAux ?? item.signalSthSopr,
    item.signalLthMvrv,
    item.signalLthSopr,
    item.signalPuell,
  ].filter(Boolean).length;
}

function getTriggeredIndicators(item: IndicatorData): string[] {
  return [
    item.signalPriceMa200w || item.signalPriceMa ? 'Price / 200W-MA' : '',
    (item.signalsV6?.mvrvZscore ?? item.signalMvrvZscoreCore) ? 'MVRV Z-Score' : '',
    (item.signalsV6?.nupl ?? item.signalNuplCore ?? item.signalNupl) ? 'NUPL' : '',
    item.signalSthMvrv ? 'STH-MVRV' : '',
    (item.signalSthSoprTrigger ?? item.signalSthSoprAux ?? item.signalSthSopr) ? 'STH-SOPR' : '',
    item.signalLthMvrv ? 'LTH-MVRV' : '',
    item.signalLthSopr ? 'LTH-SOPR' : '',
    item.signalPuell ? 'Puell Multiple' : '',
  ].filter(Boolean);
}

export function getSignalEvents(data: IndicatorData[], minSignals = 4): SignalEvent[] {
  return data
    .map((item) => ({
      item,
      signalCount: getSignalCount(item),
    }))
    .filter(({ signalCount }) => signalCount >= minSignals)
    .map(({ item, signalCount }) => ({
      date: item.d,
      btcPrice: toNumericPrice(item.btcPrice),
      signalCount,
      triggeredIndicators: getTriggeredIndicators(item),
    }));
}
