export interface ThresholdValue {
  trigger?: number;
  deep?: number;
  method?: string;
  windowDays?: number;
  minHistoryDays?: number;
  triggerQuantile?: number;
  deepQuantile?: number;
  smoothingDays?: number;
  valueField?: string;
  role?: string;
  displayRole?: string;
  fallback?: {
    trigger?: number;
    deep?: number;
  };
}

export type ThresholdMap = Record<string, ThresholdValue>;

export interface IndicatorData {
  d: string;
  unixTs?: number;
  btcPrice?: number;
  priceMa200wRatio?: number;
  priceRealizedRatio?: number;
  ma200w?: number;
  realizedPrice?: number;
  reserveRisk?: number;
  lthSopr?: number;
  lthSoprMa3?: number;
  sthSopr?: number;
  sthSoprMa3?: number;
  sthMvrv?: number;
  puellMultiple?: number;
  nupl?: number;
  signalPriceMa200w?: boolean;
  signalPriceRealized?: boolean;
  signalReserveRisk?: boolean;
  signalReserveRiskV4?: boolean;
  signalMvrvZscoreCore?: boolean;
  signalNupl?: boolean;
  signalNuplCore?: boolean;
  signalValuationBlendV6?: boolean;
  signalSthSopr?: boolean;
  signalSthMvrv?: boolean;
  signalSthGroup?: boolean;
  signalLthMvrv?: boolean;
  signalLthSopr?: boolean;
  signalSthSoprTrigger?: boolean;
  signalSthSoprAux?: boolean;
  signalPuell?: boolean;
  signalCount?: number;
  signalCountV4?: number;
  signalCountV6?: number;
  activeIndicatorCount?: number;
  activeIndicatorCountV4?: number;
  activeIndicatorCountV6?: number;
  maxSignalScoreV2?: number;
  scorePriceMa200w?: number;
  scorePriceRealized?: number;
  scoreReserveRisk?: number;
  scoreReserveRiskV4?: number;
  scoreMvrvZscore?: number;
  scoreMvrvZscoreCore?: number;
  scoreNupl?: number;
  scoreNuplCore?: number;
  valuationBlendScoreV6?: number;
  scoreLthMvrv?: number;
  scoreLthSopr?: number;
  scoreSthSopr?: number;
  scoreSthMvrv?: number;
  scoreSthGroup?: number;
  scorePuell?: number;
  signalScoreV2?: number;
  signalScoreV2Min3d?: number;
  signalConfirmed3d?: boolean;
  signalBandV2?: string;
  valuationScore?: number;
  maxValuationScore?: number;
  triggerScore?: number;
  maxTriggerScore?: number;
  confirmationScore?: number;
  maxConfirmationScore?: number;
  auxiliaryScore?: number;
  maxAuxiliaryScore?: number;
  totalScoreV4?: number;
  maxTotalScoreV4?: number;
  totalScoreV4Min3d?: number;
  signalConfirmed3dV4?: boolean;
  signalBandV4?: string;
  valuationScoreV6?: number;
  maxValuationScoreV6?: number;
  triggerScoreV6?: number;
  maxTriggerScoreV6?: number;
  confirmationScoreV6?: number;
  maxConfirmationScoreV6?: number;
  totalScoreV6?: number;
  maxTotalScoreV6?: number;
  totalScoreV6Min3d?: number;
  signalConfirmed3dV6?: boolean;
  signalBandV6?: string;
  signalConfidence?: number;
  signalConfidenceV6?: number;
  dataFreshnessScore?: number;
  dataFreshnessScoreV6?: number;
  fallbackMode?: string;
  fallbackModeV6?: string;
  staleIndicators?: Array<string | { key?: string; lagDays?: number; maxLagDays?: number; sourceDate?: string }>;
  indicatorSet?: string;
  coreIndicatorSet?: string;
  scoringModelVersion?: string;
  thresholds?: ThresholdMap;
  indicatorDates?: {
    btcPrice?: string;
    priceMa200w?: string;
    priceRealized?: string;
    reserveRisk?: string;
    lthMvrv?: string;
    lthSopr?: string;
    mvrvZscore?: string;
    nupl?: string;
    sthSopr?: string;
    sthMvrv?: string;
    puell?: string;
  };
  // Legacy V1 compatibility fields
  mvrvZscore?: number;
  lthMvrv?: number;
  signalPriceMa?: boolean;
  signalMvrvZ?: boolean;
  signalsV6?: {
    priceMa200w?: boolean;
    priceRealized?: boolean;
    mvrvZscore?: boolean;
    nupl?: boolean;
    valuationBlend?: boolean;
    sthMvrv?: boolean;
    sthSoprTrigger?: boolean;
    lthMvrv?: boolean;
    lthSopr?: boolean;
    puell?: boolean;
  };
}

