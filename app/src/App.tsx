import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { useTheme } from 'next-themes';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AppFooter } from '@/components/AppFooter';
import { AppHeader } from '@/components/AppHeader';
import { AppTabsList } from '@/components/AppTabsList';
import { ChainDataAlert } from '@/components/ChainDataAlert';
import { ChartDataEmptyState } from '@/components/ChartDataEmptyState';
import { DashboardLoadingState } from '@/components/DashboardLoadingState';
import { DataErrorAlert } from '@/components/DataErrorAlert';
import { DataModeAlerts } from '@/components/DataModeAlerts';
import { HistoryEmptyState } from '@/components/HistoryEmptyState';
import { IndicatorCard } from '@/components/IndicatorCard';
import { MarketAssessmentCard } from '@/components/MarketAssessmentCard';
import { SectionLoader } from '@/components/SectionLoader';
import { SignalOverview } from '@/components/SignalOverview';
import { StatusStrip } from '@/components/StatusStrip';
import { StrategyMnavCard } from '@/components/StrategyMnavCard';
import type { LatestData } from '@/types';
import { buildDashboardDisplay } from './appDashboardSelectors';
import type { AppTab, DataSource } from './appDisplay';
import {
  buildIndicatorCards,
  buildDataTimestampLabel,
  resolveCore8Display,
} from './appDisplay';
import { loadDashboardLatestData } from './appLatestLoader';
import { useDashboardHistory } from './useDashboardHistory';
import { useStrategyMnavData } from './useStrategyMnavData';
import {
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

function App() {
  const [latestData, setLatestData] = useState<LatestData | null>(null);
  const {
    historicalData,
    setHistoricalData,
    historyMode,
    deferredHistoricalData,
    isHistoryLoading,
    isFullHistoryLoading,
    loadHistory,
    loadHistoryFallback,
  } = useDashboardHistory();
  const { strategyMnavData, loadStrategyMnav } = useStrategyMnavData();
  const [staticAlertDismissed, setStaticAlertDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [dataTimestampLabel, setDataTimestampLabel] = useState('-');
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('static');
  const { theme, setTheme } = useTheme();

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

      const latestResult = await loadDashboardLatestData(mode, loadHistoryFallback);
      applyLatestData(latestResult.data, latestResult.source);
      if (latestResult.toast?.type === 'success') {
        toast.success(latestResult.toast.message, {
          description: latestResult.toast.description,
          duration: latestResult.toast.duration,
        });
      } else if (latestResult.toast) {
        toast.info(latestResult.toast.message, {
          description: latestResult.toast.description,
          duration: latestResult.toast.duration,
        });
      }
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

  const core8Display = useMemo(() => resolveCore8Display(latestData), [latestData]);
  const dashboardDisplay = useMemo(
    () => buildDashboardDisplay(latestData, core8Display, dataSource),
    [core8Display, dataSource, latestData],
  );
  const indicators = buildIndicatorCards(latestData, core8Display);

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
          {latestData && <StatusStrip tiles={dashboardDisplay.statusTiles} />}

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <AppTabsList />

            <TabsContent value="dashboard" className="space-y-6 fade-up">
              <DataErrorAlert message={error} />

              <DataModeAlerts
                dataSource={dataSource}
                hasLatestData={Boolean(latestData)}
                staticAlertDismissed={staticAlertDismissed}
                onDismissStaticAlert={() => setStaticAlertDismissed(true)}
              />

              <DashboardLoadingState show={loading && !latestData} />

              {latestData && (
                <>
                  <SignalOverview
                    btcPrice={latestData.btcPrice}
                    signalCount={dashboardDisplay.signalCountDisplay}
                    totalIndicators={dashboardDisplay.totalCoreIndicators}
                    signalScoreV2={latestData.signalScoreV2}
                    maxSignalScoreV2={latestData.maxSignalScoreV2 ?? 10}
                    totalScoreV4={dashboardDisplay.totalScoreV4}
                    maxTotalScoreV4={dashboardDisplay.maxTotalScoreV4}
                    totalScoreV6={dashboardDisplay.totalScoreV6}
                    maxTotalScoreV6={dashboardDisplay.maxTotalScoreV6}
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
                    priceFreshnessHours={dashboardDisplay.priceFreshnessHours}
                    onchainFreshnessHours={dashboardDisplay.onchainFreshnessHours}
                    laggingIndicators={dashboardDisplay.laggingIndicators}
                    oldestIndicatorDate={dashboardDisplay.oldestIndicatorDate}
                  />

                  <MarketAssessmentCard assessment={dashboardDisplay.marketAssessment} />

                  {strategyMnavData && (
                    <StrategyMnavCard data={strategyMnavData} />
                  )}

                  {dashboardDisplay.laggingIndicators.length > 0 && (
                    <ChainDataAlert oldestIndicatorDate={dashboardDisplay.oldestIndicatorDate} />
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
