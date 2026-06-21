import type { MarketAssessment } from '@/components/MarketAssessmentCard';
import { resolveScoreThresholds } from './appDisplay';

export function buildMarketAssessment(
  effectiveScore: number,
  effectiveMaxScore: number,
  hasLayeredScore: boolean,
): MarketAssessment {
  const scoreThresholds = resolveScoreThresholds(effectiveMaxScore);

  if (effectiveScore >= scoreThresholds.extreme) {
    return {
      boxClass: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/50',
      iconClass: 'text-green-600 dark:text-green-300',
      titleClass: 'text-green-800 dark:text-green-200',
      textClass: 'text-green-700 dark:text-green-300',
      title: '极端底部区',
      description: hasLayeredScore
        ? `当前总分 ${effectiveScore}/${effectiveMaxScore}，估值、触发、确认三层指标形成较强一致性。`
        : `当前评分 ${effectiveScore}/${effectiveMaxScore}，多个底部识别指标处于深度区域。`,
    };
  }

  if (effectiveScore >= scoreThresholds.accumulate) {
    return {
      boxClass: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50',
      iconClass: 'text-emerald-600 dark:text-emerald-300',
      titleClass: 'text-emerald-800 dark:text-emerald-200',
      textClass: 'text-emerald-700 dark:text-emerald-300',
      title: '信号增强区',
      description: hasLayeredScore
        ? `当前总分 ${effectiveScore}/${effectiveMaxScore}，至少两层指标显示底部识别信号增强。`
        : `当前评分 ${effectiveScore}/${effectiveMaxScore}，底部识别信号较强。`,
    };
  }

  if (effectiveScore >= scoreThresholds.focus) {
    return {
      boxClass: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50',
      iconClass: 'text-amber-600 dark:text-amber-300',
      titleClass: 'text-amber-800 dark:text-amber-200',
      textClass: 'text-amber-700 dark:text-amber-300',
      title: '重点观察区',
      description: hasLayeredScore
        ? `当前总分 ${effectiveScore}/${effectiveMaxScore}，部分指标进入底部识别区间，确认信号仍需观察。`
        : `当前评分 ${effectiveScore}/${effectiveMaxScore}，部分底部识别信号已出现。`,
    };
  }

  return {
    boxClass: 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60',
    iconClass: 'text-slate-600 dark:text-slate-300',
    titleClass: 'text-slate-800 dark:text-slate-200',
    textClass: 'text-slate-700 dark:text-slate-300',
    title: '观察区',
    description: hasLayeredScore
      ? `当前总分 ${effectiveScore}/${effectiveMaxScore}，底部识别信号尚未形成一致性。`
      : `当前评分 ${effectiveScore}/${effectiveMaxScore}，暂未出现明确的大周期底部信号。`,
  };
}
