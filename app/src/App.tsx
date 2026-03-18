import { Suspense, lazy, useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import {
  AlertTriangle,
  Bitcoin,
  BookOpen,
  History,
  LineChart,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IndicatorCard } from '@/components/IndicatorCard';
import { SignalOverview } from '@/components/SignalOverview';
import type { IndicatorData, LatestData } from '@/types';
import {
  fetchAllLatestIndicators,
  fetchHistoricalData,
  fetchStaticLatestData,
  getLatestFromHistory,
} from '@/services/dataService';

import './App.css';

type DataSource = 'api' | 'static' | 'history';
type IndicatorDateKey = 'priceMa200w' | 'mvrvZ' | 'lthMvrv' | 'puell' | 'nupl';

const IndicatorChartsPanel = lazy(async () => {
  const module = await import('@/components/IndicatorCharts');
  return { default: module.IndicatorCharts };
});

const HistoryReviewPanel = lazy(async () => {
  const module = await import('@/components/HistoryReview');
  return { default: module.HistoryReview };
});

const IndicatorExplanationPanel = lazy(async () => {
  const module = await import('@/components/IndicatorExplanation');
  return { default: module.IndicatorExplanation };
});

function SectionLoader({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <Loader2 className="mb-3 h-8 w-8 animate-spin text-orange-500" />
      <p>{message}</p>
    </div>
  );
}

function App() {
  const [latestData, setLatestData] = useState<LatestData | null>(null);
  const [historicalData, setHistoricalData] = useState<IndicatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('-');
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('static');

  useEffect(() => {
    const loadHistoricalData = async () => {
      const data = await fetchHistoricalData();
      if (data.length > 0) {
        setHistoricalData(data);
      }
    };

    void loadHistoricalData();
  }, []);

  const applyLatestData = (data: LatestData, source: DataSource) => {
    setLatestData(data);
    setDataSource(source);

    if (source === 'api') {
      setLastUpdated(`${new Date().toLocaleString('zh-CN')} (实时 API)`);
      return;
    }

    if (source === 'static') {
      setLastUpdated(`${data.date} (GitHub 同步静态快照)`);
      return;
    }

    setLastUpdated(`${data.date} (历史回退数据)`);
  };

  const loadHistoryFallback = async () => {
    if (historicalData.length > 0) {
      return historicalData;
    }

    const data = await fetchHistoricalData();
    if (data.length > 0) {
      setHistoricalData(data);
    }
    return data;
  };

  const fetchLatestData = async (mode: 'auto' | 'manual' = 'auto') => {
    setLoading(true);
    setError(null);

    try {
      if (mode === 'auto') {
        const staticData = await fetchStaticLatestData();
        if (staticData) {
          applyLatestData(staticData, 'static');
          return;
        }
      }

      const apiData = await fetchAllLatestIndicators(mode === 'auto');
      if (apiData) {
        applyLatestData(apiData, 'api');

        if (mode === 'manual' && apiData.signalCount >= 4) {
          toast.success(`买入信号触发: ${apiData.signalCount}/5`, {
            description: `当前 BTC 价格: $${apiData.btcPrice.toLocaleString()}`,
            duration: 10000,
          });
        }
        return;
      }

      throw new Error('No latest data available');
    } catch (err) {
      console.error('Error fetching data:', err);

      const staticData = await fetchStaticLatestData();
      if (staticData) {
        applyLatestData(staticData, 'static');
        if (mode === 'manual') {
          toast.info('实时 API 暂时不可用，已切换为静态快照。');
        }
        return;
      }

      const history = await loadHistoryFallback();
      const backupData = getLatestFromHistory(history);
      if (backupData) {
        applyLatestData(backupData, 'history');
        toast.info('当前显示历史回退数据，静态快照和实时 API 暂时都不可用。');
        return;
      }

      setError('无法获取数据，请检查网络连接后重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLatestData('auto');

    const interval = setInterval(() => {
      void fetchLatestData('auto');
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const indicatorDateLabels: Record<IndicatorDateKey, string> = {
    priceMa200w: 'BTC Price / 200W-MA',
    mvrvZ: 'MVRV Z-Score',
    lthMvrv: 'LTH-MVRV',
    puell: 'Puell Multiple',
    nupl: 'NUPL',
  };

  const indicatorDateEntries = latestData?.indicatorDates
    ? (Object.entries(latestData.indicatorDates) as Array<[IndicatorDateKey, string | undefined]>)
        .reduce<Array<[IndicatorDateKey, string]>>((entries, [key, value]) => {
          if (value) {
            entries.push([key, value]);
          }
          return entries;
        }, [])
    : [];

  const laggingIndicators = latestData
    ? indicatorDateEntries
        .filter(([, value]) => value < latestData.date)
        .map(([key]) => indicatorDateLabels[key])
    : [];

  const oldestIndicatorDate = indicatorDateEntries.length > 0
    ? indicatorDateEntries.reduce((oldest, [, value]) => {
        if (!value) return oldest;
        if (!oldest) return value;
        return value < oldest ? value : oldest;
      }, '' as string)
    : undefined;

  const indicators = latestData
    ? [
        {
          name: 'BTC Price / 200W-MA',
          description: '价格相对 200 周均线的位置',
          currentValue: latestData.priceMa200wRatio,
          targetValue: 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signals.priceMa200w,
          format: 'ratio' as const,
          color: '#F7931A',
          dataDate: latestData.indicatorDates?.priceMa200w || latestData.date,
          detailValue: latestData.ma200w
            ? `BTC: $${latestData.btcPrice.toLocaleString()} / MA200: $${Math.round(latestData.ma200w).toLocaleString()}`
            : `BTC: $${latestData.btcPrice.toLocaleString()}`,
        },
        {
          name: 'MVRV Z-Score',
          description: '市场价值相对历史实现价值的偏离程度',
          currentValue: latestData.mvrvZscore,
          targetValue: 0,
          targetOperator: 'lt' as const,
          triggered: latestData.signals.mvrvZ,
          format: 'number' as const,
          color: '#3B82F6',
          dataDate: latestData.indicatorDates?.mvrvZ || latestData.date,
        },
        {
          name: 'LTH-MVRV',
          description: '长期持有者盈亏状态',
          currentValue: latestData.lthMvrv,
          targetValue: 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signals.lthMvrv,
          format: 'ratio' as const,
          color: '#10B981',
          dataDate: latestData.indicatorDates?.lthMvrv || latestData.date,
        },
        {
          name: 'Puell Multiple',
          description: '矿工收入相对历史均值的位置',
          currentValue: latestData.puellMultiple,
          targetValue: 0.5,
          targetOperator: 'lt' as const,
          triggered: latestData.signals.puell,
          format: 'ratio' as const,
          color: '#8B5CF6',
          dataDate: latestData.indicatorDates?.puell || latestData.date,
        },
        {
          name: 'NUPL',
          description: '全网未实现盈利/亏损状态',
          currentValue: latestData.nupl,
          targetValue: 0,
          targetOperator: 'lt' as const,
          triggered: latestData.signals.nupl,
          format: 'number' as const,
          color: '#EF4444',
          dataDate: latestData.indicatorDates?.nupl || latestData.date,
        },
      ]
    : [];

  const marketAssessment = latestData
    ? latestData.signalCount >= 4
      ? {
          boxClass: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
          iconClass: 'text-green-600 dark:text-green-400',
          titleClass: 'text-green-800 dark:text-green-200',
          textClass: 'text-green-700 dark:text-green-300',
          title: '当前市场评估',
          description: `当前已有 ${latestData.signalCount} 个指标进入买入区间，适合按计划分批定投。`,
        }
      : latestData.signalCount === 0
      ? {
          boxClass: 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700',
          iconClass: 'text-gray-600 dark:text-gray-400',
          titleClass: 'text-gray-800 dark:text-gray-200',
          textClass: 'text-gray-700 dark:text-gray-300',
          title: '当前市场评估',
          description: '当前没有指标进入极端低估区域，更适合保持观察或进行小额定投。',
        }
      : latestData.signalCount <= 2
      ? {
          boxClass: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
          iconClass: 'text-blue-600 dark:text-blue-400',
          titleClass: 'text-blue-800 dark:text-blue-200',
          textClass: 'text-blue-700 dark:text-blue-300',
          title: '当前市场评估',
          description: `当前已有 ${latestData.signalCount} 个指标接近买入区间，建议继续关注。`,
        }
      : {
          boxClass: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
          iconClass: 'text-yellow-600 dark:text-yellow-400',
          titleClass: 'text-yellow-800 dark:text-yellow-200',
          textClass: 'text-yellow-700 dark:text-yellow-300',
          title: '当前市场评估',
          description: `当前已有 ${latestData.signalCount} 个指标接近买入区间，市场正在靠近更值得关注的位置。`,
        }
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />

      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500 p-2">
                <Bitcoin className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">BTC 定投指标监控</h1>
                <p className="text-sm text-muted-foreground">基于链上数据的定投辅助看板</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchLatestData('manual')}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              刷新数据
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:inline-grid lg:w-auto">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              <span className="hidden sm:inline">监控面板</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">历史复盘</span>
            </TabsTrigger>
            <TabsTrigger value="guide" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">指标说明</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>数据获取失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {dataSource === 'static' && latestData && (
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800 dark:text-blue-200">当前展示静态快照</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-300">
                  页面优先读取 GitHub Actions 同步到站点的静态数据，适合 Vercel 稳定部署。当前数据日期：{latestData.date}
                </AlertDescription>
              </Alert>
            )}

            {dataSource === 'history' && latestData && (
              <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">当前展示历史回退数据</AlertTitle>
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  静态快照和实时 API 暂时都不可用，当前展示历史数据推导出的最近一条记录。数据日期：{latestData.date}
                </AlertDescription>
              </Alert>
            )}

            {loading && !latestData && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-orange-500" />
                <p className="text-muted-foreground">正在加载数据...</p>
              </div>
            )}

            {latestData && (
              <>
                <SignalOverview
                  btcPrice={latestData.btcPrice}
                  signalCount={latestData.signalCount}
                  totalIndicators={5}
                  lastUpdated={lastUpdated}
                  dataSource={dataSource}
                  latestDataDate={latestData.date}
                  laggingIndicators={laggingIndicators}
                  oldestIndicatorDate={oldestIndicatorDate}
                />

                {laggingIndicators.length > 0 && (
                  <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 dark:text-amber-200">部分指标存在更新滞后</AlertTitle>
                    <AlertDescription className="text-amber-700 dark:text-amber-300">
                      最新记录日期为 {latestData.date}，但 {laggingIndicators.join('、')} 目前仍停留在 {oldestIndicatorDate}。
                    </AlertDescription>
                  </Alert>
                )}

                {historicalData.length > 0 && (
                  <Suspense fallback={<SectionLoader message="正在加载图表..." />}>
                    <IndicatorChartsPanel data={historicalData} />
                  </Suspense>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {indicators.map((indicator) => (
                    <IndicatorCard key={indicator.name} {...indicator} />
                  ))}
                </div>

                {marketAssessment && (
                  <div className={`rounded-lg border p-4 ${marketAssessment.boxClass}`}>
                    <div className="flex items-start gap-3">
                      {latestData.signalCount >= 4 || latestData.signalCount === 0 ? (
                        <TrendingUp className={`mt-0.5 h-6 w-6 ${marketAssessment.iconClass}`} />
                      ) : (
                        <AlertTriangle className={`mt-0.5 h-6 w-6 ${marketAssessment.iconClass}`} />
                      )}

                      <div>
                        <h3 className={`font-semibold ${marketAssessment.titleClass}`}>
                          {marketAssessment.title}
                        </h3>
                        <p className={`mt-1 text-sm ${marketAssessment.textClass}`}>
                          {marketAssessment.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="history">
            {historicalData.length > 0 ? (
              <Suspense fallback={<SectionLoader message="正在加载复盘数据..." />}>
                <HistoryReviewPanel data={historicalData} />
              </Suspense>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-orange-500" />
                <p className="text-muted-foreground">正在加载历史数据...</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="guide">
            <Suspense fallback={<SectionLoader message="正在加载指标说明..." />}>
              <IndicatorExplanationPanel />
            </Suspense>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-12 border-t">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-muted-foreground">
              数据来源: BGeometrics API | 页面默认优先展示静态快照
            </p>
            <p className="text-sm text-muted-foreground">最后更新: {lastUpdated}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
