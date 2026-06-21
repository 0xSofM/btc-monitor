import { AlertTriangle, CheckCircle2, DollarSign, TrendingUp } from 'lucide-react';

type SignalStatusDisplay = {
  label: string;
  toneClass: string;
  iconToneClass: string;
};

type SignalOverviewSummaryCardsProps = {
  btcPriceLabel: string;
  signalCount: number;
  totalIndicators: number;
  hasLayeredScore: boolean;
  signalScoreV2: number;
  maxSignalScoreV2: number;
  effectiveScore: number;
  effectiveMaxScore: number;
  accumulateThreshold: number;
  status: SignalStatusDisplay;
  isConfirmed: boolean;
};

export function SignalOverviewSummaryCards({
  btcPriceLabel,
  signalCount,
  totalIndicators,
  hasLayeredScore,
  signalScoreV2,
  maxSignalScoreV2,
  effectiveScore,
  effectiveMaxScore,
  accumulateThreshold,
  status,
  isConfirmed,
}: SignalOverviewSummaryCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <article className="rounded-xl border bg-background/70 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          BTC 价格
        </div>
        <p className="text-2xl font-bold">{btcPriceLabel}</p>
      </article>

      <article className="rounded-xl border bg-background/70 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          触发数量
        </div>
        <p className="text-2xl font-bold">
          {signalCount}
          <span className="ml-1 text-sm font-normal text-muted-foreground">/ {totalIndicators}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasLayeredScore ? `总分：${effectiveScore}/${effectiveMaxScore}` : `加权评分：${signalScoreV2}/${maxSignalScoreV2}`}
        </p>
      </article>

      <article className="rounded-xl border bg-background/70 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span className={`rounded-full p-1 ${status.iconToneClass}`}>
            {effectiveScore >= accumulateThreshold ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </span>
          信号状态
        </div>
        <p className={`text-2xl font-bold ${status.toneClass}`}>{status.label}</p>
        <p className={`mt-1 text-xs ${isConfirmed ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`}>
          {isConfirmed ? '已满足 3 日确认' : '尚未满足 3 日确认'}
        </p>
      </article>
    </section>
  );
}
