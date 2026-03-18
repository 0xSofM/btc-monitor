/**
 * Vercel Serverless Function - BTC data proxy
 *
 * Serves a stable `/api/btc-data` endpoint for the frontend and proxies
 * sub-paths like `/api/btc-data/latest` and `/api/btc-data/v1/...`.
 */

export const config = {
  runtime: 'edge',
};

const API_BASE_URL = 'https://bitcoin-data.com';
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
    priceMa200w: typeof snapshot.signal_price_ma === 'boolean' ? snapshot.signal_price_ma : priceMa200wRatio < 1,
    mvrvZ: typeof snapshot.signal_mvrv_z === 'boolean' ? snapshot.signal_mvrv_z : mvrvZscore < 0,
    lthMvrv: typeof snapshot.signal_lth_mvrv === 'boolean' ? snapshot.signal_lth_mvrv : lthMvrv < 1,
    puell: typeof snapshot.signal_puell === 'boolean' ? snapshot.signal_puell : puellMultiple < 0.5,
    nupl: typeof snapshot.signal_nupl === 'boolean' ? snapshot.signal_nupl : nupl < 0,
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
      priceMa200w: date,
      mvrvZ: date,
      lthMvrv: date,
      puell: date,
      nupl: date,
    },
    raw: null,
  };
}

async function fetchJsonSafely(url, fallback) {
  try {
    const response = await fetch(url);
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
      const [mvrvZ, lthMvrv, puell, nupl, btcPrice, mayer] = await Promise.all([
        fetchJsonSafely(`${API_BASE_URL}/v1/mvrv-zscore/1`, []),
        fetchJsonSafely(`${API_BASE_URL}/v1/lth-mvrv/1`, []),
        fetchJsonSafely(`${API_BASE_URL}/v1/puell-multiple/1`, []),
        fetchJsonSafely(`${API_BASE_URL}/v1/nupl/1`, []),
        fetchJsonSafely(`${API_BASE_URL}/v1/btc-price/1`, []),
        fetchJsonSafely(`${API_BASE_URL}/v1/mayer-multiple/1`, []),
      ]);

      if (!btcPrice[0]?.btcPrice) {
        data = await fetchStaticLatestFallback(request);
      } else {
        const price = parseFloat(btcPrice[0].btcPrice);
        const mvrvZScore = mvrvZ[0]?.mvrvZscore ? parseFloat(mvrvZ[0].mvrvZscore) : 0;
        const lthMvrvValue = lthMvrv[0]?.lthMvrv ? parseFloat(lthMvrv[0].lthMvrv) : 0;
        const puellValue = puell[0]?.puellMultiple ? parseFloat(puell[0].puellMultiple) : 0;
        const nuplValue = nupl[0]?.nupl ? parseFloat(nupl[0].nupl) : 0;
        const mayerValue = mayer[0]?.mayerMultiple ? parseFloat(mayer[0].mayerMultiple) : 0;
        const priceMa200wRatio = mayerValue * 0.9;

        const signals = {
          priceMa200w: priceMa200wRatio < 1,
          mvrvZ: mvrvZScore < 0,
          lthMvrv: lthMvrvValue < 1,
          puell: puellValue < 0.5,
          nupl: nuplValue < 0,
        };

        data = {
          date: mvrvZ[0]?.d || btcPrice[0]?.d || new Date().toISOString().split('T')[0],
          btcPrice: price,
          priceMa200wRatio,
          mvrvZscore: mvrvZScore,
          lthMvrv: lthMvrvValue,
          puellMultiple: puellValue,
          nupl: nuplValue,
          signalCount: Object.values(signals).filter(Boolean).length,
          signals,
          raw: {
            mvrvZ: mvrvZ[0],
            lthMvrv: lthMvrv[0],
            puell: puell[0],
            nupl: nupl[0],
            btcPrice: btcPrice[0],
            mayer: mayer[0],
          },
        };
      }
    } else if (path.startsWith('/btc-data/history')) {
      data = {
        message: 'History data should be fetched from static JSON file',
        hint: 'Use /btc_indicators_history.json instead',
      };
    } else {
      const targetUrl = `${API_BASE_URL}${path.replace('/btc-data', '')}`;
      data = await fetchJsonSafely(targetUrl, { error: 'Failed to fetch upstream endpoint' });
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
      }
    );
  }
}
