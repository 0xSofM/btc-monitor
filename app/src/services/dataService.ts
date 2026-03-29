/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IndicatorData, LatestData, SignalEvent, TimeRange, ChartDataPoint } from '@/types';

type ApiDatePayload = {
  priceMa200w?: string;
  price_ma200w?: string;
  mvrvZ?: string;
  mvrv_z?: string;
  lthMvrv?: string;
  lth_mvrv?: string;
  puell?: string;
  nupl?: string;
};

type ApiMetricPoint = {
  d?: string;
  btcPrice?: string | number;
  mvrvZscore?: string | number;
  lthMvrv?: string | number;
  puellMultiple?: string | number;
  nupl?: string | number;
};

type IndicatorDataWithApiDate = IndicatorData & {
  apiDataDate?: ApiDatePayload;
  api_data_date?: ApiDatePayload;
};

type HistoryMode = 'light' | 'full';

type FetchHistoricalOptions = {
  mode?: HistoryMode;
  forceRefresh?: boolean;
};

// API 閰嶇疆
const API_BASE_URL = 'https://bitcoin-data.com';
const STATIC_HISTORY_LIGHT_PATH = '/btc_indicators_history_light.json';
const STATIC_HISTORY_FULL_PATH = '/btc_indicators_history.json';
const STATIC_LATEST_PATH = '/btc_indicators_latest.json';

// 浠ｇ悊閰嶇疆锛堢敤浜庤В鍐?CORS 闂锛?
const DEFAULT_PROXY_URL = import.meta.env.PROD ? '/api/btc-data' : '';
const PROXY_URL = import.meta.env.VITE_API_PROXY_URL || DEFAULT_PROXY_URL;

// 鏁版嵁鍒锋柊閰嶇疆
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5鍒嗛挓鍒锋柊涓€娆★紙姣锛?
const CACHE_DURATION = 60 * 1000; // 鏈湴缂撳瓨1鍒嗛挓
const MA200W_LOOKBACK_DAYS = 1400;

// 鍐呭瓨缂撳瓨
const cache: {
  data: LatestData | null;
  history: IndicatorData[];
  historyFull: IndicatorData[];
  timestamp: number;
} = {
  data: null,
  history: [],
  historyFull: [],
  timestamp: 0
};

// 浠庡巻鍙叉暟鎹腑鎻愬彇鏈€鏂版暟鎹?
export function getLatestFromHistory(data: IndicatorData[]): LatestData | null {
  if (!data || data.length === 0) return null;
  
  // 鑾峰彇鏈€鍚庝竴鏉℃暟鎹?
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
  
  // 鑾峰彇鍚勬寚鏍囩殑瀹為檯鏁版嵁鏃ユ湡
  // 鐢变簬鏁版嵁鍙兘缁忚繃鍚戝墠濉厖锛岄渶瑕佹煡鎵炬瘡涓寚鏍囨渶鍚庝竴娆″疄闄呮洿鏂扮殑鏃ユ湡
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

function hasUsableValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'number') {
    return !Number.isNaN(value);
  }

  return true;
}

