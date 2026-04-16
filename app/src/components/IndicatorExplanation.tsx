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
    id: 'reserve-risk',
    name: 'Reserve Risk',
    icon: TrendingDown,
    target: '< p20（深度 < p10）',
    description: '衡量长期持有者信念与价格风险的相对关系。',
    rationale: '历史低分位的储备风险通常对应长期配置窗口。',
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
];

const confirmationIndicators: IndicatorItem[] = [
  {
    id: 'lth-mvrv',
    name: 'LTH-MVRV',
    icon: ShieldCheck,
    target: '< 1（深度 < 0.90）',
    description: '衡量长期持有者账面盈亏，用来确认长期结构是否也在向底部靠拢。',
    rationale: '它比短期指标更慢，但对大周期抄底更重要。',
  },
];

const auxiliaryIndicators: IndicatorItem[] = [
  {
    id: 'sth-sopr',
    name: 'STH-SOPR (Auxiliary)',
    icon: AlertTriangle,
    target: '< p27（深度 < p13.5）',
    description: '保留为辅助确认项，用于验证短期持有者是否持续在亏损兑现。',
    rationale: 'V4 中不再单独占据 Core-6 计分位，而是提升触发信号的置信度。',
  },
  {
    id: 'mvrv-zscore',
    name: 'MVRV Z-Score (Fallback)',
    icon: Info,
    target: '< 0（深度 < -0.5）',
    description: '当 Reserve Risk 数据过旧时，作为软回退参考项，仅提供有限分值。',
    rationale: '这样可以减少与 Price / Realized、LTH-MVRV 的重复计票。',
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
          Core-6 V4 指标说明
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <IndicatorGrid title="估值层" items={valuationIndicators} />
        <IndicatorGrid title="触发层" items={triggerIndicators} />
        <IndicatorGrid title="确认层" items={confirmationIndicators} />
        <IndicatorGrid title="辅助与回退" items={auxiliaryIndicators} />

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-300" />
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">V4 评分框架</h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                V4 不再把 6 个指标平铺加总，而是拆成“估值层 + 触发层 + 确认层”。
                Reserve Risk 在主数据陈旧时只允许 MVRV Z-Score 软回退，避免与 LTH-MVRV 重复计票。
                同时保留 3 日确认、全指标 freshness 评分和旧版 V2 字段，便于归档、对照与回滚。
              </p>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
