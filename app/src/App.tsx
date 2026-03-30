import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import {
  AlertTriangle,
  Bitcoin,
  BookOpen,
  Clock3,
  History,
  LineChart,
  Loader2,
  Moon,
  RefreshCw,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IndicatorCard } from '@/components/IndicatorCard';
import { SignalOverview } from '@/components/SignalOverview';
import type { IndicatorData, LatestData } from '@/types';
import {
  fetchAllLatestIndicators,
  fetchDataManifest,
  fetchFullHistoricalData,
  fetchHistoricalData,
  fetchStaticLatestData,
  getDataFreshnessHours,
  getLatestFromHistory,
} from '@/services/dataService';

import './App.css';

type DataSource = 'api' | 'static' | 'history';
type IndicatorDateKey = 'priceMa200w' | 'priceRealized' | 'reserveRisk' | 'sthSopr' | 'sthMvrv' | 'puell';
type AppTab = 'dashboard' | 'history' | 'guide';

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

function sourceLabel(source: DataSource): string {
  if (source === 'api') return 'Live API';
  if (source === 'history') return 'History Fallback';
  return 'Static Snapshot';
}

function scoreBandLabel(score: number): string {
  if (score >= 10) return 'Extreme Bottom';
  if (score >= 7) return 'Accumulate';
  if (score >= 4) return 'Focus';
  return 'Watch';
}

