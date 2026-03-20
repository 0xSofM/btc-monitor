import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, BookOpen, TrendingDown, AlertTriangle } from 'lucide-react';

export function IndicatorExplanation() {
  const indicators = [
    {
      id: 'price-ma200w',
      name: 'BTC Price / 200-Week MA',
      icon: <TrendingDown className="w-5 h-5" />,
      description: '比特币价格与200周移动平均线的比值。200周MA是比特币的长期趋势线，历史上价格在该线下方时往往是长期买入机会。',
      target: '< 1',
      rationale: '当价格低于200周MA时，说明BTC处于长期趋势下方，市场处于恐惧状态，是价值投资者的理想买入时机。',
      historicalExamples: [
        { date: '2015年1月', price: '$175', context: '2014-2015熊市底部' },
        { date: '2018年12月', price: '$3,200', context: '2018熊市底部' },
        { date: '2022年6-11月', price: '$16,000-$20,000', context: '2022熊市底部' }
      ]
    },
    {
      id: 'mvrv-z',
      name: 'MVRV Z-Score',
      icon: <TrendingDown className="w-5 h-5" />,
      description: 'MVRV Z-Score是市值与实现市值的比值，经过标准化处理（减去历史均值除以标准差）。它衡量市场价值与"真实价值"的偏离程度。',
      target: '< 0',
      rationale: 'Z-Score小于0表示市场价值低于历史平均水平，意味着整体市场处于亏损状态，通常是周期底部的信号。',
      historicalExamples: [
        { date: '2011年10月', price: '$3', context: '首次大熊市底部' },
        { date: '2015年1月', price: '$175', context: '2014-2015熊市底部' },
        { date: '2018年12月', price: '$3,200', context: '2018熊市底部' },
        { date: '2022年6-11月', price: '$16,000-$20,000', context: '2022熊市底部' }
      ]
    },
    {
      id: 'lth-mvrv',
      name: 'LTH-MVRV',
      icon: <TrendingDown className="w-5 h-5" />,
      description: '长期持有者MVRV（Long-Term Holder MVRV），计算持有超过155天的地址的平均成本与当前价格的比值。',
      target: '< 1',
      rationale: '长期持有者是市场中最坚定的投资者。当他们也开始亏损时（LTH-MVRV < 1），说明市场已经极度恐慌，是难得买入机会。',
      historicalExamples: [
        { date: '2015年1月', price: '$175', context: '长期持有者也开始抛售' },
        { date: '2018年12月', price: '$3,200', context: '长期持有者成本线被击穿' },
        { date: '2020年3月', price: '$5,000', context: '疫情黑天鹅事件' },
        { date: '2022年6-11月', price: '$16,000-$20,000', context: '长期持有者亏损' }
      ]
    },
    {
      id: 'puell',
      name: 'Puell Multiple',
      icon: <AlertTriangle className="w-5 h-5" />,
      description: 'Puell Multiple是比特币每日发行价值（美元计）与365天移动平均值的比值。它反映了矿工的收入状况。',
      target: '< 0.5',
      rationale: '当Puell Multiple低于0.5时，矿工收入远低于历史平均水平，意味着矿工面临巨大压力，往往是市场底部的信号。',
      historicalExamples: [
        { date: '2015年1月', price: '$175', context: '矿工收入极度困难' },
        { date: '2018年12月', price: '$3,200', context: '矿工关机潮' },
        { date: '2020年3月', price: '$5,000', context: '疫情崩盘' },
        { date: '2022年6-11月', price: '$16,000-$20,000', context: '矿工抛售压力' }
      ]
    },
    {
      id: 'nupl',
      name: 'NUPL',
      icon: <TrendingDown className="w-5 h-5" />,
      description: 'Net Unrealized Profit/Loss（净未实现利润/亏损），计算方式为 (市值 - 实现市值) / 市值。它反映了整个网络的盈利状态。',
      target: '< 0',
      rationale: 'NUPL小于0表示整个比特币网络处于净亏损状态，是市场极度恐惧的表现，历史上是绝佳的买入时机。',
      historicalExamples: [
        { date: '2011年9-10月', price: '$3-$5', context: '首次进入亏损状态' },
        { date: '2015年1月', price: '$175', context: '深度亏损区域' },
        { date: '2018年11-12月', price: '$3,200-$4,000', context: '全面亏损' },
        { date: '2022年6-11月', price: '$16,000-$20,000', context: '长期亏损状态' }
      ]
    }
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          指标说明
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {indicators.map((indicator) => (
            <Card key={indicator.id}>
              <CardHeader>
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-muted rounded-full">
                    {indicator.icon}
                  </div>
                  <div>
                    <p className="font-medium">{indicator.name}</p>
                    <p className="text-sm text-muted-foreground">
                      目标: {indicator.target}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-1">指标介绍</h4>
                    <p className="text-sm text-muted-foreground">
                      {indicator.description}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">买入逻辑</h4>
                    <p className="text-sm text-muted-foreground">
                      {indicator.rationale}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">历史案例</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {indicator.historicalExamples.map((example, idx) => (
                        <div 
                          key={idx} 
                          className="p-3 bg-muted rounded-lg text-sm"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{example.date}</span>
                            <span className="text-green-600">{example.price}</span>
                          </div>
                          <p className="text-muted-foreground mt-1">{example.context}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                组合使用说明
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                这5个指标从不同维度（价格趋势、市场情绪、持有者行为、矿工状况、网络盈亏）
                综合判断市场周期位置。当多个指标同时触发时，买入信号的可靠性更高。
                历史上，4-5个指标同时触发的时间点都是BTC的周期大底部。
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
