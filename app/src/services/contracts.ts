export type HistoryMode = 'light' | 'full';

export type IndicatorKey = 'priceMa200w' | 'mvrvZ' | 'lthMvrv' | 'puell' | 'nupl';

export type ApiDatePayload = {
  priceMa200w?: string;
  price_ma200w?: string;
  mvrvZ?: string;
  mvrv_z?: string;
  lthMvrv?: string;
  lth_mvrv?: string;
  puell?: string;
  nupl?: string;
};

export type ApiMetricPoint = {
  d?: string;
  btcPrice?: string | number;
  mvrvZscore?: string | number;
  lthMvrv?: string | number;
  puellMultiple?: string | number;
  nupl?: string | number;
  [key: string]: unknown;
};

export type FetchHistoricalOptions = {
  mode?: HistoryMode;
  forceRefresh?: boolean;
};

export type FetchStaticLatestOptions = {
  enrichWithHistory?: boolean;
  forceRefresh?: boolean;
};

export interface DataManifest {
  generatedAt: string;
  latestDate: string;
  lastUpdated: string;
  historyRows: number;
  historyLightRows: number;
  schemaVersion: string;
}
