import type { SignalMarkerPlan } from './indicatorChartUtils';

function getSignalMarkerLimit(visiblePointCount: number): number {
  if (visiblePointCount > 3000) {
    return 42;
  }

  if (visiblePointCount > 1200) {
    return 56;
  }

  if (visiblePointCount > 500) {
    return 80;
  }

  return 140;
}

export function buildSignalMarkerPlan<T>(
  series: T[],
  startIndex: number,
  endIndex: number,
  isSignalPoint: (point: T) => boolean,
  getKey: (point: T) => string,
): SignalMarkerPlan {
  const signalIndexes: number[] = [];
  const safeStartIndex = Math.max(0, startIndex);
  const safeEndIndex = Math.min(series.length - 1, endIndex);

  for (let index = safeStartIndex; index <= safeEndIndex; index += 1) {
    const point = series[index];
    if (point && isSignalPoint(point)) {
      signalIndexes.push(index);
    }
  }

  const visiblePointCount = Math.max(0, safeEndIndex - safeStartIndex + 1);
  const markerLimit = getSignalMarkerLimit(visiblePointCount);
  const compact = signalIndexes.length > markerLimit;
  const step = compact ? Math.ceil(signalIndexes.length / markerLimit) : 1;
  const keys = new Set<string>();

  signalIndexes.forEach((index, signalIndex) => {
    if (!compact || signalIndex % step === 0 || signalIndex === signalIndexes.length - 1) {
      keys.add(getKey(series[index]));
    }
  });

  return {
    keys,
    totalCount: signalIndexes.length,
    compact,
  };
}
