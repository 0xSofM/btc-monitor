import type { IndicatorData, LatestData, SignalEvent, TimeRange, ChartDataPoint } from '@/types';

// API 配置
const API_BASE_URL = 'https://bitcoin-data.com';

// 代理配置（用于解决 CORS 问题）
const PROXY_URL = import.meta.env.VITE_API_PROXY_URL || '';

// 数据刷新配置
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5分钟刷新一次（毫秒）
const CACHE_DURATION = 60 * 1000; // 本地缓存1分钟

// 内存缓存
let cache: {
  data: LatestData | null;
  history: IndicatorData[];
  timestamp: number;
} = {
  data: null,
  history: [],
  timestamp: 0
};

// 从历史数据中提取最新数据
export function getLatestFromHistory(data: IndicatorData[]): LatestData | null {
  if (!data || data.length === 0) return null;
  
  // 获取最后一条数据
  const latest = data[data.length - 1];
  
  const btcPrice = typeof latest.btcPrice === 'string' ? parseFloat(latest.btcPrice) : (latest.btcPrice || 0);
  const priceMa200wRatio = latest.priceMa200wRatio || 0;
  const mvrvZscore = latest.mvrvZscore || 0;
  const lthMvrv = latest.lthMvrv || 0;
  const puellMultiple = latest.puellMultiple || 0;
  const nupl = latest.nupl || 0;
  const ma200w = latest.ma200w;
  
  const signals = {
    priceMa200w: priceMa200wRatio < 1,
    mvrvZ: mvrvZscore < 0,
    lthMvrv: lthMvrv < 1,
    puell: puellMultiple < 0.5,
    nupl: nupl < 0
  };
  
  const signalCount = Object.values(signals).filter(Boolean).length;
  
  // 获取各指标的实际数据日期
  // 由于数据可能经过向前填充，需要查找每个指标最后一次实际更新的日期
  const indicatorDates = findIndicatorDates(data);
  
  return {
    date: latest.d,
    btcPrice,
    priceMa200wRatio,
    ma200w,
    mvrvZscore,
    lthMvrv,
    puellMultiple,
    nupl,
    signalCount,
    signals,
    indicatorDates
  };
}

// 查找各指标的最后有效数据日期
// 策略：查找该指标值最后一次发生变化的日期（排除向前填充的重复值）
function findIndicatorDates(data: IndicatorData[]) {
  const latest = data[data.length - 1];
  const dates: NonNullable<LatestData['indicatorDates']> = {
    priceMa200w: latest?.d
  };
  
  // 获取最新值
  const latestMvrv = latest?.mvrvZscore;
  const latestLth = latest?.lthMvrv;
  const latestPuell = latest?.puellMultiple;
  const latestNupl = latest?.nupl;
  
  // 从后向前查找，找到值第一次等于最新值的位置
  // 这个位置往前一天就是实际更新的日期
  for (let i = data.length - 1; i >= 0; i--) {
    const record = data[i];
    const prevRecord = i > 0 ? data[i - 1] : null;
    
    // MVRV: 找到值变化的位置
    if (!dates.mvrvZ && latestMvrv !== undefined && latestMvrv !== null) {
      const currVal = record.mvrvZscore;
      const prevVal = prevRecord ? prevRecord.mvrvZscore : null;
      if (currVal === latestMvrv && prevVal !== currVal) {
        dates.mvrvZ = record.d;
      }
    }

    // LTH-MVRV
    if (!dates.lthMvrv && latestLth !== undefined && latestLth !== null) {
      const currVal = record.lthMvrv;
      const prevVal = prevRecord ? prevRecord.lthMvrv : null;
      if (currVal === latestLth && prevVal !== currVal) {
        dates.lthMvrv = record.d;
      }
    }

    // Puell
    if (!dates.puell && latestPuell !== undefined && latestPuell !== null) {
      const currVal = record.puellMultiple;
      const prevVal = prevRecord ? prevRecord.puellMultiple : null;
      if (currVal === latestPuell && prevVal !== currVal) {
        dates.puell = record.d;
      }
    }
    
    // NUPL
    if (!dates.nupl && latestNupl !== undefined && latestNupl !== null) {
      const currVal = record.nupl;
      const prevVal = prevRecord?.nupl ?? null;
      if (currVal === latestNupl && prevVal !== currVal) {
        dates.nupl = record.d;
      }
    }
    
    // 如果都找到了就退出
    if (dates.mvrvZ && dates.lthMvrv && dates.puell && dates.nupl) {
      break;
    }
  }
  
  // 如果没找到（说明整个历史都是同一个值），使用最早有值的日期
  if (!dates.mvrvZ || !dates.lthMvrv || !dates.puell || !dates.nupl) {
    for (let i = data.length - 1; i >= 0; i--) {
      const record = data[i];
      if (!dates.mvrvZ && record.mvrvZscore !== null && record.mvrvZscore !== undefined) {
        dates.mvrvZ = record.d;
      }
      if (!dates.lthMvrv && record.lthMvrv !== null && record.lthMvrv !== undefined) {
        dates.lthMvrv = record.d;
      }
      if (!dates.puell && record.puellMultiple !== null && record.puellMultiple !== undefined) {
        dates.puell = record.d;
      }
      if (!dates.nupl && record.nupl !== null && record.nupl !== undefined) {
        dates.nupl = record.d;
      }
    }
  }
  
  return dates;
}

