import type { IndicatorData, LatestData } from '@/types';

import { hasUsableValue, toFiniteNumber } from './normalizers';

type Core8ScoreInput = Pick<
  LatestData,
  | 'scorePriceMa200w'
  | 'scoreMvrvZscoreCore'
  | 'scoreNuplCore'
  | 'scorePuell'
  | 'scoreSthMvrv'
  | 'scoreSthSopr'
  | 'scoreLthMvrv'
  | 'scoreLthSopr'
>;

type LatestHistoryDerivedSignals = {
  signals: {
    priceMa200w?: boolean;
    priceRealized?: boolean;
    reserveRisk?: boolean;
    sthSopr?: boolean;
    sthMvrv?: boolean;
    sthGroup?: boolean;
    puell?: boolean;
  };
  signalsV4: NonNullable<LatestData['signalsV4']>;
  signalsV6: NonNullable<LatestData['signalsV6']>;
};

type LatestHistoryCountSource = Pick<
  IndicatorData,
  | 'activeIndicatorCount'
  | 'maxSignalScoreV2'
  | 'activeIndicatorCountV4'
  | 'mvrvZscore'
  | 'activeIndicatorCountV6'
>;

export function resolveCore8Score(latest: Core8ScoreInput): {
  valuationScore: number;
  triggerScore: number;
  confirmationScore: number;
  totalScore: number;
} {
  const valuationScore = toFiniteNumber(latest.scorePriceMa200w, 0)
    + toFiniteNumber(latest.scoreMvrvZscoreCore, 0)
    + toFiniteNumber(latest.scoreNuplCore, 0)
    + toFiniteNumber(latest.scorePuell, 0);
  const triggerScore = Math.max(
    toFiniteNumber(latest.scoreSthMvrv, 0),
    toFiniteNumber(latest.scoreSthSopr, 0),
  );
  const confirmationScore = toFiniteNumber(latest.scoreLthMvrv, 0)
    + toFiniteNumber(latest.scoreLthSopr, 0);

  return {
    valuationScore,
    triggerScore,
    confirmationScore,
    totalScore: valuationScore + triggerScore + confirmationScore,
  };
}

export function deriveLatestHistoryCounts(
  latest: LatestHistoryCountSource,
  { signals, signalsV4, signalsV6 }: LatestHistoryDerivedSignals,
) {
  const groupedSignalCount = [
    signals.priceMa200w,
    signals.priceRealized,
    signals.reserveRisk,
    signals.sthGroup ?? (signals.sthSopr || signals.sthMvrv),
    signals.puell,
  ].filter(Boolean).length;
  const activeIndicatorCount = latest.activeIndicatorCount ?? 5;
  const maxSignalScoreV2 = latest.maxSignalScoreV2 ?? (activeIndicatorCount * 2);
  const groupedSignalCountV4 = [
    signalsV4.priceMa200w,
    signalsV4.priceRealized,
    signalsV4.mvrvZscore,
    signalsV4.sthMvrv,
    signalsV4.lthMvrv,
    signalsV4.lthSopr,
    signalsV4.puell,
  ].filter(Boolean).length;
  const activeIndicatorCountV4 = latest.activeIndicatorCountV4 ?? (hasUsableValue(latest.mvrvZscore) ? 7 : 6);
  const groupedSignalCountV6 = [
    signalsV6.priceMa200w,
    signalsV6.mvrvZscore,
    signalsV6.nupl,
    signalsV6.sthMvrv,
    signalsV6.sthSoprTrigger,
    signalsV6.lthMvrv,
    signalsV6.lthSopr,
    signalsV6.puell,
  ].filter(Boolean).length;
  const activeIndicatorCountV6 = latest.activeIndicatorCountV6 ?? 8;

  return {
    groupedSignalCount,
    activeIndicatorCount,
    maxSignalScoreV2,
    groupedSignalCountV4,
    activeIndicatorCountV4,
    groupedSignalCountV6,
    activeIndicatorCountV6,
  };
}
