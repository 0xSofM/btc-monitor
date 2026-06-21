import type { LatestData } from '@/types';

export type DataSource = 'api' | 'static' | 'history';
export type HistoryMode = 'none' | 'light' | 'full';
export type IndicatorDateKey =
  | 'priceMa200w'
  | 'mvrvZscore'
  | 'nupl'
  | 'lthMvrv'
  | 'lthSopr'
  | 'sthSopr'
  | 'sthMvrv'
  | 'puell';
export type AppTab = 'dashboard' | 'history' | 'guide';

export function sourceLabel(source: DataSource): string {
  if (source === 'api') return '实时数据';
  if (source === 'history') return '历史数据';
  return '本地数据';
}

export function formatSnapshotTimestamp(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const iso = new Date(timestamp).toISOString();
  return `${iso.slice(0, 16).replace('T', ' ')} UTC`;
}

export function buildDataTimestampLabel(data: LatestData, source: DataSource): string {
  const snapshotTimestamp = formatSnapshotTimestamp(data.lastUpdated);
  return `${snapshotTimestamp ?? data.date} (${sourceLabel(source)})`;
}

export function resolveScoreThresholds(maxScore: number) {
  const safeMax = Math.max(1, maxScore);
  return {
    focus: Math.max(1, Math.ceil((safeMax * 4) / 12)),
    accumulate: Math.max(1, Math.ceil((safeMax * 7) / 12)),
    extreme: Math.max(1, Math.ceil((safeMax * 10) / 12)),
  };
}

export function scoreBandLabel(score: number, maxScore: number): string {
  const thresholds = resolveScoreThresholds(maxScore);
  if (score >= thresholds.extreme) return '极端底部';
  if (score >= thresholds.accumulate) return '信号增强';
  if (score >= thresholds.focus) return '重点观察';
  return '观察';
}

export function formatSignalBand(code: string | undefined, score: number, maxScore: number): string {
  if (!code) {
    return scoreBandLabel(score, maxScore);
  }

  const normalized = code.trim().toLowerCase();
  if (normalized === 'watch') return '观察';
  if (normalized === 'focus') return '重点观察';
  if (normalized === 'accumulate') return '信号增强';
  if (normalized === 'extreme_bottom') return '极端底部';
  return scoreBandLabel(score, maxScore);
}

export function formatFallbackModeLabel(fallbackMode: string | undefined): string | null {
  if (!fallbackMode) {
    return null;
  }

  if (fallbackMode === 'mvrv_zscore_inactive') {
    return 'MVRV Z-Score 暂不计分';
  }

  if (fallbackMode === 'valuation_metrics_inactive' || fallbackMode === 'valuation_blend_inactive') {
    return 'MVRV Z / NUPL 暂不计分';
  }

  return '指标正常计分';
}

export function toDisplayScore(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function normalizeCoreFallbackMode(value: string | undefined): string | undefined {
  return value === 'valuation_blend_inactive' ? 'valuation_metrics_inactive' : value;
}

export function resolveCore8Display(latest: LatestData | null) {
  if (!latest) {
    return null;
  }

  const scorePriceMa200w = toDisplayScore(latest.scorePriceMa200w);
  const scoreMvrvZscore = toDisplayScore(latest.scoreMvrvZscoreCore);
  const scoreNupl = toDisplayScore(latest.scoreNuplCore);
  const scorePuell = toDisplayScore(latest.scorePuell);
  const scoreSthMvrv = toDisplayScore(latest.scoreSthMvrv);
  const scoreSthSopr = toDisplayScore(latest.scoreSthSopr);
  const scoreLthMvrv = toDisplayScore(latest.scoreLthMvrv);
  const scoreLthSopr = toDisplayScore(latest.scoreLthSopr);
  const canonicalSignals = latest.canonical?.signals;

  const signals = {
    priceMa200w: canonicalSignals?.priceMa200w ?? latest.signalsV6?.priceMa200w ?? latest.signals.priceMa200w ?? scorePriceMa200w > 0,
    mvrvZscore: canonicalSignals?.mvrvZscore ?? latest.signalsV6?.mvrvZscore ?? latest.signalMvrvZscoreCore ?? scoreMvrvZscore > 0,
    nupl: canonicalSignals?.nupl ?? latest.signalsV6?.nupl ?? latest.signalNuplCore ?? latest.signalNupl ?? scoreNupl > 0,
    puell: canonicalSignals?.puell ?? latest.signalsV6?.puell ?? latest.signalsV4?.puell ?? latest.signals.puell ?? scorePuell > 0,
    sthMvrv: canonicalSignals?.sthMvrv ?? latest.signalsV6?.sthMvrv ?? latest.signalsV4?.sthMvrv ?? latest.signals.sthMvrv ?? scoreSthMvrv > 0,
    sthSopr: canonicalSignals?.sthSoprTrigger
      ?? latest.signalsV6?.sthSoprTrigger
      ?? latest.signalsV4?.sthSoprTrigger
      ?? latest.signals.sthSopr
      ?? scoreSthSopr > 0,
    lthMvrv: canonicalSignals?.lthMvrv ?? latest.signalsV6?.lthMvrv ?? latest.signalsV4?.lthMvrv ?? scoreLthMvrv > 0,
    lthSopr: canonicalSignals?.lthSopr ?? latest.signalsV6?.lthSopr ?? latest.signalsV4?.lthSopr ?? scoreLthSopr > 0,
  };

  const valuationScore = latest.canonical?.score?.valuation ?? (scorePriceMa200w + scoreMvrvZscore + scoreNupl + scorePuell);
  const triggerScore = latest.canonical?.score?.trigger ?? Math.max(scoreSthMvrv, scoreSthSopr);
  const confirmationScore = latest.canonical?.score?.confirmation ?? (scoreLthMvrv + scoreLthSopr);
  const totalScore = latest.canonical?.score?.total ?? (valuationScore + triggerScore + confirmationScore);
  const signalCount = Object.values(signals).filter(Boolean).length;
  const fallbackMode = normalizeCoreFallbackMode(latest.canonical?.fallbackMode ?? latest.fallbackModeV6);

  return {
    signals,
    signalCount: latest.canonical?.signalCount ?? signalCount,
    valuationScore,
    maxValuationScore: 8,
    triggerScore,
    maxTriggerScore: 2,
    confirmationScore,
    maxConfirmationScore: 4,
    totalScore,
    maxTotalScore: latest.canonical?.score?.maxTotal ?? 14,
    fallbackMode,
  };
}