// 构建 API URL（支持代理）
function buildApiUrl(endpoint: string): string {
  if (PROXY_URL) {
    return `${PROXY_URL}${endpoint}`;
  }
  return `${API_BASE_URL}${endpoint}`;
}

// 带超时的 fetch
async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 获取MVRV Z-Score数据
export async function fetchMvrvZScore(days: number = 1): Promise<any[]> {
  try {
    const response = await fetchWithTimeout(buildApiUrl(`/v1/mvrv-zscore/${days}`));
    if (!response.ok) throw new Error('Failed to fetch MVRV Z-Score');
    return await response.json();
  } catch (error) {
    console.error('Error fetching MVRV Z-Score:', error);
    return [];
  }
}

// 获取LTH-MVRV数据
export async function fetchLthMvrv(days: number = 1): Promise<any[]> {
  try {
    const response = await fetchWithTimeout(buildApiUrl(`/v1/lth-mvrv/${days}`));
    if (!response.ok) throw new Error('Failed to fetch LTH-MVRV');
    return await response.json();
  } catch (error) {
    console.error('Error fetching LTH-MVRV:', error);
    return [];
  }
}

// 获取Puell Multiple数据
export async function fetchPuellMultiple(days: number = 1): Promise<any[]> {
  try {
    const response = await fetchWithTimeout(buildApiUrl(`/v1/puell-multiple/${days}`));
    if (!response.ok) throw new Error('Failed to fetch Puell Multiple');
    return await response.json();
  } catch (error) {
    console.error('Error fetching Puell Multiple:', error);
    return [];
  }
}

// 获取NUPL数据
export async function fetchNupl(days: number = 1): Promise<any[]> {
  try {
    const response = await fetchWithTimeout(buildApiUrl(`/v1/nupl/${days}`));
    if (!response.ok) throw new Error('Failed to fetch NUPL');
    return await response.json();
  } catch (error) {
    console.error('Error fetching NUPL:', error);
    return [];
  }
}

// 获取BTC价格数据
export async function fetchBtcPrice(days: number = 1): Promise<any[]> {
  try {
    const response = await fetchWithTimeout(buildApiUrl(`/v1/btc-price/${days}`));
    if (!response.ok) throw new Error('Failed to fetch BTC Price');
    return await response.json();
  } catch (error) {
    console.error('Error fetching BTC Price:', error);
    return [];
  }
}

// 获取Mayer Multiple数据
export async function fetchMayerMultiple(days: number = 1): Promise<any[]> {
  try {
    const response = await fetchWithTimeout(buildApiUrl(`/v1/mayer-multiple/${days}`));
    if (!response.ok) throw new Error('Failed to fetch Mayer Multiple');
    return await response.json();
  } catch (error) {
    console.error('Error fetching Mayer Multiple:', error);
    return [];
  }
}

