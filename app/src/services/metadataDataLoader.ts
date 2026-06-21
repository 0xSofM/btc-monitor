import type { StrategyMnavData } from '@/types';

import {
  fetchStaticManifestRaw,
  fetchStaticStrategyMnavRaw,
} from './apiClient';
import type { DataManifest } from './contracts';
import {
  normalizeManifestData,
  normalizeStrategyMnavData,
} from './normalizers';

export async function loadDataManifest(): Promise<DataManifest> {
  const raw = await fetchStaticManifestRaw();
  const manifest = normalizeManifestData(raw);
  if (!manifest) {
    throw new Error('Invalid manifest format');
  }

  return manifest;
}

export async function loadStrategyMnavData(): Promise<StrategyMnavData> {
  const raw = await fetchStaticStrategyMnavRaw();
  const data = normalizeStrategyMnavData(raw);
  if (!data) {
    throw new Error('Invalid Strategy mNAV data format');
  }

  return data;
}
