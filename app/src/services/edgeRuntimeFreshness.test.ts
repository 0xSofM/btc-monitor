import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const edgeSource = readFileSync(new URL('../../api/btc-data.js', import.meta.url), 'utf-8');

const day = (offset: number) => {
  const ms = Date.now() + offset * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
};
const ts = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Series ending at `lastDate`, long enough for the derived-valuation maths. */
function series(lastDate: string, value: number, length = 400): [number, number][] {
  const end = Date.parse(`${lastDate}T00:00:00Z`);
  return Array.from({ length }, (_, i) => [
    end - (length - 1 - i) * 24 * 60 * 60 * 1000,
    value * (1 + i / 10000),
  ]);
}

function b64Float64(values: number[]): string {
  const buf = Buffer.alloc(8 * values.length);
  values.forEach((v, i) => buf.writeDoubleLE(v, i * 8));
  return buf.toString('base64');
}

function plotlyPage(traces: { name: string; x: string[]; values: number[] }[]): string {
  const data = traces.map(({ name, x, values }) => ({
    name,
    x,
    y: { dtype: 'f8', bdata: b64Float64(values) },
  }));
  return `<!doctype html><script>Plotly.newPlot("gd", ${JSON.stringify(data)}, {});</script>`;
}

describe('Edge runtime freshness guards', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the fetchRuntimeInputs destructuring aligned with Promise.all', () => {
    const start = edgeSource.indexOf('async function fetchRuntimeInputs');
    const allStart = edgeSource.indexOf('= await Promise.all([', start);
    const destructuring = edgeSource.slice(start, allStart);
    const names = destructuring
      .slice(destructuring.indexOf('[') + 1, destructuring.lastIndexOf(']'))
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const arrayBody = edgeSource.slice(allStart + '= await Promise.all(['.length);
    const arrayEnd = arrayBody.indexOf(']);');
    const calls = arrayBody
      .slice(0, arrayEnd)
      .split(',')
      .map((call) => call.trim())
      .filter(Boolean);

    expect(names).toContain('puellBackupPoint');
    expect(names).toContain('derivedValuationPoints');
    // A mismatch here silently shifts every later binding and breaks the
    // whole runtime handler (historically: puellBackupPoint was undefined).
    expect(names).toHaveLength(calls.length);
  });

  it('resolves LTH/STH backup tiers by date instead of short-circuiting', () => {
    expect(edgeSource).not.toContain('stillNeededKeys');
    expect(edgeSource).toContain('resolveLthSthPoint');
    expect(edgeSource).toContain('needsBackup ? fetchCheckonchainBackupPoints(staleKeys) : {}');
    expect(edgeSource).toContain('const [bdPoints, cocPoints] = await Promise.all([');
    expect(edgeSource).toContain('pickFreshestPoint(\n        primary,\n        bdPoints[key] ?? null,\n        cocPoints[key] ?? null,\n      )');
  });

  it('serves same-day LTH/STH values even when the static snapshot is unavailable', async () => {
    const today = day(0);
    const yesterday = day(-1);
    const stale = day(-7);
    const todayIso = `${today}T00:00:00`;
    const yesterdayIso = `${yesterday}T00:00:00`;

    const lthPage = plotlyPage([
      { name: 'LTH-MVRV', x: [yesterdayIso, todayIso], values: [1.53, 1.518924] },
      { name: 'LTH-SOPR', x: [yesterdayIso, todayIso], values: [1.005, 0.990861] },
    ]);
    const sthPage = plotlyPage([
      { name: 'STH-MVRV', x: [yesterdayIso, todayIso], values: [0.988, 0.977464] },
    ]);
    const soprPage = plotlyPage([
      { name: 'STH-SOPR > 1', x: [yesterdayIso, todayIso], values: [1.0, 1.0] },
      { name: 'STH-SOPR < 1', x: [yesterdayIso, todayIso], values: [0.992, 0.991944] },
    ]);

    const staleValues: Record<string, number> = {
      lth_mvrv: 1.5734, lth_sopr: 1.0001, sth_mvrv: 1.0132, sth_sopr: 0.9991,
      mvrv_zscore_data: 0.7402, nupl_data: 0.2973,
    };
    const requests: string[] = [];

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requests.push(url);

      if (url.includes('/btc_indicators_latest.json')) {
        return new Response('', { status: 404 });
      }
      if (url.includes('/btc_indicators_history')) {
        return new Response('[]', { status: 200 });
      }
      if (url.includes('charts-cdn.checkonchain.com')) {
        const html = url.includes('mvrv_lth') ? lthPage
          : url.includes('mvrv_sth') ? sthPage
            : url.includes('sthsopr_indicator') ? soprPage : null;
        return html
          ? new Response(html, { status: 200 })
          : new Response('', { status: 404 });
      }
      if (url.includes('charts.bgeometrics.com/files/')) {
        const file = (url.split('/').pop() ?? '').replace(/\.json$/, '');
        const body = file in staleValues
          ? JSON.stringify([[ts(stale), staleValues[file]]])
          : JSON.stringify(series(today, file.includes('price') || file.includes('supply') ? 1 : 1e12));
        return new Response(body, { status: 200 });
      }
      if (url.includes('bitcoin-data.com/v1/')) {
        const lastMatch = url.match(/\/v1\/([a-z-]+)\/last/);
        const key = lastMatch ? ({
          'lth-mvrv': 'lthMvrv', 'lth-sopr': 'lthSopr',
          'sth-sopr': 'sthSopr', 'sth-mvrv': 'sthMvrv',
        } as Record<string, string>)[lastMatch[1]] : undefined;
        if (key) {
          return new Response(JSON.stringify({
            d: stale, unixTs: ts(stale) / 1000, [key]: 1.0,
            delayed: true,
            message: 'Real-time data (last 7 days) requires an active subscription.',
          }), { status: 200 });
        }
        return new Response(JSON.stringify([{ d: stale }]), { status: 200 });
      }
      if (url.includes('api.blockchain.info/stats')) {
        return new Response(JSON.stringify({ market_price_usd: 74494.54 }), { status: 200 });
      }
      if (url.includes('api.coinbase.com')) {
        return new Response(JSON.stringify({ data: { amount: '74494.54' } }), { status: 200 });
      }
      if (url.includes('api.coingecko.com')) {
        return new Response(JSON.stringify({ bitcoin: { usd: 74494.54 } }), { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    vi.stubGlobal('fetch', mockFetch);
    // Silence expected upstream-miss warnings from fetchJsonSafely.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Load the plain-JS Edge module through a runtime URL so TypeScript does
    // not need a declaration file for it (the Edge function ships no .d.ts).
    const edgeModuleUrl = new URL('../../api/btc-data.js', import.meta.url).href;
    const { default: handler } = await import(/* @vite-ignore */ edgeModuleUrl) as {
      default: (request: Request) => Promise<Response>;
    };
    const response = await handler(new Request('https://example.vercel.app/api/btc-data/latest'));
    const payload = await response.json() as Record<string, unknown> & {
      indicatorDates?: Record<string, string>;
    };

    expect(response.status).toBe(200);
    expect(requests.filter((u) => u.includes('charts-cdn.checkonchain.com')).length).toBeGreaterThan(0);
    for (const key of ['lthMvrv', 'lthSopr', 'sthSopr', 'sthMvrv']) {
      expect(payload.indicatorDates?.[key]).toBe(today);
    }
    expect(payload.lthMvrv).toBeCloseTo(1.518924, 5);
    expect(payload.sthSopr).toBeCloseTo(0.991944, 5);
  });
});
