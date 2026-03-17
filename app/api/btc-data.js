/**
 * Vercel Serverless Function - BTC 指标数据代理
 * 
 * 此 API 端点作为 BGeometrics API 的代理，解决浏览器端 CORS 问题
 * 同时缓存数据以减少对原始 API 的请求次数
 * 
 * 部署到 Vercel 后，前端可以通过 /api/btc-data 访问此端点
 * 
 * @param {Request} request
 * @returns {Response}
 */

export const config = {
  runtime: 'edge',
};

const API_BASE_URL = 'https://bitcoin-data.com';
const CACHE_DURATION = 300; // 缓存5分钟（秒）

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  
  // 设置 CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // 处理 OPTIONS 请求（预检）
  if (request.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    let data;
    const now = Math.floor(Date.now() / 1000);
    
    // 根据请求路径决定获取哪些数据
    if (path === '/btc-data/latest' || path === '/btc-data') {
      // 获取所有最新指标数据
      const [mvrvZ, lthMvrv, puell, nupl, btcPrice, mayer] = await Promise.all([
        fetch(`${API_BASE_URL}/v1/mvrv-zscore/1`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/v1/lth-mvrv/1`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/v1/puell-multiple/1`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/v1/nupl/1`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/v1/btc-price/1`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/v1/mayer-multiple/1`).then(r => r.ok ? r.json() : []),
      ]);

      // 计算信号
      const price = btcPrice[0]?.btcPrice ? parseFloat(btcPrice[0].btcPrice) : 0;
      const mvrvZScore = mvrvZ[0]?.mvrvZscore ? parseFloat(mvrvZ[0].mvrvZscore) : 0;
      const lthMvrvValue = lthMvrv[0]?.lthMvrv ? parseFloat(lthMvrv[0].lthMvrv) : 0;
      const puellValue = puell[0]?.puellMultiple ? parseFloat(puell[0].puellMultiple) : 0;
      const nuplValue = nupl[0]?.nupl ? parseFloat(nupl[0].nupl) : 0;
      
      // 估算 price_ma200w_ratio（使用 Mayer Multiple）
      const mayerValue = mayer[0]?.mayerMultiple ? parseFloat(mayer[0].mayerMultiple) : 0;
      const priceMa200wRatio = mayerValue * 0.9; // 粗略估计

      const signals = {
        priceMa200w: priceMa200wRatio < 1,
        mvrvZ: mvrvZScore < 0,
        lthMvrv: lthMvrvValue < 1,
        puell: puellValue < 0.5,
        nupl: nuplValue < 0
      };

      data = {
        date: mvrvZ[0]?.d || new Date().toISOString().split('T')[0],
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
          mayer: mayer[0]
        }
      };
    } else if (path.startsWith('/btc-data/history')) {
      // 获取历史数据 - 这里返回缓存的数据或从文件读取
      // 实际使用时，历史数据应该从静态文件或数据库获取
      data = {
        message: 'History data should be fetched from static JSON file',
        hint: 'Use /btc_indicators_history.json instead'
      };
    } else {
      // 代理到原始 API
      const targetUrl = `${API_BASE_URL}${path.replace('/btc-data', '')}`;
      const response = await fetch(targetUrl);
      data = await response.json();
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
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch data',
        message: error.message 
      }), 
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
