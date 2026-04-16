export interface IndicatorData {
  d: string;
  unixTs?: number;
  btcPrice?: number;
  priceMa200wRatio?: number;
  priceRealizedRatio?: number;
  ma200w?: number;
  realizedPrice?: number;
  reserveRisk?: number;
  sthSopr?: number;
  sthMvrv?: number;
  puellMultiple?: number;
  signalPriceMa200w?: boolean;
  signalPriceRealized?: boolean;
  signalReserveRisk?: boolean;
  signalReserveRiskV4?: boolean;
  signalSthSopr?: boolean;
  signalSthMvrv?: boolean;
  signalSthGroup?: boolean;
  signalLthMvrv?: boolean;
  signalSthSoprAux?: boolean;
  signalPuell?: boolean;
  signalCount?: number;
  signalCountV4?: number;
  activeIndicatorCount?: number;
  activeIndicatorCountV4?: number;
  maxSignalScoreV2?: number;
  scorePriceMa200w?: number;
  scorePriceRealized?: number;
  scoreReserveRisk?: number;
  scoreReserveRiskV4?: number;
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
  signalConfidence?: number;
  dataFreshnessScore?: number;
  fallbackMode?: string;
  staleIndicators?: Array<string | { key?: string; lagDays?: number; maxLagDays?: number; sourceDate?: string }>;
  coreIndicatorSet?: string;
  scoringModelVersion?: string;
  indicatorDates?: {
    priceMa200w?: string;
    priceRealized?: string;
    reserveRisk?: string;
    lthMvrv?: string;
    mvrvZscore?: string;
    sthSopr?: string;
    sthMvrv?: string;
    puell?: string;
  };
  // Legacy V1 compatibility fields
  mvrvZscore?: number;
  lthMvrv?: number;
  nupl?: number;
  signalPriceMa?: boolean;
  signalMvrvZ?: boolean;
  signalNupl?: boolean;
}

export interface LatestData {
  date: string;
  btcPrice: number;
  priceMa200wRatio: number;
  priceRealizedRatio: number;
  ma200w?: number;
  realizedPrice?: number;
  reserveRisk: number;
  sthSopr: number;
  sthMvrv: number;
  puellMultiple: number;
  signalCount: number;
  activeIndicatorCount?: number;
  signalCountV4?: number;
  activeIndicatorCountV4?: number;
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
  signalConfidence?: number;
  dataFreshnessScore?: number;
  fallbackMode?: string;
  scoreSthGroup?: number;
  signalSthGroup?: boolean;
  scoringModelVersion?: string;
  legacyScoringModelVersion?: string;
  schemaVersion?: string;
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
    sthMvrv: boolean;
    lthMvrv: boolean;
    puell: boolean;
    sthSoprAux?: boolean;
  };
  indicatorDates?: {
    priceMa200w?: string;
    priceRealized?: string;
    reserveRisk?: string;
    lthMvrv?: string;
    mvrvZscore?: string;
    sthSopr?: string;
    sthMvrv?: string;
    puell?: string;
  };
  staleIndicators?: Array<string | { key?: string; lagDays?: number; maxLagDays?: number; sourceDate?: string }>;
  thresholds?: Record<string, { trigger: number; deep: number }>;
  // Legacy V1 compatibility fields
  mvrvZscore?: number;
  lthMvrv?: number;
  nupl?: number;
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
}

export interface SignalEvent {
  date: string;
  btcPrice: number;
  signalCount: number;
  triggeredIndicators: string[];
}

export type TimeRange = '1w' | '1m' | '6m' | '1y' | 'all';

export interface ChartDataPoint {
  date: string;
  value: number;
  btcPrice?: number;
  signal?: boolean;
}
