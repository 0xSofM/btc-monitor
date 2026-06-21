import type { IndicatorData, LatestData } from '@/types';

import { getLatestHistoryMetricFields } from './historyMetricMergeSelectors';
import { getLatestHistoryScoreFields } from './historyScoreMergeSelectors';
import { getLatestHistorySignalFields } from './historySignalMergeSelectors';

export function latestDataToHistoryRow(
  latest: LatestData,
  existingRow?: IndicatorData,
): IndicatorData {
  return {
    ...existingRow,
    d: latest.date,
    ...getLatestHistoryMetricFields(latest, existingRow),
    ...getLatestHistorySignalFields(latest, existingRow),
    ...getLatestHistoryScoreFields(latest, existingRow),
    staleIndicators: latest.staleIndicators ?? existingRow?.staleIndicators,
    coreIndicatorSet: latest.coreIndicatorSet ?? existingRow?.coreIndicatorSet,
    scoringModelVersion: latest.scoringModelVersion ?? existingRow?.scoringModelVersion,
    thresholds: latest.thresholds ?? existingRow?.thresholds,
    indicatorDates: latest.indicatorDates ?? existingRow?.indicatorDates,
    signalsV6: latest.signalsV6 ?? existingRow?.signalsV6,
    signalMvrvZ: latest.signalMvrvZ ?? existingRow?.signalMvrvZ,
  };
}

export function mergeLatestIntoHistory(
  history: IndicatorData[],
  latest: LatestData | null,
): IndicatorData[] {
  if (!latest?.date) {
    return history;
  }

  const existingIndex = history.findIndex((row) => row.d === latest.date);
  if (existingIndex >= 0) {
    const next = history.slice();
    next[existingIndex] = latestDataToHistoryRow(latest, next[existingIndex]);
    return next;
  }

  const lastHistoryDate = history.at(-1)?.d;
  if (lastHistoryDate && latest.date < lastHistoryDate) {
    return history;
  }

  return [
    ...history,
    latestDataToHistoryRow(latest),
  ];
}
