/**
 * Vercel Edge Function - BTC data proxy with backup price feeds.
 *
 * Primary source:
 *   - bitcoin-data.com
 *
 * Backup strategy:
 *   1. BTC spot price falls back to Coinbase, then CoinGecko.
 *   2. Slow on-chain indicators fall back to the latest static snapshot.
 *   3. The response keeps real per-indicator dates so the UI can show staleness.
 */

export const config = {
  runtime: 'edge',
};

const API_BASE_URL = 'https://bitcoin-data.com';
const COINBASE_SPOT_URL = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';
const COINGECKO_SPOT_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
const CACHE_DURATION = 300;

function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function getTodayUtcDate() {
  return new Date().toISOString().split('T')[0];
}

function normalizeLatestSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const date = snapshot.date ?? snapshot.d;
  if (!date) {
    return null;
  }

  const btcPrice = toNumber(snapshot.btcPrice ?? snapshot.btc_price);
  const priceMa200wRatio = toNumber(snapshot.priceMa200wRatio ?? snapshot.price_ma200w_ratio);
  const mvrvZscore = toNumber(snapshot.mvrvZscore ?? snapshot.mvrv_zscore);
  const lthMvrv = toNumber(snapshot.lthMvrv ?? snapshot.lth_mvrv);
  const puellMultiple = toNumber(snapshot.puellMultiple ?? snapshot.puell_multiple);
  const nupl = toNumber(snapshot.nupl);
  const ma200w = snapshot.ma200w === undefined || snapshot.ma200w === null
    ? undefined
    : toNumber(snapshot.ma200w);

  const signals = {
    priceMa200w: typeof snapshot.signals?.priceMa200w === 'boolean'
      ? snapshot.signals.priceMa200w
      : (typeof snapshot.signal_price_ma === 'boolean' ? snapshot.signal_price_ma : priceMa200wRatio < 1),
    mvrvZ: typeof snapshot.signals?.mvrvZ === 'boolean'
      ? snapshot.signals.mvrvZ
      : (typeof snapshot.signal_mvrv_z === 'boolean' ? snapshot.signal_mvrv_z : mvrvZscore < 0),
    lthMvrv: typeof snapshot.signals?.lthMvrv === 'boolean'
      ? snapshot.signals.lthMvrv
      : (typeof snapshot.signal_lth_mvrv === 'boolean' ? snapshot.signal_lth_mvrv : lthMvrv < 1),
    puell: typeof snapshot.signals?.puell === 'boolean'
      ? snapshot.signals.puell
      : (typeof snapshot.signal_puell === 'boolean' ? snapshot.signal_puell : puellMultiple < 0.5),
    nupl: typeof snapshot.signals?.nupl === 'boolean'
      ? snapshot.signals.nupl
      : (typeof snapshot.signal_nupl === 'boolean' ? snapshot.signal_nupl : nupl < 0),
  };

  return {
    date,
    btcPrice,
    priceMa200wRatio,
    ma200w,
    mvrvZscore,
    lthMvrv,
    puellMultiple,
    nupl,
    signalCount: snapshot.signalCount ?? snapshot.signal_count ?? Object.values(signals).filter(Boolean).length,
    signals,
    indicatorDates: {
      priceMa200w: snapshot.indicatorDates?.priceMa200w ?? date,
      mvrvZ: snapshot.indicatorDates?.mvrvZ ?? date,
      lthMvrv: snapshot.indicatorDates?.lthMvrv ?? date,
      puell: snapshot.indicatorDates?.puell ?? date,
      nupl: snapshot.indicatorDates?.nupl ?? date,
    },
    raw: null,
  };
}

async function fetchJsonSafely(url, fallback, init) {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      return fallback;
    }

    const text = await response.text();
    if (!text) {
      return fallback;
    }

    return JSON.parse(text);
  } catch (error) {
    console.warn('Upstream fetch failed:', url, error);
    return fallback;
  }
}

async function fetchStaticLatestFallback(request) {
  try {
    const fallbackUrl = new URL('/btc_indicators_latest.json', request.url);
    const response = await fetch(fallbackUrl);
    if (!response.ok) {
      return null;
    }

    const raw = await response.json();
    return normalizeLatestSnapshot(raw);
  } catch (error) {
    console.warn('Static latest fallback failed:', error);
    return null;
  }
}

async function fetchCoinbaseSpotPrice() {
  const payload = await fetchJsonSafely(COINBASE_SPOT_URL, null, {
    headers: {
      'User-Agent': 'btc-monitor',
    },
  });

  const amount = payload?.data?.amount;
  if (amount === undefined || amount === null) {
    return null;
  }

  return {
    d: getTodayUtcDate(),
    btcPrice: toNumber(amount),
    source: 'coinbase',
  };
}