// 鏌ユ壘鍚勬寚鏍囩殑鏈€鍚庢湁鏁堟暟鎹棩鏈?
// 绛栫暐锛?
// 1. 浼樺厛浣跨敤 apiDataDate 瀛楁锛堣褰?API 瀹為檯杩斿洖鏁版嵁鐨勬棩鏈燂級
// 2. 濡傛灉娌℃湁 apiDataDate锛屼粠鍚庡悜鍓嶆煡鎵炬渶鍚庝竴涓湁鏈夋晥鍊肩殑鏃ユ湡
// 3. 濡傛灉鏌愪釜鎸囨爣浠庢湭鏈夎繃鏈夋晥鍊硷紝鍒欒繑鍥?undefined
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

  // 鍒濆鍖栦负 undefined锛岃〃绀哄皻鏈壘鍒版湁鏁堝€?
  const dates: NonNullable<LatestData['indicatorDates']> = {
    priceMa200w: latest.d, // priceMa200w 濮嬬粓浣跨敤鏈€鏂版棩鏈燂紙鍥犱负瀹冩槸鏍规嵁浠锋牸璁＄畻鐨勶級
    mvrvZ: undefined,
    lthMvrv: undefined,
    puell: undefined,
    nupl: undefined
  };

  // 棣栧厛妫€鏌ユ槸鍚︽湁 apiDataDate 瀛楁锛堣褰?API 瀹為檯杩斿洖鏁版嵁鐨勬棩鏈燂級
  const latestWithApi = latest as IndicatorDataWithApiDate;
  const apiDates = latestWithApi.apiDataDate || latestWithApi.api_data_date;
  if (apiDates && typeof apiDates === 'object') {
    // 鍙坊鍔?apiDataDate 涓瓨鍦ㄧ殑鎸囨爣
    if (apiDates.mvrvZ || apiDates.mvrv_z) dates.mvrvZ = apiDates.mvrvZ || apiDates.mvrv_z;
    if (apiDates.lthMvrv || apiDates.lth_mvrv) dates.lthMvrv = apiDates.lthMvrv || apiDates.lth_mvrv;
    if (apiDates.puell) dates.puell = apiDates.puell;
    if (apiDates.nupl) dates.nupl = apiDates.nupl;
    return dates;
  }

  // 濡傛灉娌℃湁 apiDataDate锛屼粠鍚庡悜鍓嶆煡鎵炬瘡涓寚鏍囨渶鍚庝竴涓湁鏈夋晥鍊肩殑鏃ユ湡
  for (let i = data.length - 1; i >= 0; i--) {
    const record = data[i];
    // MVRV: 鏌ユ壘鏈€鍚庝竴涓湁 mvrvZscore 鍊肩殑鏃ユ湡
    if (dates.mvrvZ === undefined && hasUsableValue(record.mvrvZscore)) {
      dates.mvrvZ = record.d;
    }
    // LTH-MVRV: 鏌ユ壘鏈€鍚庝竴涓湁 lthMvrv 鍊肩殑鏃ユ湡
    if (dates.lthMvrv === undefined && hasUsableValue(record.lthMvrv)) {
      dates.lthMvrv = record.d;
    }
    // Puell: 鏌ユ壘鏈€鍚庝竴涓湁 puellMultiple 鍊肩殑鏃ユ湡
    if (dates.puell === undefined && hasUsableValue(record.puellMultiple)) {
      dates.puell = record.d;
    }
    // NUPL: 鏌ユ壘鏈€鍚庝竴涓湁 nupl 鍊肩殑鏃ユ湡
    if (dates.nupl === undefined && hasUsableValue(record.nupl)) {
      dates.nupl = record.d;
    }
  }

  return dates;
}

// 鏋勫缓 API URL锛堟敮鎸佷唬鐞嗭級
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


// 甯﹁秴鏃剁殑 fetch
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

async function fetchMetricSeries(endpoint: string, metricName: string): Promise<ApiMetricPoint[]> {
  try {
    const response = await fetchWithTimeout(buildApiUrl(endpoint));
    if (!response.ok) throw new Error(`Failed to fetch ${metricName}`);
    const payload = await response.json();
    return Array.isArray(payload) ? (payload as ApiMetricPoint[]) : [];
  } catch (error) {
    console.error(`Error fetching ${metricName}:`, error);
    return [];
  }
}

// 鑾峰彇MVRV Z-Score鏁版嵁
export async function fetchMvrvZScore(days: number = 1): Promise<ApiMetricPoint[]> {
  return fetchMetricSeries(`/v1/mvrv-zscore/${days}`, 'MVRV Z-Score');
}

// 鑾峰彇LTH-MVRV鏁版嵁
export async function fetchLthMvrv(days: number = 1): Promise<ApiMetricPoint[]> {
  return fetchMetricSeries(`/v1/lth-mvrv/${days}`, 'LTH-MVRV');
}

// 鑾峰彇Puell Multiple鏁版嵁
export async function fetchPuellMultiple(days: number = 1): Promise<ApiMetricPoint[]> {
  return fetchMetricSeries(`/v1/puell-multiple/${days}`, 'Puell Multiple');
}

// 鑾峰彇NUPL鏁版嵁
export async function fetchNupl(days: number = 1): Promise<ApiMetricPoint[]> {
  return fetchMetricSeries(`/v1/nupl/${days}`, 'NUPL');
}

// 鑾峰彇BTC浠锋牸鏁版嵁
export async function fetchBtcPrice(days: number = 1): Promise<ApiMetricPoint[]> {
  return fetchMetricSeries(`/v1/btc-price/${days}`, 'BTC Price');
}

