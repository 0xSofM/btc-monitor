import type { IndicatorData, LatestData, SignalEvent, TimeRange, ChartDataPoint } from '@/types';

// API 配置
const API_BASE_URL = 'https://bitcoin-data.com';
const STATIC_HISTORY_PATH = '/btc_indicators_history.json';
const STATIC_LATEST_PATH = '/btc_indicators_latest.json';

// 代理配置（用于解决 CORS 问题）
const DEFAULT_PROXY_URL = import.meta.env.PROD ? '/api/btc-data' : '';
const PROXY_URL = import.meta.env.VITE_API_PROXY_URL || DEFAULT_PROXY_URL;

// 数据刷新配置
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5分钟刷新一次（毫秒）
const CACHE_DURATION = 60 * 1000; // 本地缓存1分钟
const MA200W_LOOKBACK_DAYS = 1400;

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
// 策略：
// 1. 优先使用 apiDataDate 字段（记录 API 实际返回数据的日期）
// 2. 如果没有 apiDataDate，从后向前查找最后一个有有效值的日期
// 3. 如果某个指标从未有过有效值，则返回 undefined
function findIndicatorDates(data: IndicatorData[]) {
  const latest = data[data.length - 1];
  if (!latest) {
    return {
      priceMa200w: undefined,
      mvrvZ: undefined,
      lthMvrv: undefined,
      puell: undefined,
      nupl: undefined
    };
  }

  // 初始化为 undefined，表示尚未找到有效值
  const dates: NonNullable<LatestData['indicatorDates']> = {
    priceMa200w: latest.d, // priceMa200w 始终使用最新日期（因为它是根据价格计算的）
    mvrvZ: undefined,
    lthMvrv: undefined,
    puell: undefined,
    nupl: undefined
  };

  // 首先检查是否有 apiDataDate 字段（记录 API 实际返回数据的日期）
  const apiDates = (latest as any).apiDataDate || (latest as any).api_data_date;
  if (apiDates && typeof apiDates === 'object') {
    // 只添加 apiDataDate 中存在的指标
    if (apiDates.mvrvZ) dates.mvrvZ = apiDates.mvrvZ;
    if (apiDates.lthMvrv) dates.lthMvrv = apiDates.lthMvrv;
    if (apiDates.puell) dates.puell = apiDates.puell;
    if (apiDates.nupl) dates.nupl = apiDates.nupl;
    return dates;
  }

  // 如果没有 apiDataDate，从后向前查找每个指标最后一个有有效值的日期
  for (let i = data.length - 1; i >= 0; i--) {
    const record = data[i];
    // MVRV: 查找最后一个有 mvrvZscore 值的日期
    if (dates.mvrvZ === undefined && record.mvrvZscore !== null && record.mvrvZscore !== undefined && record.mvrvZscore !== 0) {
      dates.mvrvZ = record.d;
    }
    // LTH-MVRV: 查找最后一个有 lthMvrv 值的日期
    if (dates.lthMvrv === undefined && record.lthMvrv !== null && record.lthMvrv !== undefined && record.lthMvrv !== 0) {
      dates.lthMvrv = record.d;
    }
    // Puell: 查找最后一个有 puellMultiple 值的日期
    if (dates.puell === undefined && record.puellMultiple !== null && record.puellMultiple !== undefined && record.puellMultiple !== 0) {
      dates.puell = record.d;
    }
    // NUPL: 查找最后一个有 nupl 值的日期
    if (dates.nupl === undefined && record.nupl !== null && record.nupl !== undefined && record.nupl !== 0) {
      dates.nupl = record.d;
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

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
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

function getMa200wFromHistory(data: IndicatorData[]): number | null {
  const lastWithMa200w = [...data].reverse().find((item) => {
    if (item.ma200w && item.ma200w > 0) {
      return true;
    }

    if (!item.priceMa200wRatio || item.priceMa200wRatio <= 0) {
      return false;
    }

    const price = typeof item.btcPrice === 'string'
      ? parseFloat(item.btcPrice)
      : item.btcPrice;

    return typeof price === 'number' && price > 0;
  });

  if (!lastWithMa200w) {
    return null;
  }

  if (lastWithMa200w.ma200w && lastWithMa200w.ma200w > 0) {
    return lastWithMa200w.ma200w;
  }

  const price = typeof lastWithMa200w.btcPrice === 'string'
    ? parseFloat(lastWithMa200w.btcPrice)
    : lastWithMa200w.btcPrice;

  if (!price || !lastWithMa200w.priceMa200wRatio) {
    return null;
  }

  return price / lastWithMa200w.priceMa200wRatio;
}

function enrichLatestDataWithHistory(latest: LatestData, history: IndicatorData[]): LatestData {
  if (!history.length) {
    return latest;
  }

  // 优先使用静态 JSON 中已有的 indicatorDates，如果没有则从历史数据计算
  const indicatorDates = latest.indicatorDates || findIndicatorDates(history);

  return {
    ...latest,
    indicatorDates,
  };
}

async function resolveLatestMa200w(): Promise<number | null> {
  if (cache.data?.ma200w && cache.data.ma200w > 0) {
    return cache.data.ma200w;
  }

  const staticLatest = await fetchStaticLatestData();
  if (staticLatest?.ma200w && staticLatest.ma200w > 0) {
    return staticLatest.ma200w;
  }

  const historyData = await fetchHistoricalData();
  return getMa200wFromHistory(historyData);
}

// 获取所有最新指标数据（带缓存和错误回退）
export async function fetchAllLatestIndicators(useCache = true): Promise<LatestData | null> {
  const now = Date.now();
  if (useCache && cache.data && (now - cache.timestamp) < CACHE_DURATION) {
    console.log('[DataService] Using cached data');
    return cache.data;
  }

  try {
    const [mvrvZData, lthMvrvData, puellData, nuplData, btcPriceData] = await Promise.all([
      fetchMvrvZScore(1),
      fetchLthMvrv(1),
      fetchPuellMultiple(1),
      fetchNupl(1),
      fetchBtcPrice(1)
    ]);

    if (!btcPriceData.length) {
      console.warn('[DataService] API fetch failed, falling back to static latest data');
      const staticLatest = await fetchStaticLatestData();
      if (staticLatest) {
        return staticLatest;
      }

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
    
    let priceMa200wRatio = 0;
    let ma200w = 0;
    try {
      const resolvedMa200w = await resolveLatestMa200w();
      if (resolvedMa200w && resolvedMa200w > 0) {
        ma200w = resolvedMa200w;
        priceMa200wRatio = btcPrice / ma200w;
      } else {
        const priceHistory = await fetchBtcPrice(MA200W_LOOKBACK_DAYS);
        if (priceHistory.length >= MA200W_LOOKBACK_DAYS) {
          const prices = priceHistory.map((p: any) => parseFloat(p.btcPrice));
          ma200w = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
          priceMa200wRatio = btcPrice / ma200w;
        } else {
          const historyData = await fetchHistoricalData();
          const historyMa200w = getMa200wFromHistory(historyData);
          if (historyMa200w && historyMa200w > 0) {
            ma200w = historyMa200w;
            priceMa200wRatio = btcPrice / ma200w;
          }
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
    const staticLatest = await fetchStaticLatestData();
    return staticLatest ?? getLocalLatestData();
  }
}

// 将历史数据中的 snake_case 字段规范化为 camelCase
function normalizeIndicatorData(item: any): IndicatorData {
  if (!item || typeof item !== 'object') {
    return item;
  }

  // 处理 apiDataDate 字段（支持 snake_case 和 camelCase）
  const apiDataDate = item.apiDataDate || item.api_data_date;
  const indicatorDates = apiDataDate ? {
    mvrvZ: apiDataDate.mvrvZ || apiDataDate.mvrv_z,
    lthMvrv: apiDataDate.lthMvrv || apiDataDate.lth_mvrv,
    puell: apiDataDate.puell,
    nupl: apiDataDate.nupl
  } : undefined;

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
    // 保留 apiDataDate 字段用于数据日期追踪
    apiDataDate: indicatorDates,
  } as IndicatorData;
}

function normalizeLatestData(item: any): LatestData | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const date = item.date ?? item.d;
  if (!date) {
    return null;
  }

  // 使用 null 作为缺失值的表示，而非 0
  const btcPrice = item.btcPrice ?? item.btc_price ?? null;
  const priceMa200wRatio = item.priceMa200wRatio ?? item.price_ma200w_ratio ?? null;
  const ma200w = item.ma200w === undefined || item.ma200w === null
    ? undefined
    : toNumber(item.ma200w);
  const mvrvZscore = item.mvrvZscore ?? item.mvrv_zscore ?? null;
  const lthMvrv = item.lthMvrv ?? item.lth_mvrv ?? null;
  const puellMultiple = item.puellMultiple ?? item.puell_multiple ?? null;
  const nupl = item.nupl ?? null;

  // 转换为数字或保持 null
  const toNumberOrNull = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    const num = toNumber(val, NaN);
    return Number.isNaN(num) ? null : num;
  };

  const btcPriceNum = toNumberOrNull(btcPrice);
  const priceMa200wRatioNum = toNumberOrNull(priceMa200wRatio);
  const mvrvZscoreNum = toNumberOrNull(mvrvZscore);
  const lthMvrvNum = toNumberOrNull(lthMvrv);
  const puellMultipleNum = toNumberOrNull(puellMultiple);
  const nuplNum = toNumberOrNull(nupl);

  // 处理 indicatorDates（支持 apiDataDate 和 indicatorDates 两种格式）
  const apiDataDate = item.apiDataDate || item.api_data_date;
  const incomingIndicatorDates = item.indicatorDates || apiDataDate;
  
  const indicatorDates: LatestData['indicatorDates'] = {
    priceMa200w: incomingIndicatorDates?.priceMa200w || date,
    mvrvZ: incomingIndicatorDates?.mvrvZ || incomingIndicatorDates?.mvrv_z || date,
    lthMvrv: incomingIndicatorDates?.lthMvrv || incomingIndicatorDates?.lth_mvrv || date,
    puell: incomingIndicatorDates?.puell || date,
    nupl: incomingIndicatorDates?.nupl || date,
  };

  // 支持 _signal 后缀格式（如 price_200w_ma_signal, lth_mvrv_signal 等）
  const priceMa200wSignal = item.price_200w_ma_signal ?? item.signalPriceMa ?? item.signal_price_ma;
  const mvrvZSignal = item.mvrv_zscore_signal ?? item.signalMvrvZ ?? item.signal_mvrv_z;
  const lthMvrvSignal = item.lth_mvrv_signal ?? item.signalLthMvrv ?? item.signal_lth_mvrv;
  const puellSignal = item.puell_multiple_signal ?? item.signalPuell ?? item.signal_puell;
  const nuplSignal = item.nupl_signal ?? item.signalNupl ?? item.signal_nupl;

  const signals = {
    priceMa200w: priceMa200wSignal !== undefined && priceMa200wSignal !== null
      ? Boolean(priceMa200wSignal)
      : (priceMa200wRatioNum !== null && priceMa200wRatioNum < 1),
    mvrvZ: mvrvZSignal !== undefined && mvrvZSignal !== null
      ? Boolean(mvrvZSignal)
      : (mvrvZscoreNum !== null && mvrvZscoreNum < 0),
    lthMvrv: lthMvrvSignal !== undefined && lthMvrvSignal !== null
      ? Boolean(lthMvrvSignal)
      : (lthMvrvNum !== null && lthMvrvNum < 1),
    puell: puellSignal !== undefined && puellSignal !== null
      ? Boolean(puellSignal)
      : (puellMultipleNum !== null && puellMultipleNum < 0.5),
    nupl: nuplSignal !== undefined && nuplSignal !== null
      ? Boolean(nuplSignal)
      : (nuplNum !== null && nuplNum < 0)
  };

  const signalCountValue = item.signalCount ?? item.signal_count;
  const signalCount = signalCountValue === undefined || signalCountValue === null
    ? Object.values(signals).filter(Boolean).length
    : toNumber(signalCountValue);

  return {
    date,
    btcPrice: btcPriceNum ?? 0,
    priceMa200wRatio: priceMa200wRatioNum ?? 0,
    ma200w,
    mvrvZscore: mvrvZscoreNum ?? 0,
    lthMvrv: lthMvrvNum ?? 0,
    puellMultiple: puellMultipleNum ?? 0,
    nupl: nuplNum ?? 0,
    signalCount,
    signals,
    indicatorDates
  };
}

export async function fetchStaticLatestData(): Promise<LatestData | null> {
  try {
    const response = await fetchWithTimeout(STATIC_LATEST_PATH, 10000);
    if (!response.ok) throw new Error('Failed to fetch latest static data');

    const raw = await response.json();
    let data = normalizeLatestData(raw);
    if (!data) {
      throw new Error('Invalid latest static data format');
    }

    const history = cache.history.length > 0 ? cache.history : await fetchHistoricalData();
    data = enrichLatestDataWithHistory(data, history);

    cache.data = data;
    cache.timestamp = Date.now();
    saveLocalData({ latest: data });
    return data;
  } catch (error) {
    console.error('Error fetching latest static data:', error);
    return getLocalLatestData();
  }
}

// 获取历史数据（用于复盘）
export async function fetchHistoricalData(): Promise<IndicatorData[]> {
  if (cache.history.length > 0) {
    return cache.history;
  }

  try {
    const response = await fetchWithTimeout(STATIC_HISTORY_PATH, 30000);
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

// 数据版本标识，用于检测数据结构变更
const DATA_VERSION = 'v1.0.0';

// 从本地存储获取历史数据
export function getLocalData(): IndicatorData[] {
  try {
    const data = localStorage.getItem('btc_indicators_history');
    if (!data) return [];
    const parsed = JSON.parse(data);
    
    // 支持两种格式：
    // 1. 新格式：{ version, timestamp, data: [...] }
    // 2. 旧格式：直接数组 [...]
    let historyArray: any[];
    if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray(parsed.data)) {
      // 新格式：从 data 字段提取数组
      historyArray = parsed.data;
    } else if (Array.isArray(parsed)) {
      // 旧格式：直接使用数组
      historyArray = parsed;
    } else {
      console.warn('[DataService] Invalid local history data format');
      return [];
    }
    
    return historyArray.map(item => normalizeIndicatorData(item));
  } catch (e) {
    console.error('Error parsing local history data:', e);
    return [];
  }
}

// 从本地存储获取最新数据
export function getLocalLatestData(): LatestData | null {
  try {
    const data = localStorage.getItem('btc_indicators_latest');
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') return null;
    
    // 支持两种格式：
    // 1. 新格式：{ version, timestamp, data: {...} }
    // 2. 旧格式：直接对象 {...}
    let latestObj: any;
    if ('data' in parsed && parsed.data && typeof parsed.data === 'object') {
      // 新格式：从 data 字段提取对象
      latestObj = parsed.data;
    } else {
      // 旧格式：直接使用对象（排除 version/timestamp 等包装字段）
      latestObj = parsed;
    }
    
    // 使用 normalizeLatestData 确保格式一致
    const normalized = normalizeLatestData(latestObj);
    if (normalized) {
      return enrichLatestDataWithHistory(normalized, getLocalData());
    }
    return null;
  } catch (e) {
    console.error('Error parsing local latest data:', e);
    return null;
  }
}

// 保存数据到本地存储（带版本标识）
export function saveLocalData(data: { history?: IndicatorData[]; latest?: LatestData }) {
  try {
    if (data.history) {
      const historyWithVersion = {
        version: DATA_VERSION,
        timestamp: Date.now(),
        data: data.history
      };
      localStorage.setItem('btc_indicators_history', JSON.stringify(historyWithVersion));
    }
    if (data.latest) {
      const latestWithVersion = {
        version: DATA_VERSION,
        timestamp: Date.now(),
        data: data.latest
      };
      localStorage.setItem('btc_indicators_latest', JSON.stringify(latestWithVersion));
    }
  } catch (e) {
    console.error('Error saving local data:', e);
  }
}

// 验证本地数据与展示数据的一致性
export function validateLocalDataConsistency(): {
  historyValid: boolean;
  latestValid: boolean;
  needsSync: boolean;
} {
  const historyValid = Array.isArray(getLocalData());
  const latestData = getLocalLatestData();
  const latestValid = latestData !== null;

  // 检查历史数据和最新数据是否同步
  const history = getLocalData();
  let needsSync = false;

  if (history.length > 0 && latestData) {
    const lastHistoryDate = history[history.length - 1]?.d;
    const latestDate = latestData.date;
    needsSync = lastHistoryDate !== latestDate;
  }

  return {
    historyValid,
    latestValid,
    needsSync
  };
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
    const response = await fetchWithTimeout(STATIC_HISTORY_PATH, 5000);
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
    .map((item): ChartDataPoint | null => {
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
        btcPrice: typeof btcPrice === 'number' ? btcPrice : undefined,
        signal
      };
    })
    .filter(isChartDataPoint);
}

function isChartDataPoint(item: ChartDataPoint | null): item is ChartDataPoint {
  return item !== null;
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