async function fetchCoinGeckoSpotPrice() {
  const headers = {
    'User-Agent': 'btc-monitor',
  };
  const demoKey = process.env.COINGECKO_DEMO_API_KEY;
  if (demoKey) {
    headers['x-cg-demo-api-key'] = demoKey;
  }

  const payload = await fetchJsonSafely(COINGECKO_SPOT_URL, null, { headers });
  const amount = payload?.bitcoin?.usd;
  if (amount === undefined || amount === null) {
    return null;
  }

  return {
    d: getTodayUtcDate(),
    btcPrice: toNumber(amount),
    source: 'coingecko',
  };
}

async function fetchBackupSpotPrice() {
  const coinbase = await fetchCoinbaseSpotPrice();
  if (coinbase?.btcPrice) {
    return coinbase;
  }

  const coingecko = await fetchCoinGeckoSpotPrice();
  if (coingecko?.btcPrice) {
    return coingecko;
  }

  return null;
}

function buildIndicatorArray(staticLatest, dataKey, dateKey) {
  if (!staticLatest) {
    return [];
  }

  const value = staticLatest[dataKey];
  const day = staticLatest.indicatorDates?.[dateKey] ?? staticLatest.date;
  if (value === undefined || value === null || !day) {
    return [];
  }

  return [{
    d: day,
    [dataKey]: value,
  }];
}

function buildPriceArrayFromFallback(pricePoint) {
  if (!pricePoint?.btcPrice) {
    return [];
  }

  return [{
    d: pricePoint.d,
    btcPrice: pricePoint.btcPrice,
  }];
}

function buildLatestPayload({ pricePoint, mvrvPoint, lthPoint, puellPoint, nuplPoint, staticLatest }) {
  if (!pricePoint && !staticLatest) {
    return null;
  }

  const price = toNumber(pricePoint?.btcPrice ?? staticLatest?.btcPrice);
  const ma200w = staticLatest?.ma200w && staticLatest.ma200w > 0
    ? staticLatest.ma200w
    : undefined;
  const priceMa200wRatio = ma200w && ma200w > 0
    ? price / ma200w
    : toNumber(staticLatest?.priceMa200wRatio);

  const mvrvZscore = toNumber(mvrvPoint?.mvrvZscore ?? staticLatest?.mvrvZscore);
  const lthMvrv = toNumber(lthPoint?.lthMvrv ?? staticLatest?.lthMvrv);
  const puellMultiple = toNumber(puellPoint?.puellMultiple ?? staticLatest?.puellMultiple);
  const nupl = toNumber(nuplPoint?.nupl ?? staticLatest?.nupl);

  const signals = {
    priceMa200w: priceMa200wRatio < 1,
    mvrvZ: mvrvZscore < 0,
    lthMvrv: lthMvrv < 1,
    puell: puellMultiple < 0.5,
    nupl: nupl < 0,
  };

  return {
    date: pricePoint?.d ?? staticLatest?.date ?? getTodayUtcDate(),
    btcPrice: price,
    priceMa200wRatio,
    ma200w,
    mvrvZscore,
    lthMvrv,
    puellMultiple,
    nupl,
    signalCount: Object.values(signals).filter(Boolean).length,
    signals,
    indicatorDates: {
      priceMa200w: pricePoint?.d ?? staticLatest?.indicatorDates?.priceMa200w ?? staticLatest?.date,
      mvrvZ: mvrvPoint?.d ?? staticLatest?.indicatorDates?.mvrvZ ?? staticLatest?.date,
      lthMvrv: lthPoint?.d ?? staticLatest?.indicatorDates?.lthMvrv ?? staticLatest?.date,
      puell: puellPoint?.d ?? staticLatest?.indicatorDates?.puell ?? staticLatest?.date,
      nupl: nuplPoint?.d ?? staticLatest?.indicatorDates?.nupl ?? staticLatest?.date,
    },
    raw: {
      priceSource: pricePoint?.source ?? 'bitcoin-data',
      primaryAvailable: {
        price: Boolean(pricePoint && !pricePoint.source),
        mvrvZ: Boolean(mvrvPoint),
        lthMvrv: Boolean(lthPoint),
        puell: Boolean(puellPoint),
        nupl: Boolean(nuplPoint),
      },
    },
  };
}

