import type { IndicatorData, LatestData } from '@/types';

import type { ApiDatePayload } from './contracts';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 1 || value === '1' || value === 'true') {
    return true;
  }

  if (value === 0 || value === '0' || value === 'false') {
    return false;
  }

  return undefined;
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = toFiniteNumber(value, Number.NaN);
  return Number.isNaN(parsed) ? null : parsed;
}

export function hasUsableValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'number') {
    return !Number.isNaN(value);
  }

  return true;
}

function normalizeApiDatePayload(value: unknown): ApiDatePayload | undefined {
  const payload = asRecord(value);
  if (!payload) {
    return undefined;
  }

  return {
    priceMa200w: asString(payload.priceMa200w),
    price_ma200w: asString(payload.price_ma200w),
    mvrvZ: asString(payload.mvrvZ),
    mvrv_z: asString(payload.mvrv_z),
    lthMvrv: asString(payload.lthMvrv),
    lth_mvrv: asString(payload.lth_mvrv),
    puell: asString(payload.puell),
    nupl: asString(payload.nupl),
  };
}

function normalizeIndicatorDates(
  value: unknown,
  fallbackDate: string,
): NonNullable<LatestData['indicatorDates']> {
  const payload = normalizeApiDatePayload(value);

  return {
    priceMa200w: payload?.priceMa200w ?? payload?.price_ma200w ?? fallbackDate,
    mvrvZ: payload?.mvrvZ ?? payload?.mvrv_z ?? fallbackDate,
    lthMvrv: payload?.lthMvrv ?? payload?.lth_mvrv ?? fallbackDate,
    puell: payload?.puell ?? fallbackDate,
    nupl: payload?.nupl ?? fallbackDate,
  };
}

export function normalizeIndicatorData(item: unknown): IndicatorData | null {
  const record = asRecord(item);
  if (!record) {
    return null;
  }

  const date = asString(record.d);
  if (!date) {
    return null;
  }

  const unixTsRaw = record.unixTs ?? record.unix_ts;
  const unixTs = unixTsRaw === undefined || unixTsRaw === null
    ? undefined
    : toFiniteNumber(unixTsRaw, Number.NaN);

  const rawApiDates = record.apiDataDate ?? record.api_data_date;
  const indicatorDates = normalizeIndicatorDates(rawApiDates, date);

  return {
    d: date,
    unixTs: Number.isNaN(unixTs ?? Number.NaN) ? undefined : unixTs,
    btcPrice: toNumberOrNull(record.btcPrice ?? record.btc_price) ?? undefined,
    priceMa200wRatio: toNumberOrNull(record.priceMa200wRatio ?? record.price_ma200w_ratio) ?? undefined,
    ma200w: toNumberOrNull(record.ma200w) ?? undefined,
    mvrvZscore: toNumberOrNull(record.mvrvZscore ?? record.mvrv_zscore) ?? undefined,
    lthMvrv: toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? undefined,
    puellMultiple: toNumberOrNull(record.puellMultiple ?? record.puell_multiple) ?? undefined,
    nupl: toNumberOrNull(record.nupl) ?? undefined,
    signalPriceMa: asBoolean(record.signalPriceMa ?? record.signal_price_ma),
    signalMvrvZ: asBoolean(record.signalMvrvZ ?? record.signal_mvrv_z),
    signalLthMvrv: asBoolean(record.signalLthMvrv ?? record.signal_lth_mvrv),
    signalPuell: asBoolean(record.signalPuell ?? record.signal_puell),
    signalNupl: asBoolean(record.signalNupl ?? record.signal_nupl),
    signalCount: toNumberOrNull(record.signalCount ?? record.signal_count) ?? undefined,
    indicatorDates,
  };
}

export function normalizeLatestData(item: unknown): LatestData | null {
  const record = asRecord(item);
  if (!record) {
    return null;
  }

  const date = asString(record.date ?? record.d);
  if (!date) {
    return null;
  }

  const incomingSignals = asRecord(record.signals);
  const incomingIndicatorDates = record.indicatorDates ?? record.apiDataDate ?? record.api_data_date;

  const btcPrice = toNumberOrNull(record.btcPrice ?? record.btc_price) ?? 0;
  const priceMa200wRatio = toNumberOrNull(record.priceMa200wRatio ?? record.price_ma200w_ratio) ?? 0;
  const mvrvZscore = toNumberOrNull(record.mvrvZscore ?? record.mvrv_zscore) ?? 0;
  const lthMvrv = toNumberOrNull(record.lthMvrv ?? record.lth_mvrv) ?? 0;
  const puellMultiple = toNumberOrNull(record.puellMultiple ?? record.puell_multiple) ?? 0;
  const nupl = toNumberOrNull(record.nupl) ?? 0;
  const ma200w = toNumberOrNull(record.ma200w) ?? undefined;

  const signals = {
    priceMa200w: asBoolean(incomingSignals?.priceMa200w ?? record.signalPriceMa ?? record.signal_price_ma)
      ?? (priceMa200wRatio < 1),
    mvrvZ: asBoolean(incomingSignals?.mvrvZ ?? record.signalMvrvZ ?? record.signal_mvrv_z)
      ?? (mvrvZscore < 0),
    lthMvrv: asBoolean(incomingSignals?.lthMvrv ?? record.signalLthMvrv ?? record.signal_lth_mvrv)
      ?? (lthMvrv < 1),
    puell: asBoolean(incomingSignals?.puell ?? record.signalPuell ?? record.signal_puell)
      ?? (puellMultiple < 0.5),
    nupl: asBoolean(incomingSignals?.nupl ?? record.signalNupl ?? record.signal_nupl)
      ?? (nupl < 0),
  };

  const signalCountRaw = record.signalCount ?? record.signal_count;
  const signalCount = signalCountRaw === undefined || signalCountRaw === null
    ? Object.values(signals).filter(Boolean).length
    : toFiniteNumber(signalCountRaw, Object.values(signals).filter(Boolean).length);

  return {
    date,
    btcPrice,
    priceMa200wRatio,
    ma200w,
    mvrvZscore,
    lthMvrv,
    puellMultiple,
    nupl,
    signalCount,
    signals,
    indicatorDates: normalizeIndicatorDates(incomingIndicatorDates, date),
  };
}
