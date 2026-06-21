import { describe, expect, it, vi } from 'vitest';

import { loadCachedResource } from './dataCache';

describe('data cache helpers', () => {
  it('returns a fresh cached resource without loading', async () => {
    const load = vi.fn(async () => 'remote');
    const remember = vi.fn();
    const onError = vi.fn();

    const value = await loadCachedResource({
      forceRefresh: false,
      cachedValue: 'cached',
      cachedTimestamp: Date.now(),
      durationMs: 60_000,
      load,
      remember,
      onError,
    });

    expect(value).toBe('cached');
    expect(load).not.toHaveBeenCalled();
    expect(remember).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('returns the previous cached resource when loading fails', async () => {
    const error = new Error('network failed');
    const load = vi.fn(async () => {
      throw error;
    });
    const remember = vi.fn();
    const onError = vi.fn();

    const value = await loadCachedResource({
      forceRefresh: true,
      cachedValue: 'cached',
      cachedTimestamp: 0,
      durationMs: 60_000,
      load,
      remember,
      onError,
    });

    expect(value).toBe('cached');
    expect(load).toHaveBeenCalledTimes(1);
    expect(remember).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
  });
});
