export type HistoryMode = 'light' | 'full';

export type IndicatorKey =
  | 'priceMa200w'
  | 'priceRealized'
  | 'reserveRisk'
  | 'sthSopr'
  | 'sthMvrv'
  | 'puell';

export type ApiDatePayload = {
  priceMa200w?: string;
  price_ma200w?: string;
  priceRealized?: string;
  price_realized?: string;
  reserveRisk?: string;
  reserve_risk?: string;
  sthSopr?: string;
  sth_sopr?: string;
  sthMvrv?: string;
  sth_mvrv?: string;
  puell?: string;
};

export type ApiMetricPoint = {
  d?: string;
  btcPrice?: string | number;
  realizedPrice?: string | number;
  reserveRisk?: string | number;
  sthSopr?: string | number;
  sthMvrv?: string | number;
  puellMultiple?: string | number;
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
