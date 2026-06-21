import type { IndicatorData } from '@/types';

import { CORE_HISTORY_FIELDS } from './schema';
import { buildStoredEnvelope } from './storageEnvelope';

const MAX_PERSISTED_HISTORY_ROWS = 900;

export function buildHistoryPayloads(history: IndicatorData[]): string[] {
  return buildHistoryRowLimits(history.length).map((limit) => {
    const rows = history.slice(-limit).map(compactHistoryRow);

    return JSON.stringify(buildStoredEnvelope(rows, {
      storedRows: rows.length,
      truncated: rows.length < history.length,
    }));
  });
}

function compactHistoryRow(row: IndicatorData): IndicatorData {
  const compact: IndicatorData = { d: row.d };
  const compactRecord = compact as unknown as Record<string, unknown>;

  for (const field of CORE_HISTORY_FIELDS) {
    const value = row[field];
    if (value !== undefined && value !== null) {
      compactRecord[field] = value;
    }
  }

  return compact;
}

function buildHistoryRowLimits(totalRows: number): number[] {
  if (totalRows <= 0) {
    return [];
  }

  // Keep local history as a recent fallback; full history remains in memory after loading.
  const targetRows = Math.min(totalRows, MAX_PERSISTED_HISTORY_ROWS);
  const limits = new Set<number>([targetRows]);
  let current = targetRows;

  while (current > 365) {
    current = Math.floor(current / 2);
    if (current > 365) {
      limits.add(current);
    }
  }

  [365, 180, 90, 30].forEach((limit) => {
    limits.add(Math.min(totalRows, limit));
  });

  return Array.from(limits)
    .filter((limit) => limit > 0)
    .sort((left, right) => right - left);
}
