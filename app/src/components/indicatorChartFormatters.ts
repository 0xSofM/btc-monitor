import type { TooltipEntry } from './indicatorChartUtils';

export function formatDate(value: string | number | null | undefined): string {
  if (!value) {
    return '';
  }

  const dateText = typeof value === 'number'
    ? new Date(value).toISOString().slice(0, 10)
    : value;
  const parts = dateText.split('-');
  if (parts.length === 3) {
    return `${parts[0].slice(2)}/${parts[1]}/${parts[2]}`;
  }

  return dateText;
}

export function parseDateMs(value: string): number {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDateFromMs(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }

  return formatDate(new Date(value).toISOString().slice(0, 10));
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  if (Math.abs(value) >= 10) {
    return value.toFixed(2);
  }

  if (Math.abs(value) >= 1) {
    return value.toFixed(3);
  }

  return value.toFixed(4);
}

export function formatPriceAxis(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }

  return `$${value.toFixed(0)}`;
}

export function formatPriceTooltip(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatTooltipValue(entry: TooltipEntry): string {
  if (typeof entry.value !== 'number') {
    return '-';
  }

  if (entry.name === 'BTC Price' || entry.name === '200W-MA') {
    return formatPriceTooltip(entry.value);
  }

  return formatNumber(entry.value);
}
