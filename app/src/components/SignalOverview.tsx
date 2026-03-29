import { AlertTriangle, CheckCircle2, Clock3, Database, DollarSign, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface SignalOverviewProps {
  btcPrice: number;
  signalCount: number;
  totalIndicators: number;
  lastUpdated: string;
  dataSource: 'api' | 'static' | 'history';
  latestDataDate: string;
  latestDataAgeHours: number;
  laggingIndicators: string[];
  oldestIndicatorDate?: string;
}

function getSignalStatus(signalCount: number) {
  if (signalCount === 0) return { label: '远离底部', color: 'text-gray-500' };
  if (signalCount <= 2) return { label: '偏离底部', color: 'text-blue-500' };
  if (signalCount === 3) return { label: '接近底部', color: 'text-yellow-500' };
  if (signalCount === 4) return { label: '买入机会', color: 'text-green-500' };
  return { label: '绝佳买入', color: 'text-green-600' };
}

function getSourceBadge(dataSource: SignalOverviewProps['dataSource']) {
  if (dataSource === 'api') {
    return { label: '实时 API', className: 'border-green-200 bg-green-50 text-green-700' };
  }

  if (dataSource === 'history') {
    return { label: '历史回退', className: 'border-yellow-200 bg-yellow-50 text-yellow-700' };
  }

  return { label: '静态快照', className: 'border-blue-200 bg-blue-50 text-blue-700' };
}

function getFreshnessBadge(hours: number) {
  if (hours <= 24) {
    return { label: `新鲜 ${hours.toFixed(1)}h`, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }

  if (hours <= 72) {
    return { label: `滞后 ${hours.toFixed(1)}h`, className: 'border-amber-200 bg-amber-50 text-amber-700' };
  }

  return { label: `陈旧 ${hours.toFixed(1)}h`, className: 'border-red-200 bg-red-50 text-red-700' };
}

export function SignalOverview({
  btcPrice,
  signalCount,
  totalIndicators,
  lastUpdated,
  dataSource,
  latestDataDate,
  latestDataAgeHours,
  laggingIndicators,
  oldestIndicatorDate,
}: SignalOverviewProps) {
  const progressPercentage = (signalCount / totalIndicators) * 100;
  const status = getSignalStatus(signalCount);
  const sourceBadge = getSourceBadge(dataSource);
  const freshnessBadge = getFreshnessBadge(latestDataAgeHours);
  const hasLaggingIndicators = laggingIndicators.length > 0;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-lg font-semibold">信号总览</CardTitle>
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
              更新于 {lastUpdated}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-orange-100 p-3 dark:bg-orange-900">
              <DollarSign className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">BTC 价格</p>
              <p className="text-2xl font-bold">
                ${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`rounded-full p-3 ${signalCount >= 4 ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
              <TrendingUp className={`h-6 w-6 ${signalCount >= 4 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">买入信号</p>
              <p className="text-2xl font-bold">
                {signalCount} <span className="text-sm font-normal text-muted-foreground">/ {totalIndicators}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={`rounded-full p-3 ${
                signalCount >= 4
                  ? 'bg-green-100 dark:bg-green-900'
                  : signalCount === 0
                    ? 'bg-gray-100 dark:bg-gray-800'
                    : signalCount <= 2
                      ? 'bg-blue-100 dark:bg-blue-900'
                      : 'bg-yellow-100 dark:bg-yellow-900'
              }`}
            >
              {signalCount >= 4 ? (
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              ) : signalCount === 0 ? (
                <TrendingUp className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              ) : (
                <AlertTriangle className={`h-6 w-6 ${signalCount <= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">市场状态</p>
              <p className={`text-xl font-bold ${status.color}`}>
                {status.label}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            <span>最新记录日期: {latestDataDate}</span>
            {oldestIndicatorDate && hasLaggingIndicators && (
              <span>最慢指标日期: {oldestIndicatorDate}</span>
            )}
          </div>
          {hasLaggingIndicators ? (
            <p className="mt-2 text-amber-700 dark:text-amber-300">
              以下指标尚未同步到最新记录日期: {laggingIndicators.join('、')}
            </p>
          ) : (
            <p className="mt-2 text-emerald-700 dark:text-emerald-300">
              5 个指标当前都使用同一天的数据。
            </p>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">信号强度</span>
            <span className="font-medium">{progressPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>0 信号 - 远离底部</span>
            <span>3 信号 - 接近底部</span>
            <span>5 信号 - 绝佳买入</span>
          </div>
        </div>

        {signalCount >= 4 ? (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-800 dark:text-green-200">建议执行定投计划</span>
            </div>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              当前有 {signalCount} 个指标达到买入区间，适合按计划分批执行。
            </p>
          </div>
        ) : signalCount === 0 ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="font-medium text-gray-800 dark:text-gray-200">市场处于常规区间</span>
            </div>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              当前没有指标达到极端买入区间，更适合保持观察或小额定投。
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-800 dark:text-blue-200">持续关注市场</span>
            </div>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              当前有 {signalCount} 个指标接近买入区间，可以继续观察后续变化。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