export interface LatestData {
  date: string;
  lastUpdated?: string;
  btcPrice: number;
  priceMa200wRatio: number;
  priceRealizedRatio: number;
  ma200w?: number;
  realizedPrice?: number;
  reserveRisk: number;
  nupl?: number;
  lthSopr?: number;
  lthSoprMa3?: number;
  sthSopr: number;
  sthSoprMa3?: number;
  sthMvrv: number;
  puellMultiple: number;
  signalCount: number;
  activeIndicatorCount?: number;
  signalCountV4?: number;
  activeIndicatorCountV4?: number;
  signalCountV6?: number;
  activeIndicatorCountV6?: number;
  maxSignalScoreV2?: number;
  signalScoreV2?: number;
  signalScoreV2Min3d?: number | null;
  signalConfirmed3d?: boolean;
  signalBandV2?: string;
  valuationScore?: number;
  maxValuationScore?: number;
  triggerScore?: number;
  maxTriggerScore?: number;
  confirmationScore?: number;
  maxConfirmationScore?: number;
  auxiliaryScore?: number;
  maxAuxiliaryScore?: number;
  totalScoreV4?: number;
  maxTotalScoreV4?: number;
  totalScoreV4Min3d?: number | null;
  signalConfirmed3dV4?: boolean;
  signalBandV4?: string;
  valuationScoreV6?: number;
  maxValuationScoreV6?: number;
  triggerScoreV6?: number;
  maxTriggerScoreV6?: number;
  confirmationScoreV6?: number;
  maxConfirmationScoreV6?: number;
  totalScoreV6?: number;
  maxTotalScoreV6?: number;
  totalScoreV6Min3d?: number | null;
  signalConfirmed3dV6?: boolean;
  signalBandV6?: string;
  signalConfidence?: number;
  signalConfidenceV6?: number;
  dataFreshnessScore?: number;
  dataFreshnessScoreV6?: number;
  fallbackMode?: string;
  fallbackModeV6?: string;
  scoreMvrvZscoreCore?: number;
  signalMvrvZscoreCore?: boolean;
  scoreNupl?: number;
  scoreNuplCore?: number;
  valuationBlendScoreV6?: number;
  signalNupl?: boolean;
  signalNuplCore?: boolean;
  signalValuationBlendV6?: boolean;
  scorePriceMa200w?: number;
  scorePriceRealized?: number;
  scoreReserveRisk?: number;
  scoreReserveRiskV4?: number;
  scoreMvrvZscore?: number;
  scoreLthMvrv?: number;
  scoreLthSopr?: number;
  scoreSthSopr?: number;
  scoreSthMvrv?: number;
  scorePuell?: number;
  scoreSthGroup?: number;
  signalSthGroup?: boolean;
  scoringModelVersion?: string;
  legacyScoringModelVersion?: string;
  schemaVersion?: string;
  indicatorSet?: string;
  coreIndicatorSet?: string;
  signals: {
    priceMa200w: boolean;
    priceRealized: boolean;
    reserveRisk: boolean;
    sthSopr: boolean;
    sthMvrv: boolean;
    sthGroup?: boolean;
    puell: boolean;
  };
  signalsV4?: {
    priceMa200w: boolean;
    priceRealized: boolean;
    reserveRisk: boolean;
    mvrvZscore?: boolean;
    sthMvrv: boolean;
    lthMvrv: boolean;
    lthSopr?: boolean;
    puell: boolean;
    sthSoprTrigger?: boolean;
  };
  signalsV6?: {
    priceMa200w?: boolean;
    priceRealized?: boolean;
    mvrvZscore?: boolean;
    nupl?: boolean;
    valuationBlend?: boolean;
    sthMvrv?: boolean;
    sthSoprTrigger?: boolean;
    lthMvrv?: boolean;
    lthSopr?: boolean;
    puell?: boolean;
  };
  indicatorDates?: {
    btcPrice?: string;
    priceMa200w?: string;
    priceRealized?: string;
    reserveRisk?: string;
    lthMvrv?: string;
    lthSopr?: string;
    mvrvZscore?: string;
    nupl?: string;
    sthSopr?: string;
    sthMvrv?: string;
    puell?: string;
  };
  staleIndicators?: Array<string | { key?: string; lagDays?: number; maxLagDays?: number; sourceDate?: string }>;
  thresholds?: ThresholdMap;
  canonical?: {
    model?: string;
    displayIndicators?: string[];
    compatibilityFields?: string[];
    score?: {
      valuation?: number;
      trigger?: number;
      confirmation?: number;
      total?: number;
      maxTotal?: number;
      band?: string;
      confirmed3d?: boolean;
      confidence?: number;
    };
    signals?: LatestData['signalsV6'];
    signalCount?: number;
    activeIndicatorCount?: number;
    fallbackMode?: string;
  };
  legacy?: {
    v2?: {
      signalCount?: number;
      signalScore?: number;
      maxSignalScore?: number;
      band?: string;
      confirmed3d?: boolean;
    };
    v4?: {
      signalCount?: number;
      totalScore?: number;
      maxTotalScore?: number;
      band?: string;
      confirmed3d?: boolean;
      signals?: LatestData['signalsV4'];
    };
  };
  // Legacy V1 compatibility fields
  mvrvZscore?: number;
  lthMvrv?: number;
  signalMvrvZ?: boolean;
}

