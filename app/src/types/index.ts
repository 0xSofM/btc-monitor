export interface IndicatorData {
  d: string;
  unixTs?: number;
  btcPrice?: number;
  priceMa200wRatio?: number;
  ma200w?: number;
  mvrvZscore?: number;
  lthMvrv?: number;
  puellMultiple?: number;
  nupl?: number;
  signalPriceMa?: boolean;
  signalMvrvZ?: boolean;
  signalLthMvrv?: boolean;
  signalPuell?: boolean;
  signalNupl?: boolean;
  signalCount?: number;
  indicatorDates?: {
    priceMa200w?: string;
    mvrvZ?: string;
    lthMvrv?: string;
    puell?: string;
    nupl?: string;
  };
}

export interface LatestData {
  date: string;
  btcPrice: number;
  priceMa200wRatio: number;
  ma200w?: number;
  mvrvZscore: number;
  lthMvrv: number;
  puellMultiple: number;
  nupl: number;
  signalCount: number;
  signals: {
    priceMa200w: boolean;
    mvrvZ: boolean;
    lthMvrv: boolean;
    puell: boolean;
    nupl: boolean;
  };
  indicatorDates?: {
    priceMa200w?: string;
    mvrvZ?: string;
    lthMvrv?: string;
    puell?: string;
    nupl?: string;
  };
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
