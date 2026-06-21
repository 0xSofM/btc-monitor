import type { LatestData } from '@/types';
import type { Core8Display, DataSource } from './appDisplay';
import {
  formatFallbackModeLabel,
  formatSignalBand,
} from './appDisplay';
import { buildLaggingIndicatorLabels } from './appIndicatorDateSelectors';
import { buildMarketAssessment } from './appMarketAssessmentSelectors';
import { TOTAL_CORE_INDICATORS, buildStatusTiles } from './appStatusTileSelectors';
import {
  getEffectiveDataDate,
  getOnchainFreshnessHours,
  getPriceFreshnessHours,
} from '@/services/dataService';

export function buildDashboardDisplay(
  latestData: LatestData | null,
  core8Display: Core8Display | null,
  dataSource: DataSource,
) {
  if (!latestData) {
    return {
      laggingIndicators: [],
      oldestIndicatorDate: undefined,
      priceFreshnessHours: 0,
      onchainFreshnessHours: 0,
      signalCountDisplay: 0,
      totalCoreIndicators: TOTAL_CORE_INDICATORS,
      marketAssessment: null,
      statusTiles: [],
      totalScoreV6: undefined,
      maxTotalScoreV6: 14,
      totalScoreV4: undefined,
      maxTotalScoreV4: 14,
    };
  }

  const laggingIndicators = buildLaggingIndicatorLabels(latestData);
  const effectiveDataDate = getEffectiveDataDate(latestData.date, latestData.indicatorDates);
  const oldestIndicatorDate = effectiveDataDate < latestData.date ? effectiveDataDate : undefined;
  const priceFreshnessHours = getPriceFreshnessHours(latestData.indicatorDates);
  const onchainFreshnessHours = getOnchainFreshnessHours(latestData.date, latestData.indicatorDates);
  const signalScoreV2 = latestData.signalScoreV2 ?? 0;
  const maxSignalScoreV2 = latestData.maxSignalScoreV2 ?? 10;
  const totalScoreV6 = core8Display?.totalScore ?? latestData.totalScoreV6;
  const maxTotalScoreV6 = core8Display?.maxTotalScore ?? latestData.maxTotalScoreV6 ?? 14;
  const totalScoreV4 = latestData.totalScoreV4;
  const maxTotalScoreV4 = latestData.maxTotalScoreV4 ?? 14;
  const hasLayeredScore = totalScoreV6 !== undefined || totalScoreV4 !== undefined;
  const signalCountDisplay = core8Display?.signalCount
    ?? latestData.signalCountV6
    ?? latestData.signalCountV4
    ?? latestData.signalCount
    ?? 0;
  const effectiveScore = totalScoreV6 ?? totalScoreV4 ?? signalScoreV2;
  const effectiveMaxScore = totalScoreV6 !== undefined
    ? maxTotalScoreV6
    : totalScoreV4 !== undefined
      ? maxTotalScoreV4
      : maxSignalScoreV2;
  const effectiveSignalBand = formatSignalBand(
    latestData.signalBandV6 ?? latestData.signalBandV4 ?? latestData.signalBandV2,
    effectiveScore,
    effectiveMaxScore,
  );
  const isSignalConfirmed = latestData.signalConfirmed3dV6
    ?? latestData.signalConfirmed3dV4
    ?? latestData.signalConfirmed3d
    ?? false;
  const fallbackModeLabel = formatFallbackModeLabel(
    core8Display?.fallbackMode ?? latestData.fallbackModeV6 ?? latestData.fallbackMode,
  );
  const confidenceValue = latestData.signalConfidenceV6 ?? latestData.signalConfidence;
  const freshnessValue = latestData.dataFreshnessScoreV6 ?? latestData.dataFreshnessScore;
  const confidencePercent = confidenceValue === undefined ? null : Math.round(confidenceValue * 100);
  const freshnessPercent = freshnessValue === undefined ? null : Math.round(freshnessValue * 100);

  return {
    laggingIndicators,
    oldestIndicatorDate,
    priceFreshnessHours,
    onchainFreshnessHours,
    signalCountDisplay,
    totalCoreIndicators: TOTAL_CORE_INDICATORS,
    marketAssessment: buildMarketAssessment(effectiveScore, effectiveMaxScore, hasLayeredScore),
    statusTiles: buildStatusTiles({
      latestData,
      dataSource,
      hasLayeredScore,
      effectiveScore,
      effectiveMaxScore,
      effectiveSignalBand,
      signalCountDisplay,
      isSignalConfirmed,
      confidencePercent,
      fallbackModeLabel,
      freshnessPercent,
    }),
    totalScoreV6,
    maxTotalScoreV6,
    totalScoreV4,
    maxTotalScoreV4,
  };
}
