import type { DataSource } from '@/appDisplay';
import { resolveScoreThresholds } from '@/appDisplay';

export type SignalStatus = {
  label: string;
  toneClass: string;
  iconToneClass: string;
};

export type BadgeDisplay = {
  label: string;
  className: string;
};

export function getSignalStatus(
  score: number,
  signalCount: number,
  maxScore: number,
): SignalStatus {
  const thresholds = resolveScoreThresholds(maxScore);

  if (score >= thresholds.extreme) {
    return {
      label: '极端底部',
      toneClass: 'text-green-700 dark:text-green-300',
      iconToneClass: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    };
  }

  if (score >= thresholds.accumulate) {
    return {
      label: '信号增强',
      toneClass: 'text-emerald-700 dark:text-emerald-300',
      iconToneClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    };
  }

  if (score >= thresholds.focus) {
    return {
      label: '重点观察',
      toneClass: 'text-amber-700 dark:text-amber-300',
      iconToneClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    };
  }

  if (signalCount > 0) {
    return {
      label: '早期观察',
      toneClass: 'text-blue-700 dark:text-blue-300',
      iconToneClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    };
  }

  return {
    label: '观察',
    toneClass: 'text-slate-700 dark:text-slate-300',
    iconToneClass: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  };
}

export function getSourceBadge(source: DataSource): BadgeDisplay {
  if (source === 'api') {
    return {
      label: '实时数据',
      className: 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300',
    };
  }

  if (source === 'history') {
    return {
      label: '历史数据',
      className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
    };
  }

  return {
    label: '本地数据',
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
  };
}

export function getFreshnessBadge(hours: number): BadgeDisplay {
  if (hours <= 24) {
    return {
      label: `${hours.toFixed(1)}小时 新鲜`,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    };
  }

  if (hours <= 72) {
    return {
      label: `${hours.toFixed(1)}小时 滞后`,
      className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
    };
  }

  return {
    label: `${hours.toFixed(1)}小时 陈旧`,
    className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
  };
}

export function formatPrice(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatFallbackLabel(fallbackMode: string | undefined): string | null {
  if (fallbackMode === 'valuation_metrics_inactive' || fallbackMode === 'valuation_blend_inactive') {
    return 'MVRV Z / NUPL 当前未参与评分';
  }

  if (fallbackMode === 'mvrv_zscore_inactive') {
    return 'MVRV Z-Score 当前未参与评分';
  }

  return null;
}

export function toPercent(value: number | undefined): number | null {
  return value === undefined ? null : Math.round(value * 100);
}
