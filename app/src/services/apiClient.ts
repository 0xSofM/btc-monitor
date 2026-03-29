import type { ApiMetricPoint } from './contracts';

export const API_BASE_URL = 'https://bitcoin-data.com';
export const STATIC_HISTORY_LIGHT_PATH = '/btc_indicators_history_light.json';
export const STATIC_HISTORY_FULL_PATH = '/btc_indicators_history.json';
export const STATIC_LATEST_PATH = '/btc_indicators_latest.json';
export const STATIC_MANIFEST_PATH = '/btc_indicators_manifest.json';

const DEFAULT_PROXY_URL = import.meta.env.PROD ? '/api/btc-data' : '';
export const PROXY_URL = import.meta.env.VITE_API_PROXY_URL || DEFAULT_PROXY_URL;

export async function fetchWithTimeout(
  url: string,
  timeout = 10000,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timerId);
  }
}

function buildApiUrl(endpoint: string): string {
  if (PROXY_URL) {
    return `${PROXY_URL}${endpoint}`;
  }

  return `${API_BASE_URL}${endpoint}`;
}

async function fetchMetricSeries(endpoint: string, metricName: string): Promise<ApiMetricPoint[]> {
  try {
    const response = await fetchWithTimeout(buildApiUrl(endpoint), 10000);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${metricName}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? (payload as ApiMetricPoint[]) : [];
  } catch (error) {
    console.error(`[DataService] Error fetching ${metricName}:`, error);
    return [];
  }
}

export async function fetchMvrvZScore(days = 1): Promise<ApiMetricPoint[]> {
  return fetchMetricSeries(`/v1/mvrv-zscore/${days}`, 'MVRV Z-Score');
}

export async function fetchLthMvrv(days = 1): Promise<ApiMetricPoint[]> {
  return fetchMetricSeries(`/v1/lth-mvrv/${days}`, 'LTH-MVRV');
}

export async function fetchPuellMultiple(days = 1): Promise<ApiMetricPoint[]> {
  return fetchMetricSeries(`/v1/puell-multiple/${days}`, 'Puell Multiple');
}

export async function fetchNupl(days = 1): Promise<ApiMetricPoint[]> {
  return fetchMetricSeries(`/v1/nupl/${days}`, 'NUPL');
}

export async function fetchBtcPrice(days = 1): Promise<ApiMetricPoint[]> {
  return fetchMetricSeries(`/v1/btc-price/${days}`, 'BTC Price');
}

export async function fetchStaticLatestRaw(): Promise<unknown> {
  const response = await fetchWithTimeout(STATIC_LATEST_PATH, 10000);
  if (!response.ok) {
    throw new Error('Failed to fetch latest static data');
  }

  return response.json();
}

export async function fetchStaticHistoryRaw(path: string, timeout: number): Promise<unknown[]> {
  const response = await fetchWithTimeout(path, timeout);
  if (!response.ok) {
    throw new Error(`Failed to fetch historical data from ${path}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error(`Invalid historical data format from ${path}`);
  }

  return payload;
}

export async function fetchStaticManifestRaw(): Promise<unknown> {
  const response = await fetchWithTimeout(STATIC_MANIFEST_PATH, 10000);
  if (!response.ok) {
    throw new Error('Failed to fetch manifest data');
  }

  return response.json();
}

export async function checkEndpoint(url: string, timeout = 5000): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(url, timeout);
    return response.ok;
  } catch {
    return false;
  }
}
