import { AlertTriangle, BookOpen, Info, TrendingDown } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const indicators = [
  {
    id: 'price-ma200w',
    name: 'Price / 200W MA',
    icon: TrendingDown,
    target: '< 1 (deep < 0.85)',
    description: 'Compares spot price against the long-cycle 200-week moving average.',
    rationale: 'Price below the 200W MA usually appears in broad panic phases and improves long-horizon risk/reward.',
  },
  {
    id: 'price-realized',
    name: 'Price / Realized Price',
    icon: TrendingDown,
    target: '< 1 (deep < 0.90)',
    description: 'Measures whether market price trades below the chain-wide average cost basis.',
    rationale: 'Trading below realized price often marks undervaluation zones within cycle bottoms.',
  },
  {
    id: 'reserve-risk',
    name: 'Reserve Risk',
    icon: TrendingDown,
    target: '< p20 (deep < p10)',
    description: 'Tracks long-term holder conviction relative to market price risk.',
    rationale: 'Historically low reserve risk commonly aligns with attractive long-term accumulation windows.',
  },
  {
    id: 'sth-sopr',
    name: 'STH-SOPR',
    icon: AlertTriangle,
    target: '< 1 (deep < 0.97)',
    description: 'Captures whether short-term holders are realizing losses.',
    rationale: 'SOPR below 1 often indicates capitulation and supply transfer near local bottoming zones.',
  },
  {
    id: 'sth-mvrv',
    name: 'STH-MVRV',
    icon: AlertTriangle,
    target: '< 1 (deep < 0.85)',
    description: 'Shows unrealized PnL stress among short-term holders.',
    rationale: 'Low STH-MVRV values often coincide with exhausted short-term positioning.',
  },
  {
    id: 'puell',
    name: 'Puell Multiple',
    icon: TrendingDown,
    target: '< 0.6 (deep < 0.5)',
    description: 'Compares miner revenue to historical norms to gauge supply-side pressure.',
    rationale: 'Very low Puell levels often appear after miner stress has largely reset.',
  },
];

export function IndicatorExplanation() {
  return (
    <Card className="surface-card mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5" />
          Core-6 Indicator Guide
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
                      <p className="text-xs text-muted-foreground">Target zone: {indicator.target}</p>
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
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">V2 scoring framework</h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                Each Core-6 indicator contributes 0/1/2 points, for a maximum score of 12. Score bands are:
                0-3 Watch, 4-6 Focus, 7-9 Accumulation, 10-12 Extreme Bottom. A 3-day confirmation layer is applied
                to reduce one-day noise.
              </p>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
