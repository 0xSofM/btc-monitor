import { AlertTriangle, CheckCircle2, Clock3, Database, DollarSign, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface SignalOverviewProps {
  btcPrice: number;
  signalCount: number;
  totalIndicators: number;
  signalScoreV2?: number;
  signalConfirmed3d?: boolean;
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

function getSignalStatus(score: number, signalCount: number): SignalStatus {
  if (score >= 10) {
    return {
      label: '极端底部',
      toneClass: 'text-green-700 dark:text-green-300',
      iconToneClass: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    };
  }

  if (score >= 7) {
    return {
      label: '分批配置',
      toneClass: 'text-emerald-700 dark:text-emerald-300',
      iconToneClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    };
  }

  if (score >= 4) {
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
  signalConfirmed3d = false,
  dataTimestampLabel,
  dataSource,
  latestDataDate,
  latestDataAgeHours,
  laggingIndicators,
  oldestIndicatorDate,
}: SignalOverviewProps) {
  const status = getSignalStatus(signalScoreV2, signalCount);
  const sourceBadge = getSourceBadge(dataSource);
  const freshnessBadge = getFreshnessBadge(latestDataAgeHours);
  const hasLaggingIndicators = laggingIndicators.length > 0;
  const scoreProgress = Math.max(0, Math.min(100, (signalScoreV2 / 12) * 100));

  return (
    <Card className="surface-card mb-6">
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">信号总览</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              基于 Core-6 加权评分，并附带数据一致性校验，用于大周期底部监测。
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
            <p className="mt-1 text-xs text-muted-foreground">V2 加权评分：{signalScoreV2}/12</p>
          </article>

          <article className="rounded-xl border bg-background/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className={`rounded-full p-1 ${status.iconToneClass}`}>
                {signalScoreV2 >= 7 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </span>
              市场状态
            </div>
            <p className={`text-2xl font-bold ${status.toneClass}`}>{status.label}</p>
            <p className={`mt-1 text-xs ${signalConfirmed3d ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`}>
              {signalConfirmed3d ? '已满足 3 日确认' : '尚未满足 3 日确认'}
            </p>
          </article>
        </section>

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
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">V2 评分强度</span>
            <span className="font-semibold">{scoreProgress.toFixed(0)}%</span>
          </div>
          <Progress value={scoreProgress} className="h-2.5" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>0-3 观察</span>
            <span>4-6 关注</span>
            <span>7-9 分批</span>
            <span>10-12 极端</span>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
