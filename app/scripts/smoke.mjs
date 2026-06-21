import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:4173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.getByRole('heading', { name: /BTC 大周期底部识别监测/ }).waitFor({ timeout: 30_000 });
  await page.getByText(/BTC 价格/).first().waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: /显示指标图表/ }).click();
  await page.getByText(/核心指标历史图表/).waitFor({ timeout: 30_000 });
  await page.getByRole('tab', { name: /历史记录/ }).click();
  await page.getByText(/完整历史数据|历史信号记录|正在加载完整历史数据/).waitFor({ timeout: 30_000 });
} finally {
  await browser.close();
}
