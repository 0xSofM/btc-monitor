import type { ThresholdMap, ThresholdValue } from '@/types';

import { asRecord, asString, toNumberOrNull } from './normalizerPrimitives';

function normalizeThresholdValue(value: unknown): ThresholdValue | undefined {
  const payload = asRecord(value);
  if (!payload) {
    return undefined;
  }

  const trigger = toNumberOrNull(payload.trigger);
  const deep = toNumberOrNull(payload.deep);
  const fallbackPayload = asRecord(payload.fallback);
  const fallback = fallbackPayload
    ? {
        trigger: toNumberOrNull(fallbackPayload.trigger) ?? undefined,
        deep: toNumberOrNull(fallbackPayload.deep) ?? undefined,
      }
    : undefined;
  const normalized = {
    trigger: trigger ?? undefined,
    deep: deep ?? undefined,
    method: asString(payload.method),
    windowDays: toNumberOrNull(payload.windowDays ?? payload.window_days) ?? undefined,
    minHistoryDays: toNumberOrNull(payload.minHistoryDays ?? payload.min_history_days) ?? undefined,
    triggerQuantile: toNumberOrNull(payload.triggerQuantile ?? payload.trigger_quantile) ?? undefined,
    deepQuantile: toNumberOrNull(payload.deepQuantile ?? payload.deep_quantile) ?? undefined,
    smoothingDays: toNumberOrNull(payload.smoothingDays ?? payload.smoothing_days) ?? undefined,
    valueField: asString(payload.valueField ?? payload.value_field),
    role: asString(payload.role),
    displayRole: asString(payload.displayRole ?? payload.display_role),
    fallback:
      fallback && (fallback.trigger !== undefined || fallback.deep !== undefined)
        ? fallback
        : undefined,
  };

  if (Object.values(normalized).every((entry) => entry === undefined)) {
    return undefined;
  }

  return normalized;
}

export function normalizeThresholdMap(value: unknown): ThresholdMap | undefined {
  const payload = asRecord(value);
  if (!payload) {
    return undefined;
  }

  const normalized = Object.entries(payload).reduce<Record<string, ThresholdValue>>((acc, [key, rawValue]) => {
    const threshold = normalizeThresholdValue(rawValue);
    if (threshold) {
      acc[key] = threshold;
    }
    return acc;
  }, {});

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
