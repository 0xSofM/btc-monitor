import { AlertTriangle, BookOpen, Building2, Info, ShieldCheck, TrendingDown } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type IndicatorItem = {
  id: string;
  name: string;
  icon: typeof TrendingDown;
  target: string;
  description: string;
  rationale: string;
};

const valuationIndicators: IndicatorItem[] = [
  {
    id: 'price-ma200w',
    name: 'Price / 200W-MA',
    icon: TrendingDown,
    target: '< 1；深度 < 0.85',
    description: '衡量 BTC 现价相对 200 周均线的位置。',
    rationale: '用于识别价格是否回到长期趋势基准附近。',
  },
  {
    id: 'mvrv-zscore',
    name: 'MVRV Z-Score',
    icon: TrendingDown,
    target: '< 0；深度 < -0.50',
    description: '衡量市值相对链上实现价值的标准化偏离。',
    rationale: '用于观察市场估值相对链上成本的压缩程度。',
  },
  {
    id: 'nupl',
    name: 'NUPL',
    icon: TrendingDown,
    target: '< 0.15；深度 < 0',
    description: '衡量全网净未实现盈亏状态。',
    rationale: '用于补充观察持币者整体盈亏结构是否接近低利润或亏损区。',
  },
  {
    id: 'puell',
    name: 'Puell Multiple',
    icon: TrendingDown,
    target: '< 0.6；深度 < 0.5',
    description: '比较矿工收入与历史基准水平。',
    rationale: '用于观察矿工收入压力和供给侧压力。',
  },
];

const triggerIndicators: IndicatorItem[] = [
  {
    id: 'sth-mvrv',
    name: 'STH-MVRV',
    icon: AlertTriangle,
    target: '< 滚动 p27；深度 < p13.5',
    description: '衡量短期持有者的未实现盈亏压力。',
    rationale: '用于识别短期筹码是否进入低位压力区间。',
  },
  {
    id: 'sth-sopr',
    name: 'STH-SOPR',
    icon: AlertTriangle,
    target: '3 日均值 < 滚动 p27；深度 < p13.5',
    description: '衡量短期持有者是否处于亏损兑现状态，使用 3 日均值降低单日噪声。',
    rationale: '与 STH-MVRV 共同构成短期触发层，系统取两者较高分作为触发层评分。',
  },
];

const confirmationIndicators: IndicatorItem[] = [
  {
    id: 'lth-mvrv',
    name: 'LTH-MVRV',
    icon: ShieldCheck,
    target: '< 1；深度 < 0.90',
    description: '衡量长期持有者的未实现盈亏状态。',
    rationale: '用于确认长期持有者成本结构是否进入低估值区域。',
  },
  {
    id: 'lth-sopr',
    name: 'LTH-SOPR',
    icon: ShieldCheck,
    target: '3 日均值 < 滚动 p20；深度 < p10',
    description: '衡量长期持有者的已实现盈亏状态，使用 3 日均值降低误触发。',
    rationale: '与 LTH-MVRV 互补，用于确认长期持有者是否出现亏损兑现压力。',
  },
];

function IndicatorGrid({ title, items }: { title: string; items: IndicatorItem[] }) {
  return (
    <section>
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((indicator) => {
          const Icon = indicator.icon;
          return (
            <article key={indicator.id} className="rounded-xl border bg-background/70 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full border bg-muted/50 p-2">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <div>
                    <h4 className="font-semibold leading-tight">{indicator.name}</h4>
                    <p className="text-xs text-muted-foreground">目标区间：{indicator.target}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{indicator.description}</p>
                  <p className="text-sm">{indicator.rationale}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function IndicatorExplanation() {
  return (
    <Card className="surface-card mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5" />
          核心指标说明
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <IndicatorGrid title="估值层" items={valuationIndicators} />
        <IndicatorGrid title="触发层" items={triggerIndicators} />
        <IndicatorGrid title="确认层" items={confirmationIndicators} />

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-300" />
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">分层评分框架</h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                系统跟踪 8 个核心指标，并按估值、短期触发、长期确认三层汇总。
                估值层包含 Price / 200W-MA、MVRV Z-Score、NUPL 和 Puell Multiple，满分 8 分。
                触发层取 STH-MVRV 与 STH-SOPR 的较高分，满分 2 分。
                确认层由 LTH-MVRV 与 LTH-SOPR 独立计分，满分 4 分。
                总分上限为 14 分，并使用 3 日确认规则降低单日波动对信号判断的影响。
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-background/70 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full border bg-muted/50 p-2">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">MSTR mNAV</h3>
              <p className="text-sm text-muted-foreground">
                mNAV 使用 Strategy 官方数据，衡量企业价值相对其 BTC 储备价值的倍数。
                数值高于 1 表示相对 BTC 储备存在溢价，低于 1 表示折价。
              </p>
              <p className="text-sm">
                该指标用于观察 BTC 代理资产的相对溢价与市场风险偏好，不参与 BTC 大周期底部综合评分。
              </p>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
