export function formatUsdM(value: number | undefined): string {
  if (value === undefined) return '-';
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value.toFixed(0)}M`;
}

export function formatNumber(value: number | undefined, digits = 2): string {
  return value === undefined ? '-' : value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function formatTimestamp(value: string | undefined): string {
  if (!value) return '-';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return `${new Date(timestamp).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function getMnavBandLabel(band: string | undefined): string {
  if (band === 'discount') return '折价';
  if (band === 'low_premium') return '低溢价';
  if (band === 'normal_premium') return '常规溢价';
  if (band === 'elevated_premium') return '较高溢价';
  if (band === 'overheated') return '高溢价';
  return '未知';
}

export function getMnavBandClass(band: string | undefined): string {
  if (band === 'discount') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300';
  if (band === 'low_premium') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  if (band === 'normal_premium') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300';
  if (band === 'elevated_premium') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300';
  if (band === 'overheated') return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300';
  return '';
}