// 鑾峰彇Mayer Multiple鏁版嵁
export async function fetchMayerMultiple(days: number = 1): Promise<ApiMetricPoint[]> {
  return fetchMetricSeries(`/v1/mayer-multiple/${days}`, 'Mayer Multiple');
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

  // 浼樺厛浣跨敤闈欐€?JSON 涓凡鏈夌殑 indicatorDates锛屽鏋滄病鏈夊垯浠庡巻鍙叉暟鎹绠?
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

// 鑾峰彇鎵€鏈夋渶鏂版寚鏍囨暟鎹紙甯︾紦瀛樺拰閿欒鍥為€€锛?
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

    const btcPrice = toNumber(btcPriceData[0].btcPrice, 0);
    const priceDate = String(btcPriceData[0].d ?? new Date().toISOString().split('T')[0]);
    
    const mvrvZ = mvrvZData.length ? toNumber(mvrvZData[0].mvrvZscore, 0) : 0;
    const mvrvZDate = mvrvZData.length ? String(mvrvZData[0].d ?? priceDate) : priceDate;
    
    const lthMvrv = lthMvrvData.length ? toNumber(lthMvrvData[0].lthMvrv, 0) : 0;
    const lthMvrvDate = lthMvrvData.length ? String(lthMvrvData[0].d ?? priceDate) : priceDate;
    
    const puell = puellData.length ? toNumber(puellData[0].puellMultiple, 0) : 0;
    const puellDate = puellData.length ? String(puellData[0].d ?? priceDate) : priceDate;
    
    const nupl = nuplData.length ? toNumber(nuplData[0].nupl, 0) : 0;
    const nuplDate = nuplData.length ? String(nuplData[0].d ?? priceDate) : priceDate;
    
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
          const prices = priceHistory.map((p: ApiMetricPoint) => parseFloat(String(p.btcPrice ?? 0)));
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
      // 闈欓粯澶辫触锛宲riceMa200wRatio 淇濇寔 0锛屼俊鍙蜂笉瑙﹀彂
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

// 灏嗗巻鍙叉暟鎹腑鐨?snake_case 瀛楁瑙勮寖鍖栦负 camelCase
function normalizeIndicatorData(item: any): IndicatorData {
  if (!item || typeof item !== 'object') {
    return item;
  }

  // 澶勭悊 apiDataDate 瀛楁锛堟敮鎸?snake_case 鍜?camelCase锛?
  const apiDataDate = item.apiDataDate || item.api_data_date;
  const indicatorDates = apiDataDate ? {
    priceMa200w: apiDataDate.priceMa200w || apiDataDate.price_ma200w,
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
    // 淇濈暀 apiDataDate 瀛楁鐢ㄤ簬鏁版嵁鏃ユ湡杩借釜
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

  // 浣跨敤 null 浣滀负缂哄け鍊肩殑琛ㄧず锛岃€岄潪 0
  const btcPrice = item.btcPrice ?? item.btc_price ?? null;
  const priceMa200wRatio = item.priceMa200wRatio ?? item.price_ma200w_ratio ?? null;
  const ma200w = item.ma200w === undefined || item.ma200w === null
    ? undefined
    : toNumber(item.ma200w);
  const mvrvZscore = item.mvrvZscore ?? item.mvrv_zscore ?? null;
  const lthMvrv = item.lthMvrv ?? item.lth_mvrv ?? null;
  const puellMultiple = item.puellMultiple ?? item.puell_multiple ?? null;
  const nupl = item.nupl ?? null;

  // 杞崲涓烘暟瀛楁垨淇濇寔 null
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

  // 澶勭悊 indicatorDates锛堟敮鎸?apiDataDate 鍜?indicatorDates 涓ょ鏍煎紡锛?
  const apiDataDate = item.apiDataDate || item.api_data_date;
  const incomingIndicatorDates = item.indicatorDates || apiDataDate;
  
  const indicatorDates: LatestData['indicatorDates'] = {
    priceMa200w: incomingIndicatorDates?.priceMa200w || date,
    mvrvZ: incomingIndicatorDates?.mvrvZ || incomingIndicatorDates?.mvrv_z || date,
    lthMvrv: incomingIndicatorDates?.lthMvrv || incomingIndicatorDates?.lth_mvrv || date,
    puell: incomingIndicatorDates?.puell || date,
    nupl: incomingIndicatorDates?.nupl || date,
  };

  // 鏀寔 _signal 鍚庣紑鏍煎紡锛堝 price_200w_ma_signal, lth_mvrv_signal 绛夛級
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

    const history = cache.history.length > 0
      ? cache.history
      : (cache.historyFull.length > 0 ? cache.historyFull : await fetchHistoricalData());
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

async function fetchStaticHistoryByPath(path: string, timeout: number): Promise<IndicatorData[]> {
  const response = await fetchWithTimeout(path, timeout);
  if (!response.ok) {
    throw new Error(`Failed to fetch historical data from ${path}`);
  }

  const raw = await response.json();
  if (!Array.isArray(raw)) {
    throw new Error(`Invalid historical data format from ${path}`);
  }

  return raw.map(normalizeIndicatorData);
}

// 鑾峰彇鍘嗗彶鏁版嵁锛堢敤浜庡鐩橈級
export async function fetchHistoricalData(options: FetchHistoricalOptions = {}): Promise<IndicatorData[]> {
  const mode: HistoryMode = options.mode ?? 'light';
  const forceRefresh = options.forceRefresh ?? false;
  const cacheKey = mode === 'full' ? 'historyFull' : 'history';

  if (!forceRefresh && cache[cacheKey].length > 0) {
    return cache[cacheKey];
  }

  const primaryPath = mode === 'full' ? STATIC_HISTORY_FULL_PATH : STATIC_HISTORY_LIGHT_PATH;
  const fallbackPath = mode === 'full' ? STATIC_HISTORY_LIGHT_PATH : STATIC_HISTORY_FULL_PATH;

  try {
    const data = await fetchStaticHistoryByPath(primaryPath, 30000);
    cache[cacheKey] = data;
    if (mode === 'full' && cache.history.length === 0) {
      cache.history = data;
    }
    return data;
  } catch (primaryError) {
    console.warn(`[DataService] Primary history source failed (${primaryPath}), trying fallback (${fallbackPath}).`, primaryError);
    try {
      const fallbackData = await fetchStaticHistoryByPath(fallbackPath, 30000);
      cache[cacheKey] = fallbackData;
      if (mode === 'full' && cache.history.length === 0) {
        cache.history = fallbackData;
      }
      return fallbackData;
    } catch (fallbackError) {
      console.error('Error fetching historical data:', fallbackError);
      const local = getLocalData();
      if (local.length > 0) {
        cache[cacheKey] = local;
      }
      return local;
    }
  }
}

export async function fetchFullHistoricalData(forceRefresh = false): Promise<IndicatorData[]> {
  return fetchHistoricalData({ mode: 'full', forceRefresh });
}

// 鏁版嵁鐗堟湰鏍囪瘑锛岀敤浜庢娴嬫暟鎹粨鏋勫彉鏇?
const DATA_VERSION = 'v1.0.0';

// 浠庢湰鍦板瓨鍌ㄨ幏鍙栧巻鍙叉暟鎹?
export function getLocalData(): IndicatorData[] {
  try {
    const data = localStorage.getItem('btc_indicators_history');
    if (!data) return [];
    const parsed = JSON.parse(data);
    
    // 鏀寔涓ょ鏍煎紡锛?
    // 1. 鏂版牸寮忥細{ version, timestamp, data: [...] }
    // 2. 鏃ф牸寮忥細鐩存帴鏁扮粍 [...]
    let historyArray: any[];
    if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray(parsed.data)) {
      // 鏂版牸寮忥細浠?data 瀛楁鎻愬彇鏁扮粍
      historyArray = parsed.data;
    } else if (Array.isArray(parsed)) {
      // 鏃ф牸寮忥細鐩存帴浣跨敤鏁扮粍
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

// 浠庢湰鍦板瓨鍌ㄨ幏鍙栨渶鏂版暟鎹?
export function getLocalLatestData(): LatestData | null {
  try {
    const data = localStorage.getItem('btc_indicators_latest');
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') return null;
    
    // 鏀寔涓ょ鏍煎紡锛?
    // 1. 鏂版牸寮忥細{ version, timestamp, data: {...} }
    // 2. 鏃ф牸寮忥細鐩存帴瀵硅薄 {...}
    let latestObj: any;
    if ('data' in parsed && parsed.data && typeof parsed.data === 'object') {
      // 鏂版牸寮忥細浠?data 瀛楁鎻愬彇瀵硅薄
      latestObj = parsed.data;
    } else {
      // 鏃ф牸寮忥細鐩存帴浣跨敤瀵硅薄锛堟帓闄?version/timestamp 绛夊寘瑁呭瓧娈碉級
      latestObj = parsed;
    }
    
    // 浣跨敤 normalizeLatestData 纭繚鏍煎紡涓€鑷?
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

// 淇濆瓨鏁版嵁鍒版湰鍦板瓨鍌紙甯︾増鏈爣璇嗭級
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

// 楠岃瘉鏈湴鏁版嵁涓庡睍绀烘暟鎹殑涓€鑷存€?
export function validateLocalDataConsistency(): {
  historyValid: boolean;
  latestValid: boolean;
  needsSync: boolean;
} {
  const historyValid = Array.isArray(getLocalData());
  const latestData = getLocalLatestData();
  const latestValid = latestData !== null;

  // 妫€鏌ュ巻鍙叉暟鎹拰鏈€鏂版暟鎹槸鍚﹀悓姝?
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

// 鑾峰彇淇″彿浜嬩欢锛堝巻鍙蹭拱鍏ユ満浼氾級
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

// 鑷姩鍒锋柊鏁版嵁锛堢敤浜?React 缁勪欢锛?
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

// 妫€鏌ユ暟鎹簮鍙敤鎬?
export async function checkDataSource(): Promise<{
  apiAvailable: boolean;
  proxyAvailable: boolean;
  historyAvailable: boolean;
  historyLightAvailable: boolean;
  historyFullAvailable: boolean;
  localAvailable: boolean;
}> {
  const result = {
    apiAvailable: false,
    proxyAvailable: false,
    historyAvailable: false,
    historyLightAvailable: false,
    historyFullAvailable: false,
    localAvailable: false
  };

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/v1/btc-price/1`, 5000);
    result.apiAvailable = response.ok;
  } catch {
    result.apiAvailable = false;
  }

  if (PROXY_URL) {
    try {
      const response = await fetchWithTimeout(`${PROXY_URL}/v1/btc-price/1`, 5000);
      result.proxyAvailable = response.ok;
    } catch {
      result.proxyAvailable = false;
    }
  }

  try {
    const response = await fetchWithTimeout(STATIC_HISTORY_LIGHT_PATH, 5000);
    result.historyLightAvailable = response.ok;
  } catch {
    result.historyLightAvailable = false;
  }

  try {
    const response = await fetchWithTimeout(STATIC_HISTORY_FULL_PATH, 5000);
    result.historyFullAvailable = response.ok;
  } catch {
    result.historyFullAvailable = false;
  }

  result.historyAvailable = result.historyLightAvailable || result.historyFullAvailable;
  result.localAvailable = !!getLocalLatestData();

  return result;
}

// 鑾峰彇鏁版嵁鐘舵€佷俊鎭紙鐢ㄤ簬璋冭瘯锛?
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

export function getDataFreshnessHours(date: string): number {
  if (!date) {
    return 0;
  }

  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(timestamp)) {
    return 0;
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs <= 0) {
    return 0;
  }

  return Number((diffMs / (1000 * 60 * 60)).toFixed(1));
}

// ============ 鍘嗗彶鏁版嵁鍥捐〃鐩稿叧鍑芥暟 ============

// 鏃堕棿鑼冨洿瀵瑰簲鐨勬绉掓暟
const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  '6m': 180 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
  'all': Infinity
};

// 鏍规嵁鏃堕棿鑼冨洿杩囨护鏁版嵁
export function filterDataByTimeRange(data: IndicatorData[], range: TimeRange): IndicatorData[] {
  if (range === 'all') return data;
  
  const cutoffTime = Date.now() - TIME_RANGE_MS[range];
  return data.filter(item => {
    const itemTime = new Date(item.d).getTime();
    return itemTime >= cutoffTime;
  });
}

// 鑾峰彇鎸囨爣鍥捐〃鏁版嵁
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
      // 杩囨护鎺夊崰浣嶆暟鎹細鎸囨爣鍊间负0涓擝TC浠锋牸涔熶负0鎴栫己澶辩殑璁板綍
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

// 鑾峰彇MA200鍥捐〃鏁版嵁锛堜环鏍煎拰鍧囩嚎锛?
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

// Indicator config
export const INDICATOR_CONFIG = {
  priceMa200w: {
    name: 'BTC Price / 200W-MA',
    unit: '',
    targetValue: 1,
    color: '#F7931A',
    description: 'Price relative to 200-week moving average'
  },
  mvrvZ: {
    name: 'MVRV Z-Score',
    unit: '',
    targetValue: 0,
    color: '#3B82F6',
    description: 'Standardized market value vs realized value'
  },
  lthMvrv: {
    name: 'LTH-MVRV',
    unit: '',
    targetValue: 1,
    color: '#10B981',
    description: 'Long-term holder unrealized P/L ratio'
  },
  puell: {
    name: 'Puell Multiple',
    unit: '',
    targetValue: 0.5,
    color: '#8B5CF6',
    description: 'Miner revenue relative to historical norm'
  },
  nupl: {
    name: 'NUPL',
    unit: '',
    targetValue: 0,
    color: '#EF4444',
    description: 'Net unrealized profit/loss'
  }
};

// Time range labels
export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1w': 'Last 1 Week',
  '1m': 'Last 1 Month',
  '6m': 'Last 6 Months',
  '1y': 'Last 1 Year',
  'all': 'All History'
};