// 获取所有最新指标数据（带缓存和错误回退）
export async function fetchAllLatestIndicators(useCache = true): Promise<LatestData | null> {
  const now = Date.now();
  if (useCache && cache.data && (now - cache.timestamp) < CACHE_DURATION) {
    console.log('[DataService] Using cached data');
    return cache.data;
  }

  try {
    const [mvrvZData, lthMvrvData, puellData, nuplData, btcPriceData, mayerData] = await Promise.all([
      fetchMvrvZScore(1),
      fetchLthMvrv(1),
      fetchPuellMultiple(1),
      fetchNupl(1),
      fetchBtcPrice(1),
      fetchMayerMultiple(1)
    ]);

    if (!btcPriceData.length) {
      console.warn('[DataService] API fetch failed, falling back to history data');
      const historyData = await fetchHistoricalData();
      if (historyData.length > 0) {
        const latest = getLatestFromHistory(historyData);
        if (latest) {
          cache.data = latest;
          cache.timestamp = now;
        }
        return latest;
      }
      return null;
    }

    const btcPrice = parseFloat(btcPriceData[0].btcPrice);
    const priceDate = btcPriceData[0].d;
    
    const mvrvZ = mvrvZData.length ? parseFloat(mvrvZData[0].mvrvZscore) : 0;
    const mvrvZDate = mvrvZData.length ? mvrvZData[0].d : priceDate;
    
    const lthMvrv = lthMvrvData.length ? parseFloat(lthMvrvData[0].lthMvrv) : 0;
    const lthMvrvDate = lthMvrvData.length ? lthMvrvData[0].d : priceDate;
    
    const puell = puellData.length ? parseFloat(puellData[0].puellMultiple) : 0;
    const puellDate = puellData.length ? puellData[0].d : priceDate;
    
    const nupl = nuplData.length ? parseFloat(nuplData[0].nupl) : 0;
    const nuplDate = nuplData.length ? nuplData[0].d : priceDate;
    
    const mayerMultiple = mayerData.length ? mayerData[0].mayerMultiple : 0;
    
    let priceMa200wRatio = 0;
    let ma200w = 0;
    try {
      const priceHistory = await fetchBtcPrice(1400);
      if (priceHistory.length >= 1400) {
        const prices = priceHistory.map((p: any) => parseFloat(p.btcPrice));
        ma200w = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
        priceMa200wRatio = btcPrice / ma200w;
      } else {
        // 从历史数据取最近有效的 200周MA 值作为 fallback
        const historyData = await fetchHistoricalData();
        const lastWithRatio = [...historyData].reverse().find(d => d.priceMa200wRatio && d.priceMa200wRatio > 0);
        if (lastWithRatio?.priceMa200wRatio && lastWithRatio?.ma200w) {
          ma200w = lastWithRatio.ma200w;
          priceMa200wRatio = btcPrice / ma200w;
        } else if (lastWithRatio?.priceMa200wRatio) {
          // 用历史ratio推算当前ma200w（ma200w变化缓慢，短期内近似有效）
          const histPrice = typeof lastWithRatio.btcPrice === 'string'
            ? parseFloat(lastWithRatio.btcPrice)
            : (lastWithRatio.btcPrice || 0);
          ma200w = histPrice / lastWithRatio.priceMa200wRatio;
          priceMa200wRatio = btcPrice / ma200w;
        }
      }
    } catch (e) {
      // 静默失败，priceMa200wRatio 保持 0，信号不触发
      console.warn('[DataService] Failed to compute priceMa200wRatio:', e);
    }

    const signals = {
      priceMa200w: priceMa200wRatio < 1,
      mvrvZ: mvrvZ < 0,
      lthMvrv: lthMvrv < 1,
      puell: puell < 0.5,
      nupl: nupl < 0
    };

    const signalCount = Object.values(signals).filter(Boolean).length;

    const result: LatestData = {
      date: priceDate,
      btcPrice,
      priceMa200wRatio,
      ma200w,
      mvrvZscore: mvrvZ,
      lthMvrv,
      puellMultiple: puell,
      nupl,
      signalCount,
      signals,
      indicatorDates: {
        priceMa200w: priceDate,
        mvrvZ: mvrvZDate,
        lthMvrv: lthMvrvDate,
        puell: puellDate,
        nupl: nuplDate
      }
    };

    cache.data = result;
    cache.timestamp = now;
    saveLocalData({ latest: result });

    return result;
  } catch (error) {
    console.error('[DataService] Error fetching all indicators:', error);
    return getLocalLatestData();
  }
}

