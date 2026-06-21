import type { TimeRange } from '@/types';

export const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  '6m': 180 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
  all: Infinity,
};

export const DEFAULT_THRESHOLDS = {
  priceMa200w: 1,
  priceRealized: 1,
  reserveRisk: 0.0016,
  mvrvZscore: 0,
  nupl: 0.15,
  lthMvrv: 1,
  lthSopr: 0.9,
  sthSopr: 1,
  sthMvrv: 1,
  puell: 0.6,
};

export const DEFAULT_DEEP_THRESHOLDS = {
  priceMa200w: 0.85,
  priceRealized: 0.9,
  reserveRisk: 0.0012,
  mvrvZscore: -0.5,
  nupl: 0,
  lthMvrv: 0.9,
  lthSopr: 0.75,
  sthSopr: 0.97,
  sthMvrv: 0.85,
  puell: 0.5,
};

export const CORE_INDICATOR_DATE_KEYS = [
  'priceMa200w',
  'mvrvZscore',
  'nupl',
  'lthMvrv',
  'lthSopr',
  'sthSopr',
  'sthMvrv',
  'puell',
] as const;

export const ONCHAIN_INDICATOR_DATE_KEYS = [
  'mvrvZscore',
  'nupl',
  'lthMvrv',
  'lthSopr',
  'sthSopr',
  'sthMvrv',
  'puell',
] as const;

export const INDICATOR_CONFIG = {
  priceMa200w: {
    name: 'Price / 200W-MA',
    unit: '',
    targetValue: 1,
    color: '#F7931A',
    description: '现价相对 200 周均线的位置。',
  },
  priceRealized: {
    name: 'Realized Price Ratio',
    unit: '',
    targetValue: 1,
    color: '#0EA5E9',
    description: '现价相对实现价格的位置，当前不属于核心展示指标。',
  },
  valuationBlend: {
    name: 'Valuation Blend',
    unit: '',
    targetValue: 1,
    color: '#14B8A6',
    description: '估值层组合数据，当前核心展示使用 MVRV Z-Score 与 NUPL 独立指标。',
  },
  mvrvZscore: {
    name: 'MVRV Z-Score',
    unit: '',
    targetValue: 0,
    color: '#10B981',
    description: '市值相对链上成本的标准化偏离程度，估值层。',
  },
  nupl: {
    name: 'NUPL',
    unit: '',
    targetValue: 0.15,
    color: '#14B8A6',
    description: '全网净未实现盈亏状态，估值层。',
  },
  reserveRisk: {
    name: 'Reserve Risk',
    unit: '',
    targetValue: 0.0016,
    color: '#10B981',
    description: '长期持有信心与价格风险相关数据，当前不属于核心展示指标。',
  },
  lthMvrv: {
    name: 'LTH-MVRV',
    unit: '',
    targetValue: 1,
    color: '#8B5CF6',
    description: '长期持有者未实现盈亏比，确认层。',
  },
  lthSopr: {
    name: 'LTH-SOPR',
    unit: '',
    targetValue: 0.9,
    color: '#A855F7',
    description: '长期持有者已实现盈亏比，确认层，使用 3 日均值和滚动 p20/p10 阈值。',
  },
  sthSopr: {
    name: 'STH-SOPR',
    unit: '',
    targetValue: 1,
    color: '#EAB308',
    description: '短期持有者已实现盈亏比，触发层，使用 3 日均值和滚动分位数。',
  },
  sthMvrv: {
    name: 'STH-MVRV',
    unit: '',
    targetValue: 1,
    color: '#22C55E',
    description: '短期持有者未实现盈亏压力，触发阈值使用过去 1460 天滚动 p27。',
  },
  puell: {
    name: 'Puell Multiple',
    unit: '',
    targetValue: 0.6,
    color: '#F97316',
    description: '矿工收入相对历史基准。',
  },
} as const;

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1w': '近1周',
  '1m': '近1月',
  '6m': '近6月',
  '1y': '近1年',
  all: '全部历史',
};
