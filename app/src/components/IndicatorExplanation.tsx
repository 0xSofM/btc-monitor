import { AlertTriangle, BookOpen, Info, TrendingDown } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function IndicatorExplanation() {
  const indicators = [
    {
      id: 'price-ma200w',
      name: 'BTC 价格 / 200 周均线',
      icon: <TrendingDown className="h-5 w-5" />,
      description:
        '这个指标衡量当前 BTC 价格相对 200 周均线的位置。历史上，价格跌到 200 周均线附近或下方，通常对应熊市后期和长期低估区。',
      target: '< 1',
      rationale:
        '当价格低于 200 周均线时，市场情绪通常偏悲观，但长期风险收益比往往更有吸引力，适合分批布局。',
      historicalExamples: [
        { date: '2015 年 1 月', price: '$175', context: '2014-2015 熊市底部区域' },
        { date: '2018 年 12 月', price: '$3,200', context: '2018 熊市底部区域' },
        { date: '2022 年 6-11 月', price: '$16,000-$20,000', context: '2022 熊市底部区域' },
      ],
    },
    {
      id: 'mvrv-z',
      name: 'MVRV Z-Score',
      icon: <TrendingDown className="h-5 w-5" />,
      description:
        'MVRV Z-Score 用于评估市场价值相对链上“实现价值”的偏离程度。它能帮助识别市场是否处于过热或低估状态。',
      target: '< 0',
      rationale:
        '当 MVRV Z-Score 低于 0，说明市场整体估值处于历史偏低区间，往往出现在周期底部附近。',
      historicalExamples: [
        { date: '2011 年 10 月', price: '$3-$5', context: '早期周期底部' },
        { date: '2015 年 1 月', price: '$175', context: '熊市低估区' },
        { date: '2018 年 12 月', price: '$3,200', context: '熊市低估区' },
        { date: '2022 年 11 月', price: '$16,000-$20,000', context: '周期低估区' },
      ],
    },
    {
      id: 'lth-mvrv',
      name: 'LTH-MVRV',
      icon: <TrendingDown className="h-5 w-5" />,
      description:
        'LTH-MVRV 反映长期持有者（通常持币超过 155 天）是否处于盈利状态，是观察长期资金压力的重要指标。',
      target: '< 1',
      rationale:
        '当 LTH-MVRV 小于 1，意味着长期持有者整体接近或进入浮亏，往往对应市场极度谨慎阶段。',
      historicalExamples: [
        { date: '2015 年 1 月', price: '$175', context: '长期持有者普遍承压' },
        { date: '2018 年 12 月', price: '$3,200', context: '长期持有者成本线被击穿' },
        { date: '2020 年 3 月', price: '$5,000', context: '极端黑天鹅冲击' },
        { date: '2022 年 11 月', price: '$16,000-$20,000', context: '长期持有者再度承压' },
      ],
    },
    {
      id: 'puell',
      name: 'Puell Multiple',
      icon: <AlertTriangle className="h-5 w-5" />,
      description:
        'Puell Multiple 用来衡量矿工收入相对历史均值的高低，能反映矿工侧抛压和行业压力。',
      target: '< 0.5',
      rationale:
        '当指标低于 0.5，通常说明矿工收入显著低于常态，市场处于压力后期，可能接近价值区。',
      historicalExamples: [
        { date: '2015 年 1 月', price: '$175', context: '矿工收入困难期' },
        { date: '2018 年 12 月', price: '$3,200', context: '矿工关机潮阶段' },
        { date: '2020 年 3 月', price: '$5,000', context: '市场快速去杠杆' },
        { date: '2022 年 11 月', price: '$16,000-$20,000', context: '矿工压力加剧' },
      ],
    },
    {
      id: 'nupl',
      name: 'NUPL',
      icon: <TrendingDown className="h-5 w-5" />,
      description:
        'NUPL（净未实现盈亏）表示全网投资者当前账面盈亏状态，能直观反映市场情绪和风险偏好。',
      target: '< 0',
      rationale:
        '当 NUPL 低于 0，说明全网整体进入未实现亏损区间，往往是恐慌极值阶段，历史上较少持续太久。',
      historicalExamples: [
        { date: '2011 年 9-10 月', price: '$3-$5', context: '首次深度回撤' },
        { date: '2015 年 1 月', price: '$175', context: '深度亏损阶段' },
        { date: '2018 年 11-12 月', price: '$3,200-$4,000', context: '全面亏损区' },
        { date: '2022 年 6-11 月', price: '$16,000-$20,000', context: '持续亏损区' },
      ],
    },
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          指标说明
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {indicators.map((indicator) => (
            <Card key={indicator.id}>
              <CardHeader>
                <div className="flex items-center gap-3 text-left">
                  <div className="rounded-full bg-muted p-2">
                    {indicator.icon}
                  </div>
                  <div>
                    <p className="font-medium">{indicator.name}</p>
                    <p className="text-sm text-muted-foreground">
                      目标区间：{indicator.target}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-1 font-medium">指标介绍</h4>
                    <p className="text-sm text-muted-foreground">{indicator.description}</p>
                  </div>

                  <div>
                    <h4 className="mb-1 font-medium">买入逻辑</h4>
                    <p className="text-sm text-muted-foreground">{indicator.rationale}</p>
                  </div>

                  <div>
                    <h4 className="mb-2 font-medium">历史案例</h4>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {indicator.historicalExamples.map((example, idx) => (
                        <div key={idx} className="rounded-lg bg-muted p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{example.date}</span>
                            <span className="text-green-600">{example.price}</span>
                          </div>
                          <p className="mt-1 text-muted-foreground">{example.context}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h4 className="mb-1 font-medium text-blue-800 dark:text-blue-200">
                组合使用说明
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                这 5 个指标分别覆盖价格趋势、估值偏离、长期持有者状态、矿工压力和全网盈亏。
                单一指标可能有噪音，多指标共振时信号通常更可靠。历史上，4-5 个指标同向触发的阶段，多出现在周期底部附近。
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
