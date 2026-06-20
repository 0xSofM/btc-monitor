export type IndicatorKey =
  | 'priceMa200w'
  | 'priceRealized'
  | 'valuationBlend'
  | 'mvrvZscore'
  | 'nupl'
  | 'reserveRisk'
  | 'lthMvrv'
  | 'lthSopr'
  | 'sthSopr'
  | 'sthMvrv'
  | 'puell';

export type ApiDatePayload = {
  btcPrice?: string;
  priceMa200w?: string;
  price_ma200w?: string;
  priceRealized?: string;
  price_realized?: string;
  reserveRisk?: string;
  reserve_risk?: string;
  lthMvrv?: string;
  lth_mvrv?: string;
  lthSopr?: string;
  lth_sopr?: string;
  mvrvZscore?: string;
  mvrv_zscore?: string;
  nupl?: string;
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
  mvrvZscore?: string | number;
  nupl?: string | number;
  sthSopr?: string | number;
  sthMvrv?: string | number;
  puellMultiple?: string | number;
  [key: string]: unknown;
};

export type FetchHistoricalOptions = {
  forceRefresh?: boolean;
  full?: boolean;
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
  historyLightRows?: number;
  historyFiles?: {
    full?: string;
    light?: string;
    lightRecentDays?: number;
    lightFields?: string[];
  };
  schemaVersion: string;
  signalEventsV4Rows?: number;
  indicatorSet?: string;
  scoringModelVersion?: string;
  activeIndicatorCountV4?: number;
  maxTotalScoreV4?: number;
  activeIndicatorCountV6?: number;
  maxTotalScoreV6?: number;
  dataHealth?: {
    indicatorLagDays?: Record<string, number | null>;
    staleIndicators?: unknown[];
    inactiveIndicators?: unknown[];
    fallbackModeV6?: string;
    dataFreshnessScoreV6?: number;
    signalConfidenceV6?: number;
  };
  schemaContract?: {
    canonicalModel?: string;
    historyRequiredFields?: string[];
    missingCoreHistoryFields?: string[];
    legacyCompatibility?: string[];
  };
}
