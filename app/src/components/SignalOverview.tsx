import { Clock3 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { resolveScoreThresholds } from '@/appDisplay';
import { SignalOverviewBadges } from './SignalOverviewBadges';
import { SignalOverviewLayerScores } from './SignalOverviewLayerScores';
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

        <section className="rounded-xl border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-4 w-4" />
              记录日期：{latestDataDate}
            </span>
            {hasLaggingIndicators && oldestIndicatorDate && (
              <span>指标日期：{oldestIndicatorDate}</span>
            )}
          </div>

          {hasLaggingIndicators ? (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              数据滞后指标：{laggingIndicators.join('、')}
            </p>
          ) : (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
              {totalIndicators} 个核心指标均与记录日期一致。
            </p>
          )}

          {(confidencePercent !== null || fallbackLabel) && (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {confidencePercent !== null && (
                <span className="text-muted-foreground">信号置信度：{confidencePercent}%</span>
              )}
              {fallbackLabel && (
                <span className="text-amber-700 dark:text-amber-300">{fallbackLabel}</span>
              )}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{hasLayeredScore ? '分层评分强度' : '加权评分强度'}</span>
            <span className="font-semibold">{scoreProgress.toFixed(0)}%</span>
          </div>
          <Progress value={scoreProgress} className="h-2.5" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>0-{Math.max(0, thresholds.focus - 1)} 观察</span>
            <span>{thresholds.focus}-{Math.max(thresholds.focus, thresholds.accumulate - 1)} 关注</span>
            <span>{thresholds.accumulate}-{Math.max(thresholds.accumulate, thresholds.extreme - 1)} 增强</span>
            <span>{thresholds.extreme}-{effectiveMaxScore} 极端</span>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
