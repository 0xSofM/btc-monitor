import { Building2 } from 'lucide-react';

export function StrategyMnavExplanation() {
  return (
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
  );
}