export default async function handler(request) {
  const url = new URL(request.url);
  const rewrittenPath = url.searchParams.get('path');
  const path = rewrittenPath || url.pathname.replace('/api', '');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    let data;

    if (path === '/btc-data/latest' || path === '/btc-data') {
      const [mvrvZ, lthMvrv, puell, nupl, btcPrice, staticLatest] = await Promise.all([
        fetchJsonSafely(`${API_BASE_URL}/v1/mvrv-zscore/1`, [], { headers: { 'User-Agent': 'btc-monitor' } }),
        fetchJsonSafely(`${API_BASE_URL}/v1/lth-mvrv/1`, [], { headers: { 'User-Agent': 'btc-monitor' } }),
        fetchJsonSafely(`${API_BASE_URL}/v1/puell-multiple/1`, [], { headers: { 'User-Agent': 'btc-monitor' } }),
        fetchJsonSafely(`${API_BASE_URL}/v1/nupl/1`, [], { headers: { 'User-Agent': 'btc-monitor' } }),
        fetchJsonSafely(`${API_BASE_URL}/v1/btc-price/1`, [], { headers: { 'User-Agent': 'btc-monitor' } }),
        fetchStaticLatestFallback(request),
      ]);

      const backupPrice = !btcPrice[0]?.btcPrice ? await fetchBackupSpotPrice() : null;
      const pricePoint = btcPrice[0] ?? backupPrice;
      const mvrvPoint = mvrvZ[0] ?? buildIndicatorArray(staticLatest, 'mvrvZscore', 'mvrvZ')[0];
      const lthPoint = lthMvrv[0] ?? buildIndicatorArray(staticLatest, 'lthMvrv', 'lthMvrv')[0];
      const puellPoint = puell[0] ?? buildIndicatorArray(staticLatest, 'puellMultiple', 'puell')[0];
      const nuplPoint = nupl[0] ?? buildIndicatorArray(staticLatest, 'nupl', 'nupl')[0];

      data = buildLatestPayload({
        pricePoint,
        mvrvPoint,
        lthPoint,
        puellPoint,
        nuplPoint,
        staticLatest,
      }) ?? staticLatest;
    } else if (path === '/btc-data/v1/btc-price/1') {
      const primary = await fetchJsonSafely(`${API_BASE_URL}/v1/btc-price/1`, [], { headers: { 'User-Agent': 'btc-monitor' } });
      if (primary.length > 0) {
        data = primary;
      } else {
        const backupPrice = await fetchBackupSpotPrice();
        data = buildPriceArrayFromFallback(backupPrice);
      }
    } else if (path === '/btc-data/v1/mvrv-zscore/1') {
      const primary = await fetchJsonSafely(`${API_BASE_URL}/v1/mvrv-zscore/1`, [], { headers: { 'User-Agent': 'btc-monitor' } });
      if (primary.length > 0) {
        data = primary;
      } else {
        const staticLatest = await fetchStaticLatestFallback(request);
        data = buildIndicatorArray(staticLatest, 'mvrvZscore', 'mvrvZ');
      }
    } else if (path === '/btc-data/v1/lth-mvrv/1') {
      const primary = await fetchJsonSafely(`${API_BASE_URL}/v1/lth-mvrv/1`, [], { headers: { 'User-Agent': 'btc-monitor' } });
      if (primary.length > 0) {
        data = primary;
      } else {
        const staticLatest = await fetchStaticLatestFallback(request);
        data = buildIndicatorArray(staticLatest, 'lthMvrv', 'lthMvrv');
      }
    } else if (path === '/btc-data/v1/puell-multiple/1') {
      const primary = await fetchJsonSafely(`${API_BASE_URL}/v1/puell-multiple/1`, [], { headers: { 'User-Agent': 'btc-monitor' } });
      if (primary.length > 0) {
        data = primary;
      } else {
        const staticLatest = await fetchStaticLatestFallback(request);
        data = buildIndicatorArray(staticLatest, 'puellMultiple', 'puell');
      }
    } else if (path === '/btc-data/v1/nupl/1') {
      const primary = await fetchJsonSafely(`${API_BASE_URL}/v1/nupl/1`, [], { headers: { 'User-Agent': 'btc-monitor' } });
      if (primary.length > 0) {
        data = primary;
      } else {
        const staticLatest = await fetchStaticLatestFallback(request);
        data = buildIndicatorArray(staticLatest, 'nupl', 'nupl');
      }
    } else if (path.startsWith('/btc-data/history')) {
      data = {
        message: 'History data should be fetched from static JSON file',
        hint: 'Use /btc_indicators_history.json instead',
      };
    } else {
      const targetUrl = `${API_BASE_URL}${path.replace('/btc-data', '')}`;
      data = await fetchJsonSafely(targetUrl, { error: 'Failed to fetch upstream endpoint' }, { headers: { 'User-Agent': 'btc-monitor' } });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': `public, max-age=${CACHE_DURATION}, s-maxage=${CACHE_DURATION}`,
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('API Error:', error);

    const fallbackData = await fetchStaticLatestFallback(request);
    if (fallbackData) {
      return new Response(JSON.stringify(fallbackData), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': `public, max-age=${CACHE_DURATION}, s-maxage=${CACHE_DURATION}`,
          'X-Cache': 'FALLBACK',
        },
      });
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch data',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}
