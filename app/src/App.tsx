import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Database,
  History,
  LineChart,
  Loader2,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppFooter } from '@/components/AppFooter';
import { AppHeader } from '@/components/AppHeader';
import { ChainDataAlert } from '@/components/ChainDataAlert';
import { ChartDataEmptyState } from '@/components/ChartDataEmptyState';
import { DataModeAlerts } from '@/components/DataModeAlerts';
import { HistoryEmptyState } from '@/components/HistoryEmptyState';
import { IndicatorCard } from '@/components/IndicatorCard';
import { MarketAssessmentCard } from '@/components/MarketAssessmentCard';
import { SignalOverview } from '@/components/SignalOverview';
import { StatusStrip } from '@/components/StatusStrip';
import { StrategyMnavCard } from '@/components/StrategyMnavCard';
import type { IndicatorData, LatestData, StrategyMnavData } from '@/types';
import type { AppTab, DataSource, HistoryMode, IndicatorDateKey } from './appDisplay';
import {
  buildIndicatorCards,
  buildDataTimestampLabel,
  formatFallbackModeLabel,
  formatSignalBand,
  resolveCore8Display,
  resolveScoreThresholds,
  sourceLabel,
} from './appDisplay';
import {
  fetchHistoricalData,
  fetchRuntimeLatestData,
  fetchStaticLatestData,
  fetchStrategyMnavData,
  getEffectiveDataDate,
  getPriceFreshnessHours,
  getOnchainFreshnessHours,
  getLatestFromHistory,
  mergeLatestIntoHistory,
} from '@/services/dataService';

