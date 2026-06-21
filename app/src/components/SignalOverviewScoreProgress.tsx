import { Progress } from '@/components/ui/progress';
import type { resolveScoreThresholds } from '@/appDisplay';

type SignalOverviewScoreProgressProps = {
  hasLayeredScore: boolean;
  scoreProgress: number;
  thresholds: ReturnType<typeof resolveScoreThresholds>;
  effectiveMaxScore: number;
};

export function SignalOverviewScoreProgress({
  hasLayeredScore,
  scoreProgress,
  thresholds,
  effectiveMaxScore,
}: SignalOverviewScoreProgressProps) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{hasLayeredScore ? '分层评分强度' : '加权评分强度'}</span>
        <span className="font-semibold">{scoreProgress.toFixed(0)}%</span>
      </div>
      <Progress value={scoreProgress} className="h-2.5" />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>0-{Math.max(0, thresholds.focus - 1)} 观察</span>
        <span>{thresholds.focus}-{Math.max(thresholds.focus, thresholds.accumulate - 1)} 关注</span>
        <span>{thresholds.accumulate}-{Math.max(thresholds.accumulate, thresholds.extreme - 1)} 增强</span>
        <span>{thresholds.extreme}-{effectiveMaxScore} 极端</span>
      </div>
    </section>
  );
}
