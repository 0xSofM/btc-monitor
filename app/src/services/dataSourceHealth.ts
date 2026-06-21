import {
  API_BASE_URL,
  PROXY_URL,
  STATIC_HISTORY_FULL_LIGHT_PATH,
  STATIC_HISTORY_LIGHT_PATH,
  checkEndpoint,
} from './apiClient';

export interface RemoteDataSourceHealth {
  apiAvailable: boolean;
  proxyAvailable: boolean;
  historyAvailable: boolean;
  historyLightAvailable: boolean;
  historyFullAvailable: boolean;
  manifestAvailable: boolean;
}

export async function checkRemoteDataSources(): Promise<RemoteDataSourceHealth> {
  const [apiAvailable, historyLightAvailable, historyFullAvailable, manifestAvailable] = await Promise.all([
    checkEndpoint(`${API_BASE_URL}/v1/btc-price/1`),
    checkEndpoint(STATIC_HISTORY_LIGHT_PATH),
    checkEndpoint(STATIC_HISTORY_FULL_LIGHT_PATH),
    checkEndpoint('/btc_indicators_manifest.json'),
  ]);

  const proxyAvailable = PROXY_URL
    ? await checkEndpoint(`${PROXY_URL}/latest`)
    : false;

  return {
    apiAvailable,
    proxyAvailable,
    historyAvailable: historyLightAvailable || historyFullAvailable,
    historyLightAvailable,
    historyFullAvailable,
    manifestAvailable,
  };
}
