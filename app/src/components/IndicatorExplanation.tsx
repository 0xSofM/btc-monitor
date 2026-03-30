import { AlertTriangle, BookOpen, Info, TrendingDown } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const indicators = [
  {
    id: 'price-ma200w',
    name: '价格 / 200周均线',
    icon: TrendingDown,
    target: '< 1（深度 < 0.85）',
    description: '衡量现价相对 200 周均线的位置，是大周期趋势锚点之一。',
    rationale: '价格跌破 200 周均线通常发生在恐慌阶段，长期风险回报比更优。',
  },
  {
    id: 'price-realized',
    name: '价格 / 实现价格',
    icon: TrendingDown,
    target: '< 1（深度 < 0.90）',
    description: '比较现价与链上实现价格，反映市场是否跌破全网平均成本。',
    rationale: '价格低于实现价格常对应低估区，是大周期底部的重要确认项。',
  },
  {
    id: 'reserve-risk',
    name: '储备风险（Reserve Risk）',
    icon: TrendingDown,
    target: '< p20（深度 < p10）',
    description: '衡量长期持有者信念与价格风险的相对关系。',
    rationale: '历史低分位的储备风险通常对应长期配置窗口。',
  },
  {
    id: 'sth-sopr',
    name: '短期SOPR（STH-SOPR）',
    icon: AlertTriangle,
    target: '< 1（深度 < 0.97）',
    description: '反映短期持有者是否在亏损兑现。',
    rationale: 'SOPR 低于 1 常见于阶段性出清，接近局部底部区域。',
  },
  {
    id: 'sth-mvrv',
    name: '短期MVRV（STH-MVRV）',
    icon: AlertTriangle,
    target: '< 1（深度 < 0.85）',
    description: '衡量短期持有者未实现盈亏压力。',
    rationale: 'STH-MVRV 低位通常意味着短期筹码出清接近尾声。',
  },
  {
    id: 'puell',
    name: 'Puell倍数（Puell Multiple）',
    icon: TrendingDown,
    target: '< 0.6（深度 < 0.5）',
    description: '比较矿工收入与历史常态水平，评估供给侧压力。',
    rationale: 'Puell 处于低位常见于矿工压力释放后的后半阶段。',
  },
];

export function IndicatorExplanation() {
  return (
    <Card className="surface-card mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5" />
          Core-6 指标说明
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {indicators.map((indicator) => {
            const Icon = indicator.icon;
            return (
              <article key={indicator.id} className="rounded-xl border bg-background/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full border bg-muted/50 p-2">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <h3 className="font-semibold leading-tight">{indicator.name}</h3>
                      <p className="text-xs text-muted-foreground">目标区间：{indicator.target}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{indicator.description}</p>
                    <p className="text-sm">{indicator.rationale}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-300" />
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">V2 评分框架</h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                Core-6 每个指标按 0/1/2 分计分，总分 12 分。评分分区为：
                0-3 观察区，4-6 关注区，7-9 分批配置区，10-12 极端底部区。
                同时加入 3 日确认机制，以降低单日噪声影响。
              </p>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
