import type { LatestData } from '@/types';

import { asBoolean, asRecord, asString, asStringArray, toNumberOrNull } from './normalizerPrimitives';

export function normalizeCanonicalLatest(value: unknown): LatestData['canonical'] | undefined {
  const payload = asRecord(value);
  if (!payload) {
    return undefined;
  }

  const score = asRecord(payload.score);
  return {
    model: asString(payload.model),
    displayIndicators: asStringArray(payload.displayIndicators ?? payload.display_indicators),
    compatibilityFields: asStringArray(payload.compatibilityFields ?? payload.compatibility_fields),
    score: score
      ? {
          valuation: toNumberOrNull(score.valuation) ?? undefined,
          trigger: toNumberOrNull(score.trigger) ?? undefined,
          confirmation: toNumberOrNull(score.confirmation) ?? undefined,
          total: toNumberOrNull(score.total) ?? undefined,
          maxTotal: toNumberOrNull(score.maxTotal ?? score.max_total) ?? undefined,
          band: asString(score.band),
          confirmed3d: asBoolean(score.confirmed3d ?? score.confirmed_3d),
          confidence: toNumberOrNull(score.confidence) ?? undefined,
        }
      : undefined,
    signals: asRecord(payload.signals) as LatestData['signalsV6'],
    signalCount: toNumberOrNull(payload.signalCount ?? payload.signal_count) ?? undefined,
    activeIndicatorCount: toNumberOrNull(payload.activeIndicatorCount ?? payload.active_indicator_count) ?? undefined,
    fallbackMode: asString(payload.fallbackMode ?? payload.fallback_mode),
  };
}

export function normalizeLegacyLatest(value: unknown): LatestData['legacy'] | undefined {
  const payload = asRecord(value);
  if (!payload) {
    return undefined;
  }

  const v2 = asRecord(payload.v2);
  const v4 = asRecord(payload.v4);
  return {
    v2: v2
      ? {
          signalCount: toNumberOrNull(v2.signalCount ?? v2.signal_count) ?? undefined,
          signalScore: toNumberOrNull(v2.signalScore ?? v2.signal_score) ?? undefined,
          maxSignalScore: toNumberOrNull(v2.maxSignalScore ?? v2.max_signal_score) ?? undefined,
          band: asString(v2.band),
          confirmed3d: asBoolean(v2.confirmed3d ?? v2.confirmed_3d),
        }
      : undefined,
    v4: v4
      ? {
          signalCount: toNumberOrNull(v4.signalCount ?? v4.signal_count) ?? undefined,
          totalScore: toNumberOrNull(v4.totalScore ?? v4.total_score) ?? undefined,
          maxTotalScore: toNumberOrNull(v4.maxTotalScore ?? v4.max_total_score) ?? undefined,
          band: asString(v4.band),
          confirmed3d: asBoolean(v4.confirmed3d ?? v4.confirmed_3d),
          signals: asRecord(v4.signals) as LatestData['signalsV4'],
        }
      : undefined,
  };
}
