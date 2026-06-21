import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveScoreThresholds } from '@/appDisplay';
import { SignalOverviewBadges } from './SignalOverviewBadges';
import { SignalOverviewDataHealth } from './SignalOverviewDataHealth';
import { SignalOverviewLayerScores } from './SignalOverviewLayerScores';
import { SignalOverviewScoreProgress } from './SignalOverviewScoreProgress';
import { SignalOverviewSummaryCards } from './SignalOverviewSummaryCards';
import {
  formatFallbackLabel,
  formatPrice,
  getFreshnessBadge,
  getSignalStatus,
  getSourceBadge,
  toPercent,
} from './signalOverviewSelectors';

interface SignalOverviewProps {
  btcPrice: number;
  signalCount: number;
  totalIndicators: number;
  signalScoreV2?: number;
  maxSignalScoreV2?: number;
  totalScoreV4?: number;
  maxTotalScoreV4?: number;
  totalScoreV6?: number;
  maxTotalScoreV6?: number;
  valuationScore?: number;
  maxValuationScore?: number;
  triggerScore?: number;
  maxTriggerScore?: number;
  confirmationScore?: number;
  maxConfirmationScore?: number;
  signalConfidence?: number;
  fallbackMode?: string;
  signalConfirmed3d?: boolean;
  signalConfirmed3dV4?: boolean;
  signalConfirmed3dV6?: boolean;
  dataTimestampLabel: string;
  dataSource: 'api' | 'static' | 'history';
  latestDataDate: string;
  priceFreshnessHours: number;
  onchainFreshnessHours: number;
  laggingIndicators: string[];
  oldestIndicatorDate?: string;
}

export function SignalOverview({
  btcPrice,
  signalCount,
  totalIndicators,
  signalScoreV2 = 0,
  maxSignalScoreV2 = 10,
  totalScoreV4,
  maxTotalScoreV4,
  totalScoreV6,
  maxTotalScoreV6,
  valuationScore = 0,
  maxValuationScore = 8,
  triggerScore = 0,
  maxTriggerScore = 2,
  confirmationScore = 0,
  maxConfirmationScore = 4,
  signalConfidence,
  fallbackMode,
  signalConfirmed3d = false,
  signalConfirmed3dV4 = false,
  signalConfirmed3dV6 = false,
  dataTimestampLabel,
  dataSource,
  latestDataDate,
  priceFreshnessHours,
  onchainFreshnessHours,
  laggingIndicators,
  oldestIndicatorDate,
}: SignalOverviewProps) {
  const hasLayeredScore = totalScoreV6 !== undefined || totalScoreV4 !== undefined;
  const effectiveScore = totalScoreV6 ?? totalScoreV4 ?? signalScoreV2;
  const effectiveMaxScore = maxTotalScoreV6 ?? maxTotalScoreV4 ?? maxSignalScoreV2;
  const thresholds = resolveScoreThresholds(effectiveMaxScore);
  const status = getSignalStatus(effectiveScore, signalCount, effectiveMaxScore);
  const sourceBadge = getSourceBadge(dataSource);
  const priceFreshnessBadge = getFreshnessBadge(priceFreshnessHours);
  const onchainFreshnessBadge = getFreshnessBadge(onchainFreshnessHours);
  const hasLaggingIndicators = laggingIndicators.length > 0;
  const scoreProgress = Math.max(0, Math.min(100, (effectiveScore / Math.max(1, effectiveMaxScore)) * 100));
  const confidencePercent = toPercent(signalConfidence);
  const isConfirmed = signalConfirmed3dV6 || signalConfirmed3dV4 || signalConfirmed3d;
  const fallbackLabel = formatFallbackLabel(fallbackMode);

  return (
    <Card className="surface-card mb-6">
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">信号总览</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              基于分层指标体系，追踪估值、触发与确认三类底部识别信号。
            </p>
          </div>

          <SignalOverviewBadges
            sourceBadge={sourceBadge}
            priceFreshnessBadge={priceFreshnessBadge}
            onchainFreshnessBadge={onchainFreshnessBadge}
            dataTimestampLabel={dataTimestampLabel}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <SignalOverviewSummaryCards
          btcPriceLabel={formatPrice(btcPrice)}
          signalCount={signalCount}
          totalIndicators={totalIndicators}
          hasLayeredScore={hasLayeredScore}
          signalScoreV2={signalScoreV2}
          maxSignalScoreV2={maxSignalScoreV2}
          effectiveScore={effectiveScore}
          effectiveMaxScore={effectiveMaxScore}
          accumulateThreshold={thresholds.accumulate}
          status={status}
          isConfirmed={isConfirmed}
        />

        {hasLayeredScore && (
          <SignalOverviewLayerScores
            valuationScore={valuationScore}
            maxValuationScore={maxValuationScore}
            triggerScore={triggerScore}
            maxTriggerScore={maxTriggerScore}
            confirmationScore={confirmationScore}
            maxConfirmationScore={maxConfirmationScore}
          />
        )}

        <SignalOverviewDataHealth
          latestDataDate={latestDataDate}
          totalIndicators={totalIndicators}
          laggingIndicators={laggingIndicators}
          hasLaggingIndicators={hasLaggingIndicators}
          oldestIndicatorDate={oldestIndicatorDate}
          confidencePercent={confidencePercent}
          fallbackLabel={fallbackLabel}
        />

        <SignalOverviewScoreProgress
          hasLayeredScore={hasLayeredScore}
          scoreProgress={scoreProgress}
          thresholds={thresholds}
          effectiveMaxScore={effectiveMaxScore}
        />
      </CardContent>
    </Card>
  );
}