export interface IndicatorConfig {
  key: string;
  name: string;
  description: string;
  targetValue: number;
  targetOperator: 'lt' | 'gt';
  currentValue: number;
  triggered: boolean;
  format: 'price' | 'ratio' | 'number';
  color: string;
  dataDate?: string;
  detailValue?: string;
  targetLabel?: string;
}

export interface SignalEvent {
  date: string;
  btcPrice: number;
  signalCount: number;
  triggeredIndicators: string[];
}

export interface StrategyMnavData {
  date: string;
  generatedAt?: string;
  source?: string;
  formula?: string;
  mstr: {
    price?: number;
    marketCapUsdM?: number;
    enterpriseValueUsdM?: number;
    previousEnterpriseValueUsdM?: number;
    debtUsdM?: number;
    preferredEquityUsdM?: number;
    debtPreferredByMarketCapPct?: number;
    sharesVolume?: number;
    timestampUtc?: string;
  };
  btcReserve: {
    btcHoldings?: number;
    btcPriceUsd?: number;
    btcReserveUsdM?: number;
    previousBtcReserveUsdM?: number;
    satsPerShare?: number;
    timestamp?: string;
    msTimestamp?: number;
  };
  mnav: {
    value?: number;
    previousValue?: number;
    change?: number;
    band?: string;
    riskFlag?: string;
    equityPremium?: number;
  };
  dataHealth?: {
    isStale?: boolean;
    mstrTimestampUtc?: string;
    btcTimestamp?: string;
  };
}

export interface StrategyMnavHistoryPoint {
  date: string;
  generatedAt?: string;
  value: number;
  band?: string;
  riskFlag?: string;
  enterpriseValueUsdM?: number;
  btcReserveUsdM?: number;
  marketCapUsdM?: number;
  equityPremium?: number;
  mstrPrice?: number;
  btcPrice?: number;
  btcHoldings?: number;
  satsPerShare?: number;
  mstrTimestampUtc?: string;
  btcTimestamp?: string;
  source?: string;
  observationType?: string;
}

export type TimeRange = '1w' | '1m' | '6m' | '1y' | 'all';

export interface ChartDataPoint {
  date: string;
  value: number | null;
  triggerValue?: number | null;
  deepValue?: number | null;
  btcPrice?: number;
  signal?: boolean;
}
