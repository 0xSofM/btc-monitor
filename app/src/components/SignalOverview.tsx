import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, TrendingUp, DollarSign } from 'lucide-react';

interface SignalOverviewProps {
  btcPrice: number;
  signalCount: number;
  totalIndicators: number;
  lastUpdated: string;
}

export function SignalOverview({ 
  btcPrice, 
  signalCount, 
  totalIndicators,
  lastUpdated 
}: SignalOverviewProps) {
  const progressPercentage = (signalCount / totalIndicators) * 100;
  
  const getSignalStatus = () => {
    if (signalCount === 0) return { label: '远离底部', color: 'text-gray-500', bgColor: 'bg-gray-500' };
    if (signalCount <= 2) return { label: '偏离底部', color: 'text-blue-400', bgColor: 'bg-blue-400' };
    if (signalCount === 3) return { label: '接近底部', color: 'text-yellow-500', bgColor: 'bg-yellow-500' };
    if (signalCount === 4) return { label: '买入机会', color: 'text-green-500', bgColor: 'bg-green-500' };
    return { label: '绝佳买入', color: 'text-green-600', bgColor: 'bg-green-600' };
  };

  const status = getSignalStatus();

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">信号概览</CardTitle>
          <Badge variant="outline" className="text-xs">
            更新于: {lastUpdated}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* BTC价格 */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
              <DollarSign className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">BTC 价格</p>
              <p className="text-2xl font-bold">
                ${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* 信号数量 */}
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${signalCount >= 4 ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
              <TrendingUp className={`w-6 h-6 ${signalCount >= 4 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">买入信号</p>
              <p className="text-2xl font-bold">
                {signalCount} <span className="text-sm font-normal text-muted-foreground">/ {totalIndicators}</span>
              </p>
            </div>
          </div>

          {/* 市场状态 */}
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${
              signalCount >= 4 ? 'bg-green-100 dark:bg-green-900' : 
              signalCount === 0 ? 'bg-gray-100 dark:bg-gray-800' : 
              signalCount <= 2 ? 'bg-blue-100 dark:bg-blue-900' :
              'bg-yellow-100 dark:bg-yellow-900'
            }`}>
              {signalCount >= 4 ? (
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : signalCount === 0 ? (
                <TrendingUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              ) : (
                <AlertTriangle className={`w-6 h-6 ${signalCount <= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
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

        {/* 进度条 */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">信号强度</span>
            <span className="font-medium">{progressPercentage.toFixed(0)}%</span>
          </div>
          <Progress 
            value={progressPercentage} 
            className="h-3"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0信号 - 远离底部</span>
            <span>3信号 - 接近底部</span>
            <span>5信号 - 绝佳买入</span>
          </div>
        </div>

        {/* 建议 */}
        {signalCount >= 4 ? (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-800 dark:text-green-200">
                建议执行定投计划
              </span>
            </div>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              当前有 {signalCount} 个指标达到买入区间，是较好的建仓时机。建议按计划执行定投。
            </p>
          </div>
        ) : signalCount === 0 ? (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="font-medium text-gray-800 dark:text-gray-200">
                市场处于常规区间
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              当前没有指标达到极端买入区间，市场可能处于正常波动范围。建议保持观望或小额定投，等待更好的买入时机。
            </p>
          </div>
        ) : (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-800 dark:text-blue-200">
                持续关注市场
              </span>
            </div>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              当前有 {signalCount} 个指标接近买入区间，建议保持关注，准备资金等待更好的买入时机。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