// 将历史数据中的 snake_case 字段规范化为 camelCase
function normalizeIndicatorData(item: any): IndicatorData {
  return {
    d: item.d,
    unixTs: item.unixTs ?? item.unix_ts,
    btcPrice: item.btcPrice ?? item.btc_price,
    priceMa200wRatio: item.priceMa200wRatio ?? item.price_ma200w_ratio,
    ma200w: item.ma200w,
    mvrvZscore: item.mvrvZscore ?? item.mvrv_zscore,
    lthMvrv: item.lthMvrv ?? item.lth_mvrv,
    puellMultiple: item.puellMultiple ?? item.puell_multiple,
    nupl: item.nupl,
    signalPriceMa: item.signalPriceMa ?? item.signal_price_ma,
    signalMvrvZ: item.signalMvrvZ ?? item.signal_mvrv_z,
    signalLthMvrv: item.signalLthMvrv ?? item.signal_lth_mvrv,
    signalPuell: item.signalPuell ?? item.signal_puell,
    signalNupl: item.signalNupl ?? item.signal_nupl,
    signalCount: item.signalCount ?? item.signal_count,
  };
}

// 获取历史数据（用于复盘）
export async function fetchHistoricalData(): Promise<IndicatorData[]> {
  if (cache.history.length > 0) {
    return cache.history;
  }

  try {
    const response = await fetchWithTimeout('/btc_indicators_history.json', 30000);
    if (!response.ok) throw new Error('Failed to fetch historical data');
    const raw = await response.json();
    const data = raw.map(normalizeIndicatorData);
    cache.history = data;
    return data;
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return getLocalData();
  }
}

// 从本地存储获取历史数据
export function getLocalData(): IndicatorData[] {
  const data = localStorage.getItem('btc_indicators_history');
  return data ? JSON.parse(data) : [];
}

// 从本地存储获取最新数据
export function getLocalLatestData(): LatestData | null {
  const data = localStorage.getItem('btc_indicators_latest');
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parsing local latest data:', e);
    }
  }
  const history = getLocalData();
  return getLatestFromHistory(history);
}

// 保存数据到本地存储
export function saveLocalData(data: { history?: IndicatorData[]; latest?: LatestData }) {
  if (data.history) {
    localStorage.setItem('btc_indicators_history', JSON.stringify(data.history));
  }
  if (data.latest) {
    localStorage.setItem('btc_indicators_latest', JSON.stringify(data.latest));
  }
}

// 获取信号事件（历史买入机会）
export function getSignalEvents(data: IndicatorData[], minSignals: number = 4): SignalEvent[] {
  return data
    .filter(d => (d.signalCount || 0) >= minSignals)
    .map(d => ({
      date: d.d,
      btcPrice: Number(d.btcPrice) || 0,
      signalCount: d.signalCount || 0,
      triggeredIndicators: [
        d.signalPriceMa ? 'Price/200W-MA' : '',
        d.signalMvrvZ ? 'MVRV-Z' : '',
        d.signalLthMvrv ? 'LTH-MVRV' : '',
        d.signalPuell ? 'Puell' : '',
        d.signalNupl ? 'NUPL' : ''
      ].filter(Boolean)
    }));
}

// 自动刷新数据（用于 React 组件）
export function startAutoRefresh(
  callback: (data: LatestData) => void,
  interval = REFRESH_INTERVAL
): () => void {
  let isActive = true;
  
  const refresh = async () => {
    if (!isActive) return;
    
    try {
      const data = await fetchAllLatestIndicators(false);
      if (data && isActive) {
        callback(data);
      }
    } catch (error) {
      console.error('[DataService] Auto refresh error:', error);
    }
  };

  refresh();
  const timer = setInterval(refresh, interval);
  
  return () => {
    isActive = false;
    clearInterval(timer);
  };
}

