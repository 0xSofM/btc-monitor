import { AlertTriangle, CheckCircle2, Clock3, Database, DollarSign, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface SignalOverviewProps {
  btcPrice: number;
  signalCount: number;
  totalIndicators: number;
  signalScoreV2?: number;
  maxSignalScoreV2?: number;
  totalScoreV4?: number;
  maxTotalScoreV4?: number;
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
  dataTimestampLabel: string;
  dataSource: 'api' | 'static' | 'history';
  latestDataDate: string;
  latestDataAgeHours: number;
  laggingIndicators: string[];
  oldestIndicatorDate?: string;
}

type SignalStatus = {
  label: string;
  toneClass: string;
  iconToneClass: string;
};

function resolveScoreThresholds(maxScore: number) {
  const safeMax = Math.max(1, maxScore);
  return {
    focus: Math.max(1, Math.ceil((safeMax * 4) / 12)),
    accumulate: Math.max(1, Math.ceil((safeMax * 7) / 12)),
    extreme: Math.max(1, Math.ceil((safeMax * 10) / 12)),
  };
}

function getSignalStatus(score: number, signalCount: number, maxScore: number): SignalStatus {
  const thresholds = resolveScoreThresholds(maxScore);

  if (score >= thresholds.extreme) {
    return {
      label: '极端底部',
      toneClass: 'text-green-700 dark:text-green-300',
      iconToneClass: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    };
  }

  if (score >= thresholds.accumulate) {
    return {
      label: '分批配置',
      toneClass: 'text-emerald-700 dark:text-emerald-300',
      iconToneClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    };
  }

  if (score >= thresholds.focus) {
    return {
      label: '重点关注',
      toneClass: 'text-amber-700 dark:text-amber-300',
      iconToneClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    };
  }

  if (signalCount > 0) {
    return {
      label: '早期观察',
      toneClass: 'text-blue-700 dark:text-blue-300',
      iconToneClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    };
  }

  return {
    label: '观察',
    toneClass: 'text-slate-700 dark:text-slate-300',
    iconToneClass: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  };
}

function getSourceBadge(source: SignalOverviewProps['dataSource']) {
  if (source === 'api') {
    return {
      label: '实时 API',
      className: 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300',
    };
  }

  if (source === 'history') {
    return {
      label: '历史回退',
      className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
    };
  }

  return {
    label: '静态快照',
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
  };
}

function getFreshnessBadge(hours: number) {
  if (hours <= 24) {
    return {
      label: `${hours.toFixed(1)}小时 新鲜`,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    };
  }

  if (hours <= 72) {
    return {
      label: `${hours.toFixed(1)}小时 滞后`,
      className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
    };
  }

  return {
    label: `${hours.toFixed(1)}小时 陈旧`,
    className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
  };
}

function formatPrice(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SignalOverview({
  btcPrice,
  signalCount,
  totalIndicators,
  signalScoreV2 = 0,
  maxSignalScoreV2 = 10,
  totalScoreV4,
  maxTotalScoreV4,
  valuationScore = 0,
  maxValuationScore = 8,
  triggerScore = 0,
  maxTriggerScore = 2,
  confirmationScore = 0,
  maxConfirmationScore = 2,
  signalConfidence,
  fallbackMode,
  signalConfirmed3d = false,
  signalConfirmed3dV4 = false,
  dataTimestampLabel,
  dataSource,
  latestDataDate,
  latestDataAgeHours,
  laggingIndicators,
  oldestIndicatorDate,
}: SignalOverviewProps) {
  const effectiveScore = totalScoreV4 ?? signalScoreV2;
  const effectiveMaxScore = maxTotalScoreV4 ?? maxSignalScoreV2;
  const thresholds = resolveScoreThresholds(effectiveMaxScore);
  const status = getSignalStatus(effectiveScore, signalCount, effectiveMaxScore);
  const sourceBadge = getSourceBadge(dataSource);
  const freshnessBadge = getFreshnessBadge(latestDataAgeHours);
  const hasLaggingIndicators = laggingIndicators.length > 0;
  const scoreProgress = Math.max(0, Math.min(100, (effectiveScore / Math.max(1, effectiveMaxScore)) * 100));
  const confidencePercent = signalConfidence === undefined ? null : Math.round(signalConfidence * 100);
  const fallbackLabel = fallbackMode === 'reserve_risk_soft_fallback'
    ? '储备风险已切换为 MVRV Z-Score 软回退'
    : fallbackMode === 'reserve_risk_inactive'
      ? '储备风险暂时不计入 V4 总分'
      : null;

  return (
    <Card className="surface-card mb-6">
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">信号总览</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              基于 Core-6 V4 分层模型，分别追踪估值、触发与确认三层状态。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={sourceBadge.className}>
              <Database className="mr-1 h-3 w-3" />
              {sourceBadge.label}
            </Badge>
            <Badge variant="outline" className={freshnessBadge.className}>
              <Clock3 className="mr-1 h-3 w-3" />
              {freshnessBadge.label}
            </Badge>
            <Badge variant="outline" className="text-xs">
              时间戳：{dataTimestampLabel}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-xl border bg-background/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              BTC 价格
            </div>
            <p className="text-2xl font-bold">{formatPrice(btcPrice)}</p>
          </article>

          <article className="rounded-xl border bg-background/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              触发数量
            </div>
            <p className="text-2xl font-bold">
              {signalCount}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ {totalIndicators}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalScoreV4 !== undefined ? `V4 总分：${effectiveScore}/${effectiveMaxScore}` : `V2 加权评分：${signalScoreV2}/${maxSignalScoreV2}`}
            </p>
          </article>

          <article className="rounded-xl border bg-background/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className={`rounded-full p-1 ${status.iconToneClass}`}>
                {effectiveScore >= thresholds.accumulate ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </span>
              市场状态
            </div>
            <p className={`text-2xl font-bold ${status.toneClass}`}>{status.label}</p>
            <p className={`mt-1 text-xs ${(signalConfirmed3dV4 || signalConfirmed3d) ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`}>
              {(signalConfirmed3dV4 || signalConfirmed3d) ? '已满足 3 日确认' : '尚未满足 3 日确认'}
            </p>
          </article>
        </section>

        {totalScoreV4 !== undefined && (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="rounded-xl border bg-background/70 p-4">
              <p className="text-sm text-muted-foreground">估值层</p>
              <p className="mt-1 text-xl font-semibold">{valuationScore}/{maxValuationScore}</p>
            </article>
            <article className="rounded-xl border bg-background/70 p-4">
              <p className="text-sm text-muted-foreground">触发层</p>
              <p className="mt-1 text-xl font-semibold">{triggerScore}/{maxTriggerScore}</p>
            </article>
            <article className="rounded-xl border bg-background/70 p-4">
              <p className="text-sm text-muted-foreground">确认层</p>
              <p className="mt-1 text-xl font-semibold">{confirmationScore}/{maxConfirmationScore}</p>
            </article>
          </section>
        )}

        <section className="rounded-xl border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-4 w-4" />
              最新记录：{latestDataDate}
            </span>
            {hasLaggingIndicators && oldestIndicatorDate && (
              <span>最早指标更新时间：{oldestIndicatorDate}</span>
            )}
          </div>

          {hasLaggingIndicators ? (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              延迟指标：{laggingIndicators.join('、')}
            </p>
          ) : (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
              {totalIndicators} 个核心指标均已对齐到最新记录日期。
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
            <span className="text-muted-foreground">{totalScoreV4 !== undefined ? 'V4 评分强度' : 'V2 评分强度'}</span>
            <span className="font-semibold">{scoreProgress.toFixed(0)}%</span>
          </div>
          <Progress value={scoreProgress} className="h-2.5" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>0-{Math.max(0, thresholds.focus - 1)} 观察</span>
            <span>{thresholds.focus}-{Math.max(thresholds.focus, thresholds.accumulate - 1)} 关注</span>
            <span>{thresholds.accumulate}-{Math.max(thresholds.accumulate, thresholds.extreme - 1)} 分批</span>
            <span>{thresholds.extreme}-{effectiveMaxScore} 极端</span>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