import './App.css';

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
  const [strategyMnavData, setStrategyMnavData] = useState<StrategyMnavData | null>(null);
  const [historicalData, setHistoricalData] = useState<IndicatorData[]>([]);
  const [historyMode, setHistoryMode] = useState<HistoryMode>('none');
  const historyModeRef = useRef<HistoryMode>('none');
  const historyLoadingModesRef = useRef<Set<HistoryMode>>(new Set());
  const deferredHistoricalData = useDeferredValue(historicalData);
  const [staticAlertDismissed, setStaticAlertDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [historyLoadingModes, setHistoryLoadingModes] = useState<HistoryMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataTimestampLabel, setDataTimestampLabel] = useState('-');
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('static');
  const { theme, setTheme } = useTheme();
  const isHistoryLoading = historyLoadingModes.length > 0;
  const isFullHistoryLoading = historyLoadingModes.includes('full');

  useEffect(() => {
    historyModeRef.current = historyMode;
  }, [historyMode]);

  const beginHistoryLoad = useCallback((mode: HistoryMode) => {
    historyLoadingModesRef.current.add(mode);
    setHistoryLoadingModes(Array.from(historyLoadingModesRef.current));
  }, []);

  const endHistoryLoad = useCallback((mode: HistoryMode) => {
    historyLoadingModesRef.current.delete(mode);
    setHistoryLoadingModes(Array.from(historyLoadingModesRef.current));
  }, []);

  const loadHistory = useCallback(async (forceRefresh = false, full = false) => {
    const targetMode: HistoryMode = full ? 'full' : 'light';
    if (
      !forceRefresh
      && historicalData.length > 0
      && (historyModeRef.current === targetMode || historyModeRef.current === 'full')
    ) {
      return historicalData;
    }

    if (
      historyLoadingModesRef.current.has(targetMode)
      || (targetMode === 'light' && historyLoadingModesRef.current.has('full'))
    ) {
      return historicalData;
    }

    beginHistoryLoad(targetMode);
    try {
      const data = await fetchHistoricalData({ forceRefresh, full });
      if (data.length > 0) {
        if (targetMode === 'full' || historyModeRef.current !== 'full') {
          historyModeRef.current = targetMode;
          setHistoricalData(data);
          setHistoryMode(targetMode);
        }
      }
      return data;
    } catch (err) {
      console.error('Error loading history:', err);
      return historicalData;
    } finally {
      endHistoryLoad(targetMode);
    }
  }, [beginHistoryLoad, endHistoryLoad, historicalData]);

  const loadStrategyMnav = useCallback(async (forceRefresh = false) => {
    const data = await fetchStrategyMnavData(forceRefresh);
    if (data) {
      setStrategyMnavData(data);
    }
    return data;
  }, []);

  useEffect(() => {
    void loadStrategyMnav(false);
  }, [loadStrategyMnav]);

  const loadHistoryFallback = useCallback(async () => {
    if (historicalData.length > 0) {
      return historicalData;
    }

    return loadHistory(false, false);
  }, [historicalData, loadHistory]);

  const applyLatestData = (data: LatestData, source: DataSource) => {
    setLatestData(data);
    setDataSource(source);
    setDataTimestampLabel(buildDataTimestampLabel(data, source));
    setHistoricalData((currentHistory) => (
      currentHistory.length > 0
        ? mergeLatestIntoHistory(currentHistory, data)
        : currentHistory
    ));
  };

  const fetchLatestData = async (mode: 'auto' | 'manual' = 'auto') => {
    setLoading(true);
    setError(null);

    try {
      void loadStrategyMnav(mode === 'manual');

      // Always try runtime first (Edge Function fetches live BGeometrics data).
      // Falls back to static JSON silently on failure.
      const runtimeData = await fetchRuntimeLatestData();
      if (runtimeData) {
        applyLatestData(runtimeData, 'api');

        if (mode === 'manual') {
          const score = runtimeData.totalScoreV6 ?? runtimeData.totalScoreV4 ?? runtimeData.signalScoreV2 ?? 0;
          const maxScore = runtimeData.maxTotalScoreV6 ?? runtimeData.maxTotalScoreV4 ?? runtimeData.maxSignalScoreV2 ?? 10;
          toast.success(`最新数据已刷新：${score}/${maxScore}`, {
            description: `BTC 价格：$${runtimeData.btcPrice.toLocaleString()}`,
            duration: 6000,
          });
        }
        return;
      }

      const staticData = await fetchStaticLatestData({
        enrichWithHistory: true,
        forceRefresh: mode === 'manual',
      });
      if (staticData) {
        applyLatestData(staticData, 'static');

        if (mode === 'manual') {
          toast.info('实时数据暂不可用，已展示本地数据。', {
            description: `BTC 价格：$${staticData.btcPrice.toLocaleString()}`,
            duration: 6000,
          });
        }
        return;
      }

      const history = await loadHistoryFallback();
      const backupData = getLatestFromHistory(history);
      if (backupData) {
        applyLatestData(backupData, 'history');
        if (mode === 'manual') {
          toast.info('最新数据暂不可用，已展示历史数据。');
        }
        return;
      }

      throw new Error('无可用最新数据');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('数据加载失败，请检查连接后重试。');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as AppTab);
    if (value === 'history') {
      void loadHistory(false, true);
    }
  };

  useEffect(() => {
    void loadHistory(false, false);
  }, [loadHistory]);

  useEffect(() => {
    void fetchLatestData('auto');

    // Refresh every 15 min — BGeometrics on-chain data updates ~daily,
    // so 5 min is wasteful and risks rate-limiting a free service.
    const interval = setInterval(() => {
      void fetchLatestData('auto');
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indicatorDateLabels: Partial<Record<IndicatorDateKey, string>> = {
    priceMa200w: 'Price / 200W-MA',
    mvrvZscore: 'MVRV Z-Score',
    nupl: 'NUPL',
    lthMvrv: 'LTH-MVRV',
    lthSopr: 'LTH-SOPR',
    sthSopr: 'STH-SOPR',
    sthMvrv: 'STH-MVRV',
    puell: 'Puell Multiple',
  };

  const indicatorDateEntries = latestData
    ? ([
        ['priceMa200w', latestData.indicatorDates?.priceMa200w],
        ['mvrvZscore', latestData.indicatorDates?.mvrvZscore],
        ['nupl', latestData.indicatorDates?.nupl],
        ['puell', latestData.indicatorDates?.puell],
        ['sthMvrv', latestData.indicatorDates?.sthMvrv],
        ['sthSopr', latestData.indicatorDates?.sthSopr],
        ['lthMvrv', latestData.indicatorDates?.lthMvrv],
        ['lthSopr', latestData.indicatorDates?.lthSopr],
      ] as Array<[IndicatorDateKey, string | undefined]>)
        .filter((entry): entry is [IndicatorDateKey, string] => Boolean(entry[1]))
    : [];

  const laggingIndicators = latestData
    ? indicatorDateEntries
        .filter(([, value]) => value < latestData.date)
        .map(([key]) => indicatorDateLabels[key] ?? key)
    : [];

  const effectiveDataDate = latestData
    ? getEffectiveDataDate(latestData.date, latestData.indicatorDates)
    : '';

  const oldestIndicatorDate = latestData && effectiveDataDate < latestData.date
    ? effectiveDataDate
    : undefined;

  const priceFreshnessHours = latestData
    ? getPriceFreshnessHours(latestData.indicatorDates)
    : 0;
  const onchainFreshnessHours = latestData
    ? getOnchainFreshnessHours(latestData.date, latestData.indicatorDates)
    : 0;
  const signalScoreV2 = latestData?.signalScoreV2 ?? 0;
  const maxSignalScoreV2 = latestData?.maxSignalScoreV2 ?? 10;
  const core8Display = resolveCore8Display(latestData);
  const totalScoreV6 = core8Display?.totalScore ?? latestData?.totalScoreV6;
  const maxTotalScoreV6 = core8Display?.maxTotalScore ?? latestData?.maxTotalScoreV6 ?? 14;
  const totalScoreV4 = latestData?.totalScoreV4;
  const maxTotalScoreV4 = latestData?.maxTotalScoreV4 ?? 14;
  const hasLayeredScore = totalScoreV6 !== undefined || totalScoreV4 !== undefined;
  const signalCountDisplay = core8Display?.signalCount ?? latestData?.signalCountV6 ?? latestData?.signalCountV4 ?? latestData?.signalCount ?? 0;
  const totalCoreIndicators = 8;
  const effectiveScore = totalScoreV6 ?? totalScoreV4 ?? signalScoreV2;
  const effectiveMaxScore = totalScoreV6 !== undefined
    ? maxTotalScoreV6
    : totalScoreV4 !== undefined
      ? maxTotalScoreV4
      : maxSignalScoreV2;
  const effectiveSignalBand = formatSignalBand(
    latestData?.signalBandV6 ?? latestData?.signalBandV4 ?? latestData?.signalBandV2,
    effectiveScore,
    effectiveMaxScore,
  );
  const isSignalConfirmed = latestData?.signalConfirmed3dV6 ?? latestData?.signalConfirmed3dV4 ?? latestData?.signalConfirmed3d ?? false;
  const fallbackModeLabel = formatFallbackModeLabel(core8Display?.fallbackMode ?? latestData?.fallbackModeV6 ?? latestData?.fallbackMode);
  const confidenceValue = latestData?.signalConfidenceV6 ?? latestData?.signalConfidence;
  const freshnessValue = latestData?.dataFreshnessScoreV6 ?? latestData?.dataFreshnessScore;
  const confidencePercent = confidenceValue === undefined
    ? null
    : Math.round(confidenceValue * 100);
  const freshnessPercent = freshnessValue === undefined
    ? null
    : Math.round(freshnessValue * 100);
  const scoreThresholds = resolveScoreThresholds(effectiveMaxScore);

  const statusTiles = useMemo(() => {
    if (!latestData) return [];
    const baseTiles = [
      {
        label: hasLayeredScore ? '综合评分' : '加权评分',
        value: `${effectiveScore}/${effectiveMaxScore}`,
        note: effectiveSignalBand,
        icon: TrendingUp,
      },
      {
        label: '指标触发',
        value: `${signalCountDisplay}/${totalCoreIndicators}`,
        note: isSignalConfirmed ? '已确认3日' : '等待确认',
        icon: isSignalConfirmed ? CheckCircle2 : AlertTriangle,
      },
      {
        label: '数据来源',
        value: sourceLabel(dataSource),
        note: `截至 ${latestData.date}`,
        icon: Database,
      },
    ];

    if (!hasLayeredScore) {
      return baseTiles;
    }

    return [
      baseTiles[0],
      baseTiles[1],
      {
        label: '信号置信度',
        value: confidencePercent === null ? '-' : `${confidencePercent}%`,
        note: fallbackModeLabel ?? (freshnessPercent === null ? '' : `新鲜度 ${freshnessPercent}%`),
        icon: ShieldCheck,
      },
      baseTiles[2],
    ];
  }, [
    latestData,
    hasLayeredScore,
    effectiveScore,
    effectiveMaxScore,
    effectiveSignalBand,
    signalCountDisplay,
    isSignalConfirmed,
    confidencePercent,
    fallbackModeLabel,
    freshnessPercent,
    dataSource,
  ]);

  const indicators = buildIndicatorCards(latestData, core8Display);

  const marketAssessment = latestData
    ? effectiveScore >= scoreThresholds.extreme
      ? {
          boxClass: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/50',
          iconClass: 'text-green-600 dark:text-green-300',
          titleClass: 'text-green-800 dark:text-green-200',
          textClass: 'text-green-700 dark:text-green-300',
          title: '极端底部区',
          description: hasLayeredScore
            ? `当前总分 ${effectiveScore}/${effectiveMaxScore}，估值、触发、确认三层指标形成较强一致性。`
            : `当前评分 ${effectiveScore}/${effectiveMaxScore}，多个底部识别指标处于深度区域。`,
        }
      : effectiveScore >= scoreThresholds.accumulate
      ? {
          boxClass: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50',
          iconClass: 'text-emerald-600 dark:text-emerald-300',
          titleClass: 'text-emerald-800 dark:text-emerald-200',
          textClass: 'text-emerald-700 dark:text-emerald-300',
          title: '信号增强区',
          description: hasLayeredScore
            ? `当前总分 ${effectiveScore}/${effectiveMaxScore}，至少两层指标显示底部识别信号增强。`
            : `当前评分 ${effectiveScore}/${effectiveMaxScore}，底部识别信号较强。`,
        }
      : effectiveScore >= scoreThresholds.focus
      ? {
          boxClass: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50',
          iconClass: 'text-amber-600 dark:text-amber-300',
          titleClass: 'text-amber-800 dark:text-amber-200',
          textClass: 'text-amber-700 dark:text-amber-300',
          title: '重点观察区',
          description: hasLayeredScore
            ? `当前总分 ${effectiveScore}/${effectiveMaxScore}，部分指标进入底部识别区间，确认信号仍需观察。`
            : `当前评分 ${effectiveScore}/${effectiveMaxScore}，部分底部识别信号已出现。`,
        }
      : {
          boxClass: 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60',
          iconClass: 'text-slate-600 dark:text-slate-300',
          titleClass: 'text-slate-800 dark:text-slate-200',
          textClass: 'text-slate-700 dark:text-slate-300',
          title: '观察区',
          description: hasLayeredScore
            ? `当前总分 ${effectiveScore}/${effectiveMaxScore}，底部识别信号尚未形成一致性。`
            : `当前评分 ${effectiveScore}/${effectiveMaxScore}，暂未出现明确的大周期底部信号。`,
        }
    : null;

  return (
    <div className="app-shell">
      <Toaster position="top-right" />

      <div className="app-content">
        <AppHeader
          theme={theme}
          loading={loading}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onRefresh={() => void fetchLatestData('manual')}
        />

        <main className="app-container py-6">
          {latestData && <StatusStrip tiles={statusTiles} />}

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="tab-shell grid w-full grid-cols-3 lg:w-auto">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LineChart className="h-4 w-4" />
                <span className="hidden sm:inline">仪表盘</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">历史记录</span>
              </TabsTrigger>
              <TabsTrigger value="guide" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">指标说明</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6 fade-up">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>数据获取失败</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <DataModeAlerts
                dataSource={dataSource}
                hasLatestData={Boolean(latestData)}
                staticAlertDismissed={staticAlertDismissed}
                onDismissStaticAlert={() => setStaticAlertDismissed(true)}
              />

              {loading && !latestData && (
                <div className="surface-card flex flex-col items-center justify-center py-14">
                  <Loader2 className="mb-4 h-12 w-12 animate-spin text-orange-500" />
                  <p className="text-muted-foreground">正在加载最新市场状态...</p>
                </div>
              )}

              {latestData && (
                <>
                  <SignalOverview
                    btcPrice={latestData.btcPrice}
                    signalCount={signalCountDisplay}
                    totalIndicators={totalCoreIndicators}
                    signalScoreV2={latestData.signalScoreV2}
                    maxSignalScoreV2={maxSignalScoreV2}
                    totalScoreV4={latestData.totalScoreV4}
                    maxTotalScoreV4={latestData.maxTotalScoreV4}
                    totalScoreV6={core8Display?.totalScore ?? latestData.totalScoreV6}
                    maxTotalScoreV6={core8Display?.maxTotalScore ?? latestData.maxTotalScoreV6}
                    valuationScore={core8Display?.valuationScore ?? latestData.valuationScoreV6 ?? latestData.valuationScore}
                    maxValuationScore={core8Display?.maxValuationScore ?? latestData.maxValuationScoreV6 ?? latestData.maxValuationScore}
                    triggerScore={core8Display?.triggerScore ?? latestData.triggerScoreV6 ?? latestData.triggerScore}
                    maxTriggerScore={core8Display?.maxTriggerScore ?? latestData.maxTriggerScoreV6 ?? latestData.maxTriggerScore}
                    confirmationScore={core8Display?.confirmationScore ?? latestData.confirmationScoreV6 ?? latestData.confirmationScore}
                    maxConfirmationScore={core8Display?.maxConfirmationScore ?? latestData.maxConfirmationScoreV6 ?? latestData.maxConfirmationScore}
                    signalConfidence={latestData.signalConfidenceV6 ?? latestData.signalConfidence}
                    fallbackMode={core8Display?.fallbackMode ?? latestData.fallbackModeV6 ?? latestData.fallbackMode}
                    signalConfirmed3d={latestData.signalConfirmed3d}
                    signalConfirmed3dV4={latestData.signalConfirmed3dV4}
                    signalConfirmed3dV6={latestData.signalConfirmed3dV6}
                    dataTimestampLabel={dataTimestampLabel}
                    dataSource={dataSource}
                    latestDataDate={latestData.date}
                    priceFreshnessHours={priceFreshnessHours}
                    onchainFreshnessHours={onchainFreshnessHours}
                    laggingIndicators={laggingIndicators}
                    oldestIndicatorDate={oldestIndicatorDate}
                  />

                  <MarketAssessmentCard assessment={marketAssessment} />

                  {strategyMnavData && (
                    <StrategyMnavCard data={strategyMnavData} />
                  )}

                  {laggingIndicators.length > 0 && (
                    <ChainDataAlert oldestIndicatorDate={oldestIndicatorDate} />
                  )}

                  <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {indicators.map((indicator) => (
                      <IndicatorCard key={indicator.name} {...indicator} />
                    ))}
                  </section>

                  {historicalData.length > 0 ? (
                    <Suspense fallback={<SectionLoader message="正在加载指标图表..." />}>
                      <IndicatorChartsPanel
                        data={deferredHistoricalData}
                        historyMode={historyMode}
                        isHistoryLoading={isHistoryLoading}
                        isFullHistoryLoading={isFullHistoryLoading}
                        onRequestFullHistory={() => {
                          void loadHistory(false, true);
                        }}
                      />
                    </Suspense>
                  ) : (
                    <ChartDataEmptyState
                      isLoading={isHistoryLoading}
                      onLoadLightHistory={() => void loadHistory(false, false)}
                    />
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="history" className="fade-up">
              {historyMode === 'full' && historicalData.length > 0 ? (
                <Suspense fallback={<SectionLoader message="正在加载历史记录..." />}>
                  <HistoryReviewPanel data={deferredHistoricalData} />
                </Suspense>
              ) : (
                <HistoryEmptyState
                  isLoading={isHistoryLoading}
                  onLoadFullHistory={() => void loadHistory(false, true)}
                />
              )}
            </TabsContent>

            <TabsContent value="guide" className="fade-up">
              <Suspense fallback={<SectionLoader message="正在加载指标说明..." />}>
                <IndicatorExplanationPanel />
              </Suspense>
            </TabsContent>
          </Tabs>
        </main>

        <AppFooter dataTimestampLabel={dataTimestampLabel} />
      </div>
    </div>
  );
}

export default App;