// 检查数据源可用性
export async function checkDataSource(): Promise<{
  apiAvailable: boolean;
  proxyAvailable: boolean;
  historyAvailable: boolean;
  localAvailable: boolean;
}> {
  const result = {
    apiAvailable: false,
    proxyAvailable: false,
    historyAvailable: false,
    localAvailable: false
  };

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/v1/btc-price/1`, 5000);
    result.apiAvailable = response.ok;
  } catch (e) {
    result.apiAvailable = false;
  }

  if (PROXY_URL) {
    try {
      const response = await fetchWithTimeout(`${PROXY_URL}/v1/btc-price/1`, 5000);
      result.proxyAvailable = response.ok;
    } catch (e) {
      result.proxyAvailable = false;
    }
  }

  try {
    const response = await fetchWithTimeout('/btc_indicators_history.json', 5000);
    result.historyAvailable = response.ok;
  } catch (e) {
    result.historyAvailable = false;
  }

  result.localAvailable = !!getLocalLatestData();

  return result;
}

// 获取数据状态信息（用于调试）
export function getDataStatus(): {
  cacheAge: number;
  cacheValid: boolean;
  lastUpdate: string | null;
} {
  const now = Date.now();
  const cacheAge = now - cache.timestamp;
  
  return {
    cacheAge: Math.floor(cacheAge / 1000),
    cacheValid: cache.data !== null && cacheAge < CACHE_DURATION,
    lastUpdate: cache.data?.date || null
  };
}

// ============ 历史数据图表相关函数 ============

// 时间范围对应的毫秒数
const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  '6m': 180 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
  'all': Infinity
};

// 根据时间范围过滤数据
export function filterDataByTimeRange(data: IndicatorData[], range: TimeRange): IndicatorData[] {
  if (range === 'all') return data;
  
  const cutoffTime = Date.now() - TIME_RANGE_MS[range];
  return data.filter(item => {
    const itemTime = new Date(item.d).getTime();
    return itemTime >= cutoffTime;
  });
}

// 获取指标图表数据
export function getIndicatorChartData(
  data: IndicatorData[],
  indicator: 'priceMa200w' | 'mvrvZ' | 'lthMvrv' | 'puell' | 'nupl',
  range: TimeRange
): ChartDataPoint[] {
  const filteredData = filterDataByTimeRange(data, range);

  return filteredData
    .map(item => {
      let value: number | null = null;
      let signal = false;

      switch (indicator) {
        case 'priceMa200w':
          value = item.priceMa200wRatio ?? null;
          signal = item.signalPriceMa || false;
          break;
        case 'mvrvZ':
          value = item.mvrvZscore ?? null;
          signal = item.signalMvrvZ || false;
          break;
        case 'lthMvrv':
          value = item.lthMvrv ?? null;
          signal = item.signalLthMvrv || false;
          break;
        case 'puell':
          value = item.puellMultiple ?? null;
          signal = item.signalPuell || false;
          break;
        case 'nupl':
          value = item.nupl ?? null;
          signal = item.signalNupl || false;
          break;
        default:
          value = null;
      }

      if (value === null) return null;

      const btcPrice = typeof item.btcPrice === 'string' ? parseFloat(item.btcPrice) : item.btcPrice;
      // 过滤掉占位数据：指标值为0且BTC价格也为0或缺失的记录
      if (value === 0 && (!btcPrice || btcPrice === 0)) return null;

      return {
        date: item.d,
        value,
        btcPrice,
        signal
      };
    })
    .filter((item): item is ChartDataPoint => item !== null);
}

// 获取MA200图表数据（价格和均线）
export function getMA200ChartData(
  data: IndicatorData[], 
  range: TimeRange
): { date: string; price: number; ma200: number; signal: boolean }[] {
  const filteredData = filterDataByTimeRange(data, range);
  
  return filteredData
    .filter(item => item.btcPrice && (item.ma200w || item.priceMa200wRatio))
    .map(item => {
      const price = typeof item.btcPrice === 'string'
        ? parseFloat(item.btcPrice)
        : (item.btcPrice || 0);

      let ma200 = item.ma200w;
      if (!ma200 && item.priceMa200wRatio && item.priceMa200wRatio > 0) {
        ma200 = price / item.priceMa200wRatio;
      }

      return {
        date: item.d,
        price,
        ma200: ma200 || 0,
        signal: item.signalPriceMa || false
      };
    });
}

// 指标配置信息
export const INDICATOR_CONFIG = {
  priceMa200w: {
    name: 'BTC Price / 200W-MA',
    unit: '',
    targetValue: 1,
    color: '#F7931A',
    description: '价格与200周均线比值'
  },
  mvrvZ: {
    name: 'MVRV Z-Score',
    unit: '',
    targetValue: 0,
    color: '#3B82F6',
    description: '市值与实现市值标准化比值'
  },
  lthMvrv: {
    name: 'LTH-MVRV',
    unit: '',
    targetValue: 1,
    color: '#10B981',
    description: '长期持有者成本比值'
  },
  puell: {
    name: 'Puell Multiple',
    unit: '',
    targetValue: 0.5,
    color: '#8B5CF6',
    description: '矿工收入比值'
  },
  nupl: {
    name: 'NUPL',
    unit: '',
    targetValue: 0,
    color: '#EF4444',
    description: '净未实现利润/亏损'
  }
};

// 时间范围标签
export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1w': '近一周',
  '1m': '近一月',
  '6m': '近半年',
  '1y': '近一年',
  'all': '全部历史'
};
