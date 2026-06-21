const DATA_VERSION = 'v1.5.1';

export type StoredEnvelope<T> = {
  version: string;
  timestamp: number;
  data: T;
  truncated?: boolean;
  storedRows?: number;
};

export type StoredValue = {
  parsed: unknown;
  data: unknown;
};

export type WriteResult = {
  ok: boolean;
  quotaExceeded: boolean;
  error?: unknown;
};

type StoredEnvelopeMetadata<T> = Omit<Partial<StoredEnvelope<T>>, 'version' | 'timestamp' | 'data'>;

export function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}

export function buildStoredEnvelope<T>(
  data: T,
  metadata: StoredEnvelopeMetadata<T> = {},
): StoredEnvelope<T> {
  return {
    version: DATA_VERSION,
    timestamp: Date.now(),
    ...metadata,
    data,
  };
}

export function readStoredValue(storage: Storage, key: string): StoredValue | null {
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as unknown;
  const envelope = asRecord(parsed);
  const storedVersion = typeof envelope?.version === 'string' ? envelope.version : undefined;

  if (storedVersion && storedVersion !== DATA_VERSION) {
    removeStoredValue(storage, key);
    return null;
  }

  return {
    parsed,
    data: envelope && 'data' in envelope ? envelope.data : parsed,
  };
}

export function removeStoredValue(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures; cache persistence is best-effort only.
  }
}

export function writeStoredValue(storage: Storage, key: string, value: string): WriteResult {
  try {
    storage.setItem(key, value);
    return {
      ok: true,
      quotaExceeded: false,
    };
  } catch (error) {
    return {
      ok: false,
      quotaExceeded: isQuotaExceededError(error),
      error,
    };
  }
}

function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const name = 'name' in error && typeof error.name === 'string' ? error.name : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const code = 'code' in error && typeof error.code === 'number' ? error.code : 0;

  return (
    name === 'QuotaExceededError'
    || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || code === 22
    || code === 1014
    || /quota|storage.*full|exceeded the quota/i.test(message)
  );
}
