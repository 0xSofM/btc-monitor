import type { IndicatorData, LatestData } from '@/types';

export function getLatestHistoryScoreFields(
  latest: LatestData,
  existingRow: IndicatorData | undefined,
): Pick<
  IndicatorData,
  | 'signalCount'
  | 'signalCountV4'
  | 'signalCountV6'
  | 'activeIndicatorCount'
  | 'activeIndicatorCountV4'
  | 'activeIndicatorCountV6'
  | 'maxSignalScoreV2'
  | 'scorePriceMa200w'
  | 'scorePriceRealized'
  | 'scoreReserveRisk'
  | 'scoreReserveRiskV4'
  | 'scoreMvrvZscore'
  | 'scoreMvrvZscoreCore'
  | 'scoreNupl'
  | 'scoreNuplCore'
  | 'valuationBlendScoreV6'
  | 'scoreLthMvrv'
  | 'scoreLthSopr'
  | 'scoreSthSopr'
  | 'scoreSthMvrv'
  | 'scoreSthGroup'
  | 'scorePuell'
  | 'signalScoreV2'
  | 'signalScoreV2Min3d'
  | 'signalConfirmed3d'
  | 'signalBandV2'
  | 'valuationScore'
  | 'maxValuationScore'
  | 'triggerScore'
  | 'maxTriggerScore'
  | 'confirmationScore'
  | 'maxConfirmationScore'
  | 'auxiliaryScore'
  | 'maxAuxiliaryScore'
  | 'totalScoreV4'
  | 'maxTotalScoreV4'
  | 'totalScoreV4Min3d'
  | 'signalConfirmed3dV4'
  | 'signalBandV4'
  | 'valuationScoreV6'
  | 'maxValuationScoreV6'
  | 'triggerScoreV6'
  | 'maxTriggerScoreV6'
  | 'confirmationScoreV6'
  | 'maxConfirmationScoreV6'
  | 'totalScoreV6'
  | 'maxTotalScoreV6'
  | 'totalScoreV6Min3d'
  | 'signalConfirmed3dV6'
  | 'signalBandV6'
  | 'signalConfidence'
  | 'signalConfidenceV6'
  | 'dataFreshnessScore'
  | 'dataFreshnessScoreV6'
  | 'fallbackMode'
  | 'fallbackModeV6'
