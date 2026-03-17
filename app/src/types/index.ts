export interface IndicatorData {
  d: string;
  unixTs?: string;
  btcPrice?: number | string;
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
  ma200w?: number;  // 200周均线具体数值
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
  // 各指标的具体数据日期
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
  // 新增字段
  dataDate?: string;  // 数据实际日期
  detailValue?: string;  // 详细数值展示（如MA200的BTC价格和均线值）
}

export interface SignalEvent {
  date: string;
  btcPrice: number;
  signalCount: number;
  triggeredIndicators: string[];
}

// 时间范围类型
export type TimeRange = '1w' | '1m' | '6m' | '1y' | 'all';

// 图表数据点
export interface ChartDataPoint {
  date: string;
  value: number;
  btcPrice?: number;
  signal?: boolean;
}
