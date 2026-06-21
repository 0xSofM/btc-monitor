export const TIME_RANGES = [
  { key: 'all', label: '全部' },
  { key: '1y', label: '1年' },
  { key: '6m', label: '6月' },
  { key: '1m', label: '1月' },
  { key: '1w', label: '1周' },
] as const;

export const RANGE_DAYS: Record<(typeof TIME_RANGES)[number]['key'], number> = {
  all: 0,
  '1y': 365,
  '6m': 180,
  '1m': 30,
  '1w': 7,
};
