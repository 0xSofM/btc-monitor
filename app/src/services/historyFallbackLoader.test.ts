import type { IndicatorData } from '@/types';
import { describe, expect, it, vi } from 'vitest';

import {
  hasCore8Coverage,
  loadLocalHistoryFallback,
} from './historyFallbackLoader';

const core8Row = {
  d: '2026-04-16',
  priceMa200wRatio: 1.2,
  mvrvZscore: 0.1,
  nupl: 0.18,
  lthMvrv: 1.1,
  lthSopr: 0.98,
  sthSopr: 1.01,
  sthMvrv: 1.05,
  puellMultiple: 0.72,
} satisfies IndicatorData;

describe('history fallback loader', () => {
  it('detects recent Core 8 history coverage', () => {
    expect(hasCore8Coverage([core8Row])).toBe(true);
    expect(hasCore8Coverage([{ ...core8Row, puellMultiple: undefined }])).toBe(false);
    expect(hasCore8Coverage([])).toBe(false);
  });

  it('loads covered local history as a light fallback', () => {
    const mergedHistory = [{ ...core8Row, d: '2026-04-17' }];
    const readLocalHistory = vi.fn(() => [core8Row]);
    const mergeLatestIntoRows = vi.fn(() => mergedHistory);
    const rememberHistory = vi.fn((history: IndicatorData[]) => history);

    const fallback = loadLocalHistoryFallback({
      readLocalHistory,
      mergeLatestIntoRows,
      rememberHistory,
    });

    expect(fallback).toBe(mergedHistory);
    expect(mergeLatestIntoRows).toHaveBeenCalledWith([core8Row]);
    expect(rememberHistory).toHaveBeenCalledWith(mergedHistory, 'light');
  });

  it('rejects local history without Core 8 coverage', () => {
    const readLocalHistory = vi.fn(() => [{ d: '2026-04-16', btcPrice: 84000 }]);
    const mergeLatestIntoRows = vi.fn((rows: IndicatorData[]) => rows);
    const rememberHistory = vi.fn((history: IndicatorData[]) => history);

    const fallback = loadLocalHistoryFallback({
      readLocalHistory,
      mergeLatestIntoRows,
      rememberHistory,
    });

    expect(fallback).toEqual([]);
    expect(mergeLatestIntoRows).not.toHaveBeenCalled();
    expect(rememberHistory).not.toHaveBeenCalled();
  });
});