> {
  return {
    signalCount: latest.signalCount,
    signalCountV4: latest.signalCountV4 ?? existingRow?.signalCountV4,
    signalCountV6: latest.signalCountV6 ?? existingRow?.signalCountV6,
    activeIndicatorCount: latest.activeIndicatorCount ?? existingRow?.activeIndicatorCount,
    activeIndicatorCountV4: latest.activeIndicatorCountV4 ?? existingRow?.activeIndicatorCountV4,
    activeIndicatorCountV6: latest.activeIndicatorCountV6 ?? existingRow?.activeIndicatorCountV6,
    maxSignalScoreV2: latest.maxSignalScoreV2 ?? existingRow?.maxSignalScoreV2,
    scorePriceMa200w: latest.scorePriceMa200w ?? existingRow?.scorePriceMa200w,
    scorePriceRealized: latest.scorePriceRealized ?? existingRow?.scorePriceRealized,
    scoreReserveRisk: latest.scoreReserveRisk ?? existingRow?.scoreReserveRisk,
    scoreReserveRiskV4: latest.scoreReserveRiskV4 ?? existingRow?.scoreReserveRiskV4,
    scoreMvrvZscore: latest.scoreMvrvZscore ?? existingRow?.scoreMvrvZscore,
    scoreMvrvZscoreCore: latest.scoreMvrvZscoreCore ?? existingRow?.scoreMvrvZscoreCore,
    scoreNupl: latest.scoreNupl ?? existingRow?.scoreNupl,
    scoreNuplCore: latest.scoreNuplCore ?? existingRow?.scoreNuplCore,
    valuationBlendScoreV6: latest.valuationBlendScoreV6 ?? existingRow?.valuationBlendScoreV6,
    scoreLthMvrv: latest.scoreLthMvrv ?? existingRow?.scoreLthMvrv,
    scoreLthSopr: latest.scoreLthSopr ?? existingRow?.scoreLthSopr,
    scoreSthSopr: latest.scoreSthSopr ?? existingRow?.scoreSthSopr,
    scoreSthMvrv: latest.scoreSthMvrv ?? existingRow?.scoreSthMvrv,
    scoreSthGroup: latest.scoreSthGroup ?? existingRow?.scoreSthGroup,
    scorePuell: latest.scorePuell ?? existingRow?.scorePuell,
    signalScoreV2: latest.signalScoreV2 ?? existingRow?.signalScoreV2,
    signalScoreV2Min3d: latest.signalScoreV2Min3d ?? existingRow?.signalScoreV2Min3d,
    signalConfirmed3d: latest.signalConfirmed3d ?? existingRow?.signalConfirmed3d,
    signalBandV2: latest.signalBandV2 ?? existingRow?.signalBandV2,
    valuationScore: latest.valuationScore ?? existingRow?.valuationScore,
    maxValuationScore: latest.maxValuationScore ?? existingRow?.maxValuationScore,
    triggerScore: latest.triggerScore ?? existingRow?.triggerScore,
    maxTriggerScore: latest.maxTriggerScore ?? existingRow?.maxTriggerScore,
    confirmationScore: latest.confirmationScore ?? existingRow?.confirmationScore,
    maxConfirmationScore: latest.maxConfirmationScore ?? existingRow?.maxConfirmationScore,
    auxiliaryScore: latest.auxiliaryScore ?? existingRow?.auxiliaryScore,
    maxAuxiliaryScore: latest.maxAuxiliaryScore ?? existingRow?.maxAuxiliaryScore,
    totalScoreV4: latest.totalScoreV4 ?? existingRow?.totalScoreV4,
    maxTotalScoreV4: latest.maxTotalScoreV4 ?? existingRow?.maxTotalScoreV4,
    totalScoreV4Min3d: latest.totalScoreV4Min3d ?? existingRow?.totalScoreV4Min3d,
    signalConfirmed3dV4: latest.signalConfirmed3dV4 ?? existingRow?.signalConfirmed3dV4,
    signalBandV4: latest.signalBandV4 ?? existingRow?.signalBandV4,
    valuationScoreV6: latest.valuationScoreV6 ?? existingRow?.valuationScoreV6,
    maxValuationScoreV6: latest.maxValuationScoreV6 ?? existingRow?.maxValuationScoreV6,
    triggerScoreV6: latest.triggerScoreV6 ?? existingRow?.triggerScoreV6,
    maxTriggerScoreV6: latest.maxTriggerScoreV6 ?? existingRow?.maxTriggerScoreV6,
    confirmationScoreV6: latest.confirmationScoreV6 ?? existingRow?.confirmationScoreV6,
    maxConfirmationScoreV6: latest.maxConfirmationScoreV6 ?? existingRow?.maxConfirmationScoreV6,
    totalScoreV6: latest.totalScoreV6 ?? existingRow?.totalScoreV6,
    maxTotalScoreV6: latest.maxTotalScoreV6 ?? existingRow?.maxTotalScoreV6,
    totalScoreV6Min3d: latest.totalScoreV6Min3d ?? existingRow?.totalScoreV6Min3d,
    signalConfirmed3dV6: latest.signalConfirmed3dV6 ?? existingRow?.signalConfirmed3dV6,
    signalBandV6: latest.signalBandV6 ?? existingRow?.signalBandV6,
    signalConfidence: latest.signalConfidence ?? existingRow?.signalConfidence,
    signalConfidenceV6: latest.signalConfidenceV6 ?? existingRow?.signalConfidenceV6,
    dataFreshnessScore: latest.dataFreshnessScore ?? existingRow?.dataFreshnessScore,
    dataFreshnessScoreV6: latest.dataFreshnessScoreV6 ?? existingRow?.dataFreshnessScoreV6,
    fallbackMode: latest.fallbackMode ?? existingRow?.fallbackMode,
    fallbackModeV6: latest.fallbackModeV6 ?? existingRow?.fallbackModeV6,
  };
}
