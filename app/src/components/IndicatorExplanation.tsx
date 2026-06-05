import { AlertTriangle, BookOpen, Info, ShieldCheck, TrendingDown } from 'lucide-react';

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
    target: '< 1（深度 < 0.85）',
    description: '衡量现价相对 200 周均线的位置，是大周期趋势锚点之一。',
    rationale: '价格跌破 200 周均线通常发生在恐慌阶段，长期风险回报比更优。',
  },
  {
    id: 'price-realized',
    name: 'Price / Realized Price',
    icon: TrendingDown,
    target: '< 1（深度 < 0.90）',
    description: '比较现价与链上实现价格，反映市场是否跌破全网平均成本。',
    rationale: '价格低于实现价格常对应低估区，是大周期底部的重要估值锚。',
  },
  {
    id: 'valuation-blend',
    name: '估值融合（MVRV Z + NUPL）',
    icon: TrendingDown,
    target: 'MVRV Z < 0 或 NUPL < 0.15',
    description: '把 MVRV Z-Score 与 NUPL 合并为一个估值展示项，并取两者核心分较高者计入 V6。',
    rationale: '两者都刻画市场估值和持币者盈亏状态，合并后能减少重复计数，同时保留 NUPL 对底部区间的补强能力。',
  },
  {
    id: 'puell',
    name: 'Puell Multiple',
    icon: TrendingDown,
    target: '< 0.6（深度 < 0.5）',
    description: '比较矿工收入与历史常态水平，评估供给侧压力。',
    rationale: 'Puell 处于低位常见于矿工压力释放后的后半阶段。',
  },
];

const triggerIndicators: IndicatorItem[] = [
  {
    id: 'sth-mvrv',
    name: 'STH-MVRV',
    icon: AlertTriangle,
    target: '< p27（深度 < p13.5）',
    description: '衡量短期持有者未实现盈亏压力，观察恐慌是否扩散到短期筹码。',
    rationale: '它更适合回答“底部区域是否开始进入可执行窗口”。',
  },
  {
    id: 'sth-sopr',
    name: 'STH-SOPR',
    icon: AlertTriangle,
    target: '3日均值 < p27（深度 < p13.5）',
    description: '衡量短期持有者是否在亏损兑现，阈值使用滚动分位数并以 3 日均值降噪。',
    rationale: '它与 STH-MVRV 组成复合触发信号，V6 触发层取两者分数最大值，避免短期噪声重复抬分。',
  },
];

const confirmationIndicators: IndicatorItem[] = [
  {
    id: 'lth-mvrv',
    name: 'LTH-MVRV',
    icon: ShieldCheck,
    target: '< 1（深度 < 0.90）',
    description: '衡量长期持有者未实现盈亏，用来确认长期结构是否也在向底部靠拢。',
    rationale: '它比短期指标更慢，但对大周期抄底更重要。',
  },
  {
    id: 'lth-sopr',
    name: 'LTH-SOPR',
    icon: ShieldCheck,
    target: '3日均值 < p20（深度 < p10）',
    description: '衡量长期持有者已实现盈亏，使用滚动 p20/p10 与 3 日均值降低误触发。',
    rationale: '它与 LTH-MVRV 互补，用来确认长期持有者也进入较深的亏损兑现状态。',
  },
];

const auxiliaryIndicators: IndicatorItem[] = [
  {
    id: 'reserve-risk',
    name: 'Reserve Risk (Observation)',
    icon: Info,
    target: '< p20（深度 < p10）',
    description: '继续保留原始数值和诊断信息，用于观察长期持有者风险回报区间，但不再占据 Core-8 主评分位。',
    rationale: '这样可以避免主源时滞直接影响 V6 总分，同时保留旧版本对照和回滚能力。',
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
          Core-8 V6 指标说明
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <IndicatorGrid title="估值层" items={valuationIndicators} />
        <IndicatorGrid title="触发层" items={triggerIndicators} />
        <IndicatorGrid title="确认层" items={confirmationIndicators} />
        <IndicatorGrid title="辅助与观测" items={auxiliaryIndicators} />

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-300" />
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">V6 评分框架</h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                V6 将 8 个核心指标拆为“估值层 + 触发层（复合）+ 确认层（双指标）”。
                估值层包含 Price/200W-MA、Price/Realized、MVRV Z-Score/NUPL 融合槽位、Puell，满分 8；
                触发层取 STH-MVRV 与 STH-SOPR 的最大值，满分 2；
                确认层 LTH-MVRV + LTH-SOPR 双指标独立计分，满分 4；
                总分上限仍为 14。同时保留 3 日确认和旧版兼容字段，便于归档、对照与回滚。
              </p>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