function App() {
  const [latestData, setLatestData] = useState<LatestData | null>(null);
  const [historicalData, setHistoricalData] = useState<IndicatorData[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [manifestGeneratedAt, setManifestGeneratedAt] = useState<string | null>(null);
  const [isLightHistoryLoading, setIsLightHistoryLoading] = useState(false);
  const [isFullHistoryLoaded, setIsFullHistoryLoaded] = useState(false);
  const [isFullHistoryLoading, setIsFullHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataTimestampLabel, setDataTimestampLabel] = useState('-');
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('static');
  const { theme, setTheme } = useTheme();

  const loadLightHistory = useCallback(async () => {
    if (historicalData.length > 0 || isLightHistoryLoading) {
      return;
    }

    setIsLightHistoryLoading(true);
    try {
      const data = await fetchHistoricalData({ mode: 'light' });
      if (data.length > 0) {
        setHistoricalData(data);
      }
      setIsFullHistoryLoaded(false);
    } catch (err) {
      console.error('Error loading light history:', err);
    } finally {
      setIsLightHistoryLoading(false);
    }
  }, [historicalData.length, isLightHistoryLoading]);

  const loadManifest = useCallback(async () => {
    const manifest = await fetchDataManifest();
    if (manifest?.generatedAt) {
      setManifestGeneratedAt(manifest.generatedAt);
    }
  }, []);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  const loadHistoryFallback = useCallback(async () => {
    if (historicalData.length > 0) {
      return historicalData;
    }

    const data = await fetchHistoricalData({ mode: 'light' });
    if (data.length > 0) {
      setHistoricalData(data);
      setIsFullHistoryLoaded(false);
    }
    return data;
  }, [historicalData]);

  const applyLatestData = (data: LatestData, source: DataSource) => {
    setLatestData(data);
    setDataSource(source);
    setDataTimestampLabel(`${data.date} (${sourceLabel(source)})`);
  };

  const ensureFullHistoryLoaded = useCallback(async () => {
    if (isFullHistoryLoaded || isFullHistoryLoading) {
      return;
    }

    setIsFullHistoryLoading(true);
    try {
      const fullHistory = await fetchFullHistoricalData();
      if (fullHistory.length > 0) {
        setHistoricalData(fullHistory);
        setIsFullHistoryLoaded(true);
      }
    } catch (err) {
      console.error('Error loading full history:', err);
    } finally {
      setIsFullHistoryLoading(false);
    }
  }, [isFullHistoryLoaded, isFullHistoryLoading]);

  const fetchLatestData = async (mode: 'auto' | 'manual' = 'auto') => {
    setLoading(true);
    setError(null);

    try {
      if (mode === 'auto') {
        const staticData = await fetchStaticLatestData({ enrichWithHistory: true });
        if (staticData) {
          applyLatestData(staticData, 'static');
          return;
        }
      }

      const latest = await fetchAllLatestIndicators(mode === 'auto');
      if (latest) {
        applyLatestData(latest, 'api');

        const score = latest.signalScoreV2 ?? 0;
        if (mode === 'manual' && score >= 7) {
          toast.success(`V2 signal armed: ${score}/12`, {
            description: `BTC price: $${latest.btcPrice.toLocaleString()}`,
            duration: 8000,
          });
        }
        return;
      }

      throw new Error('No latest data available');
    } catch (err) {
      console.error('Error fetching data:', err);

      const staticData = await fetchStaticLatestData({ enrichWithHistory: true });
      if (staticData) {
        applyLatestData(staticData, 'static');
        if (mode === 'manual') {
          toast.info('Live endpoint unavailable, switched to static snapshot.');
        }
        return;
      }

      const history = await loadHistoryFallback();
      const backupData = getLatestFromHistory(history);
      if (backupData) {
        applyLatestData(backupData, 'history');
        toast.info('Running on history fallback mode.');
        return;
      }

      setError('Failed to load data. Please check connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      void ensureFullHistoryLoaded();
    }
  }, [activeTab, ensureFullHistoryLoaded]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as AppTab);
  };

  useEffect(() => {
    void fetchLatestData('auto');

    const interval = setInterval(() => {
      void fetchLatestData('auto');
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indicatorDateLabels: Record<IndicatorDateKey, string> = {
    priceMa200w: 'Price / 200W MA',
    priceRealized: 'Price / Realized',
    reserveRisk: 'Reserve Risk',
    sthSopr: 'STH-SOPR',
    sthMvrv: 'STH-MVRV',
    puell: 'Puell',
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

  const latestDataAgeHours = latestData ? getDataFreshnessHours(latestData.date) : 0;
  const signalScoreV2 = latestData?.signalScoreV2 ?? 0;

  const statusTiles = useMemo(() => {
    if (!latestData) return [];
    return [
      {
        label: 'V2 Score',
        value: `${signalScoreV2}/12`,
        note: scoreBandLabel(signalScoreV2),
      },
      {
        label: 'Trigger Count',
        value: `${latestData.signalCount}/6`,
        note: latestData.signalConfirmed3d ? '3D confirmed' : 'Awaiting 3D confirm',
      },
      {
        label: 'Source',
        value: sourceLabel(dataSource),
        note: `As of ${latestData.date}`,
      },
    ];
  }, [latestData, signalScoreV2, dataSource]);

  const indicators = latestData
    ? [
        {
          name: 'Price / 200W MA',
          description: 'Long-cycle trend anchor',
          currentValue: latestData.priceMa200wRatio,
          targetValue: 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signals.priceMa200w,
          format: 'ratio' as const,
          color: '#F7931A',
          dataDate: latestData.indicatorDates?.priceMa200w || latestData.date,
          detailValue: latestData.ma200w
            ? `BTC $${latestData.btcPrice.toLocaleString()} / MA200W $${Math.round(latestData.ma200w).toLocaleString()}`
            : `BTC $${latestData.btcPrice.toLocaleString()}`,
        },
        {
          name: 'Price / Realized Price',
          description: 'On-chain cost anchor',
          currentValue: latestData.priceRealizedRatio,
          targetValue: 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signals.priceRealized,
          format: 'ratio' as const,
          color: '#0EA5E9',
          dataDate: latestData.indicatorDates?.priceRealized || latestData.date,
          detailValue: latestData.realizedPrice ? `Realized price $${Math.round(latestData.realizedPrice).toLocaleString()}` : undefined,
        },
        {
          name: 'Reserve Risk',
          description: 'Long-holder risk/reward regime',
          currentValue: latestData.reserveRisk,
          targetValue: latestData.thresholds?.reserveRisk?.trigger ?? 0.0016,
          targetOperator: 'lt' as const,
          triggered: latestData.signals.reserveRisk,
          format: 'number' as const,
          color: '#10B981',
          dataDate: latestData.indicatorDates?.reserveRisk || latestData.date,
        },
        {
          name: 'STH-SOPR',
          description: 'Short-term capitulation pulse',
          currentValue: latestData.sthSopr,
          targetValue: 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signals.sthSopr,
          format: 'ratio' as const,
          color: '#EAB308',
          dataDate: latestData.indicatorDates?.sthSopr || latestData.date,
        },
        {
          name: 'STH-MVRV',
          description: 'Short-term cohort stress depth',
          currentValue: latestData.sthMvrv,
          targetValue: 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signals.sthMvrv,
          format: 'ratio' as const,
          color: '#22C55E',
          dataDate: latestData.indicatorDates?.sthMvrv || latestData.date,
        },
        {
          name: 'Puell Multiple',
          description: 'Miner pressure confirmation',
          currentValue: latestData.puellMultiple,
          targetValue: 0.6,
          targetOperator: 'lt' as const,
          triggered: latestData.signals.puell,
          format: 'ratio' as const,
          color: '#F97316',
          dataDate: latestData.indicatorDates?.puell || latestData.date,
        },
      ]
    : [];

  const marketAssessment = latestData
    ? signalScoreV2 >= 10
      ? {
          boxClass: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/50',
          iconClass: 'text-green-600 dark:text-green-300',
          titleClass: 'text-green-800 dark:text-green-200',
          textClass: 'text-green-700 dark:text-green-300',
          title: 'Extreme Bottom Zone',
          description: `Score ${signalScoreV2}/12. Market is in deep-value territory. Execute staged entries with risk controls.`,
        }
      : signalScoreV2 >= 7
      ? {
          boxClass: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50',
          iconClass: 'text-emerald-600 dark:text-emerald-300',
          titleClass: 'text-emerald-800 dark:text-emerald-200',
          textClass: 'text-emerald-700 dark:text-emerald-300',
          title: 'Accumulation Zone',
          description: `Score ${signalScoreV2}/12. Conditions are constructive for staged accumulation.`,
        }
      : signalScoreV2 >= 4
      ? {
          boxClass: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50',
          iconClass: 'text-amber-600 dark:text-amber-300',
          titleClass: 'text-amber-800 dark:text-amber-200',
          textClass: 'text-amber-700 dark:text-amber-300',
          title: 'Focus Zone',
          description: `Score ${signalScoreV2}/12. Momentum is improving but not yet in high-conviction territory.`,
        }
      : {
          boxClass: 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60',
          iconClass: 'text-slate-600 dark:text-slate-300',
          titleClass: 'text-slate-800 dark:text-slate-200',
          textClass: 'text-slate-700 dark:text-slate-300',
          title: 'Watch Zone',
          description: `Score ${signalScoreV2}/12. No strong cycle-bottom signal at the moment.`,
        }
    : null;

  return (
    <div className="app-shell">
      <div className="app-backdrop" />
      <Toaster position="top-right" />

      <div className="app-content">
        <header className="app-header">
          <div className="app-container py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="app-brand">
                  <Bitcoin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">BTC Cycle Bottom Monitor V2</h1>
                  <p className="text-sm text-muted-foreground">
                    Core-6 model with weighted score and 3-day confirmation
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="surface-card"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="surface-card"
                  onClick={() => void fetchLatestData('manual')}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="app-container py-6">
          {latestData && (
            <section className="status-strip fade-up mb-6">
              {statusTiles.map((tile) => (
                <article key={tile.label} className="status-chip">
                  <div>
                    <p className="status-label">{tile.label}</p>
                    <p className="status-value">{tile.value}</p>
                  </div>
                  <Badge variant="secondary">{tile.note}</Badge>
                </article>
              ))}
            </section>
          )}

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="tab-shell grid w-full grid-cols-3 lg:w-auto">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LineChart className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Review</span>
              </TabsTrigger>
              <TabsTrigger value="guide" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Guide</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6 fade-up">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Data fetch failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {dataSource === 'static' && latestData && (
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800 dark:text-blue-200">Snapshot mode</AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-300">
                    Live endpoint is healthy, but UI is currently rendering the static snapshot first for reliability.
                  </AlertDescription>
                </Alert>
              )}

              {dataSource === 'history' && latestData && (
                <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800 dark:text-yellow-200">Fallback mode</AlertTitle>
                  <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                    API and snapshot were unavailable. Rendering latest value from local historical records.
                  </AlertDescription>
                </Alert>
              )}

              {loading && !latestData && (
                <div className="surface-card flex flex-col items-center justify-center py-14">
                  <Loader2 className="mb-4 h-12 w-12 animate-spin text-orange-500" />
                  <p className="text-muted-foreground">Loading latest market state...</p>
                </div>
              )}

              {latestData && (
                <>
                  <SignalOverview
                    btcPrice={latestData.btcPrice}
                    signalCount={latestData.signalCount}
                    totalIndicators={6}
                    signalScoreV2={latestData.signalScoreV2}
                    signalConfirmed3d={latestData.signalConfirmed3d}
                    dataTimestampLabel={dataTimestampLabel}
                    dataSource={dataSource}
                    latestDataDate={latestData.date}
                    latestDataAgeHours={latestDataAgeHours}
                    laggingIndicators={laggingIndicators}
                    oldestIndicatorDate={oldestIndicatorDate}
                  />

                  {laggingIndicators.length > 0 && (
                    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                      <Clock3 className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-800 dark:text-amber-200">Indicator lag detected</AlertTitle>
                      <AlertDescription className="text-amber-700 dark:text-amber-300">
                        Latest row is {latestData.date}. Lagging series: {laggingIndicators.join(', ')} (oldest update {oldestIndicatorDate}).
                      </AlertDescription>
                    </Alert>
                  )}

                  {historicalData.length > 0 ? (
                    <Suspense fallback={<SectionLoader message="Loading chart workspace..." />}>
                      <IndicatorChartsPanel
                        data={historicalData}
                        isFullHistoryLoaded={isFullHistoryLoaded}
                        isFullHistoryLoading={isFullHistoryLoading}
                        onRequestFullHistory={ensureFullHistoryLoaded}
                      />
                    </Suspense>
                  ) : (
                    <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-800 dark:text-blue-200">Charts are lazy-loaded</AlertTitle>
                      <AlertDescription className="text-blue-700 dark:text-blue-300">
                        First paint prioritizes current signal state. Load historical data when you are ready.
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void loadLightHistory()}
                            disabled={isLightHistoryLoading}
                          >
                            {isLightHistoryLoading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <History className="mr-2 h-4 w-4" />
                            )}
                            Load chart data
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {indicators.map((indicator) => (
                      <IndicatorCard key={indicator.name} {...indicator} />
                    ))}
                  </section>

                  {marketAssessment && (
                    <section className={`surface-card rounded-lg border p-4 ${marketAssessment.boxClass}`}>
                      <div className="flex items-start gap-3">
                        <TrendingUp className={`mt-0.5 h-6 w-6 ${marketAssessment.iconClass}`} />
                        <div>
                          <h3 className={`font-semibold ${marketAssessment.titleClass}`}>
                            {marketAssessment.title}
                          </h3>
                          <p className={`mt-1 text-sm ${marketAssessment.textClass}`}>
                            {marketAssessment.description}
                          </p>
                        </div>
                      </div>
                    </section>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="history" className="fade-up">
              {historicalData.length > 0 ? (
                <Suspense fallback={<SectionLoader message="Loading review workspace..." />}>
                  <>
                    {!isFullHistoryLoaded && (
                      <Alert className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                        <AlertTriangle className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-800 dark:text-blue-200">History still expanding</AlertTitle>
                        <AlertDescription className="text-blue-700 dark:text-blue-300">
                          Full history is being loaded in the background for a complete replay view.
                        </AlertDescription>
                      </Alert>
                    )}
                    <HistoryReviewPanel data={historicalData} />
                  </>
                </Suspense>
              ) : (
                <div className="surface-card flex flex-col items-center justify-center py-12">
                  <Loader2 className="mb-4 h-12 w-12 animate-spin text-orange-500" />
                  <p className="text-muted-foreground">
                    {isFullHistoryLoading ? 'Loading full historical dataset...' : 'Loading historical dataset...'}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="guide" className="fade-up">
              <Suspense fallback={<SectionLoader message="Loading indicator guide..." />}>
                <IndicatorExplanationPanel />
              </Suspense>
            </TabsContent>
          </Tabs>
        </main>

        <footer className="footer-line mt-12">
          <div className="app-container flex flex-col items-center justify-between gap-3 py-6 text-sm text-muted-foreground md:flex-row">
            <p>Data source: BGeometrics file endpoints | Model: Core-6 V2</p>
            <p>
              Data timestamp: {dataTimestampLabel}
              {manifestGeneratedAt ? ` | Manifest generated: ${manifestGeneratedAt}` : ''}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
