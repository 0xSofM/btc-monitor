import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import {
  AlertTriangle,
  Bitcoin,
  BookOpen,
  CheckCircle2,
  Clock3,
  Database,
  History,
  LineChart,
  Loader2,
  Moon,
  RefreshCw,
  ShieldCheck,
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
import { StrategyMnavCard } from '@/components/StrategyMnavCard';
import type { IndicatorData, LatestData, StrategyMnavData } from '@/types';
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

type DataSource = 'api' | 'static' | 'history';
type HistoryMode = 'none' | 'light' | 'full';
type IndicatorDateKey =
  | 'priceMa200w'
  | 'mvrvZscore'
  | 'nupl'
  | 'lthMvrv'
  | 'lthSopr'
  | 'sthSopr'
  | 'sthMvrv'
  | 'puell';
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
  if (source === 'api') return '实时数据';
  if (source === 'history') return '历史数据';
  return '本地数据';
}

function formatSnapshotTimestamp(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const iso = new Date(timestamp).toISOString();
  return `${iso.slice(0, 16).replace('T', ' ')} UTC`;
}

function buildDataTimestampLabel(data: LatestData, source: DataSource): string {
  const snapshotTimestamp = formatSnapshotTimestamp(data.lastUpdated);
  return `${snapshotTimestamp ?? data.date} (${sourceLabel(source)})`;
}

function resolveScoreThresholds(maxScore: number) {
  const safeMax = Math.max(1, maxScore);
  return {
    focus: Math.max(1, Math.ceil((safeMax * 4) / 12)),
    accumulate: Math.max(1, Math.ceil((safeMax * 7) / 12)),
    extreme: Math.max(1, Math.ceil((safeMax * 10) / 12)),
  };
}

function scoreBandLabel(score: number, maxScore: number): string {
  const thresholds = resolveScoreThresholds(maxScore);
  if (score >= thresholds.extreme) return '极端底部';
  if (score >= thresholds.accumulate) return '信号增强';
  if (score >= thresholds.focus) return '重点观察';
  return '观察';
}

function formatSignalBand(code: string | undefined, score: number, maxScore: number): string {
  if (!code) {
    return scoreBandLabel(score, maxScore);
  }

  const normalized = code.trim().toLowerCase();
  if (normalized === 'watch') return '观察';
  if (normalized === 'focus') return '重点观察';
  if (normalized === 'accumulate') return '信号增强';
  if (normalized === 'extreme_bottom') return '极端底部';
  return scoreBandLabel(score, maxScore);
}

function formatFallbackModeLabel(fallbackMode: string | undefined): string | null {
  if (!fallbackMode) {
    return null;
  }

  if (fallbackMode === 'mvrv_zscore_inactive') {
    return 'MVRV Z-Score 暂不计分';
  }

  if (fallbackMode === 'valuation_metrics_inactive' || fallbackMode === 'valuation_blend_inactive') {
    return 'MVRV Z / NUPL 暂不计分';
  }

  return '指标正常计分';
}

function toDisplayScore(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeCoreFallbackMode(value: string | undefined): string | undefined {
  return value === 'valuation_blend_inactive' ? 'valuation_metrics_inactive' : value;
}

function resolveCore8Display(latest: LatestData | null) {
  if (!latest) {
    return null;
  }

  const scorePriceMa200w = toDisplayScore(latest.scorePriceMa200w);
  const scoreMvrvZscore = toDisplayScore(latest.scoreMvrvZscoreCore);
  const scoreNupl = toDisplayScore(latest.scoreNuplCore);
  const scorePuell = toDisplayScore(latest.scorePuell);
  const scoreSthMvrv = toDisplayScore(latest.scoreSthMvrv);
  const scoreSthSopr = toDisplayScore(latest.scoreSthSopr);
  const scoreLthMvrv = toDisplayScore(latest.scoreLthMvrv);
  const scoreLthSopr = toDisplayScore(latest.scoreLthSopr);
  const canonicalSignals = latest.canonical?.signals;

  const signals = {
    priceMa200w: canonicalSignals?.priceMa200w ?? latest.signalsV6?.priceMa200w ?? latest.signals.priceMa200w ?? scorePriceMa200w > 0,
    mvrvZscore: canonicalSignals?.mvrvZscore ?? latest.signalsV6?.mvrvZscore ?? latest.signalMvrvZscoreCore ?? scoreMvrvZscore > 0,
    nupl: canonicalSignals?.nupl ?? latest.signalsV6?.nupl ?? latest.signalNuplCore ?? latest.signalNupl ?? scoreNupl > 0,
    puell: canonicalSignals?.puell ?? latest.signalsV6?.puell ?? latest.signalsV4?.puell ?? latest.signals.puell ?? scorePuell > 0,
    sthMvrv: canonicalSignals?.sthMvrv ?? latest.signalsV6?.sthMvrv ?? latest.signalsV4?.sthMvrv ?? latest.signals.sthMvrv ?? scoreSthMvrv > 0,
    sthSopr: canonicalSignals?.sthSoprTrigger
      ?? latest.signalsV6?.sthSoprTrigger
      ?? latest.signalsV4?.sthSoprTrigger
      ?? latest.signals.sthSopr
      ?? scoreSthSopr > 0,
    lthMvrv: canonicalSignals?.lthMvrv ?? latest.signalsV6?.lthMvrv ?? latest.signalsV4?.lthMvrv ?? scoreLthMvrv > 0,
    lthSopr: canonicalSignals?.lthSopr ?? latest.signalsV6?.lthSopr ?? latest.signalsV4?.lthSopr ?? scoreLthSopr > 0,
  };

  const valuationScore = latest.canonical?.score?.valuation ?? (scorePriceMa200w + scoreMvrvZscore + scoreNupl + scorePuell);
  const triggerScore = latest.canonical?.score?.trigger ?? Math.max(scoreSthMvrv, scoreSthSopr);
  const confirmationScore = latest.canonical?.score?.confirmation ?? (scoreLthMvrv + scoreLthSopr);
  const totalScore = latest.canonical?.score?.total ?? (valuationScore + triggerScore + confirmationScore);
  const signalCount = Object.values(signals).filter(Boolean).length;
  const fallbackMode = normalizeCoreFallbackMode(latest.canonical?.fallbackMode ?? latest.fallbackModeV6);

  return {
    signals,
    signalCount: latest.canonical?.signalCount ?? signalCount,
    valuationScore,
    maxValuationScore: 8,
    triggerScore,
    maxTriggerScore: 2,
    confirmationScore,
    maxConfirmationScore: 4,
    totalScore,
    maxTotalScore: latest.canonical?.score?.maxTotal ?? 14,
    fallbackMode,
  };
}

function App() {
  const [latestData, setLatestData] = useState<LatestData | null>(null);
  const [strategyMnavData, setStrategyMnavData] = useState<StrategyMnavData | null>(null);
  const [historicalData, setHistoricalData] = useState<IndicatorData[]>([]);
  const [historyMode, setHistoryMode] = useState<HistoryMode>('none');
  const deferredHistoricalData = useDeferredValue(historicalData);
  const [staticAlertDismissed, setStaticAlertDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataTimestampLabel, setDataTimestampLabel] = useState('-');
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('static');
  const { theme, setTheme } = useTheme();

  const loadHistory = useCallback(async (forceRefresh = false, full = false) => {
    const targetMode: HistoryMode = full ? 'full' : 'light';
    if (
      !forceRefresh
      && historicalData.length > 0
      && (historyMode === targetMode || historyMode === 'full')
    ) {
      return historicalData;
    }

    if (isHistoryLoading) {
      return historicalData;
    }

    setIsHistoryLoading(true);
    try {
      const data = await fetchHistoricalData({ forceRefresh, full });
      if (data.length > 0) {
        setHistoricalData(data);
        setHistoryMode(targetMode);
      }
      return data;
    } catch (err) {
      console.error('Error loading history:', err);
      return historicalData;
    } finally {
      setIsHistoryLoading(false);
    }
  }, [historicalData, historyMode, isHistoryLoading]);

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
    void loadHistory(false, true);
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

  const indicators = latestData
    ? [
        {
          name: 'Price / 200W-MA',
          description: '长周期趋势锚点',
          currentValue: latestData.priceMa200wRatio,
          targetValue: 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV6?.priceMa200w ?? latestData.signals.priceMa200w,
          format: 'ratio' as const,
          color: '#F7931A',
          dataDate: latestData.indicatorDates?.priceMa200w || latestData.date,
          detailValue: latestData.ma200w
            ? `BTC $${latestData.btcPrice.toLocaleString()} / 200W-MA $${Math.round(latestData.ma200w).toLocaleString()}`
            : `BTC $${latestData.btcPrice.toLocaleString()}`,
        },
        {
          name: 'MVRV Z-Score',
          description: '市值相对链上成本的标准化偏离，估值层',
          currentValue: latestData.mvrvZscore ?? 0,
          targetValue: latestData.thresholds?.mvrvZscoreCore?.trigger ?? 0,
          targetOperator: 'lt' as const,
          format: 'number' as const,
          color: '#10B981',
          dataDate: latestData.indicatorDates?.mvrvZscore || latestData.date,
          detailValue: `计分 ${latestData.scoreMvrvZscoreCore ?? 0}/2，深度阈值 < ${(latestData.thresholds?.mvrvZscoreCore?.deep ?? -0.5).toFixed(2)}`,
          triggered: core8Display?.signals.mvrvZscore ?? false,
        },
        {
          name: 'NUPL',
          description: '全网净未实现盈亏，估值层',
          currentValue: latestData.nupl ?? 0,
          targetValue: latestData.thresholds?.nuplCore?.trigger ?? 0.15,
          targetOperator: 'lt' as const,
          format: 'number' as const,
          color: '#0EA5E9',
          dataDate: latestData.indicatorDates?.nupl || latestData.date,
          detailValue: `计分 ${latestData.scoreNuplCore ?? 0}/2，深度阈值 < ${(latestData.thresholds?.nuplCore?.deep ?? 0).toFixed(2)}`,
          triggered: core8Display?.signals.nupl ?? false,
        },
        {
          name: 'Puell Multiple',
          description: '矿工收入压力，估值层',
          currentValue: latestData.puellMultiple,
          targetValue: latestData.thresholds?.puellMultiple?.trigger ?? 0.6,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV6?.puell ?? latestData.signalsV4?.puell ?? latestData.signals.puell,
          format: 'ratio' as const,
          color: '#F97316',
          dataDate: latestData.indicatorDates?.puell || latestData.date,
        },
        {
          name: 'STH-MVRV',
          description: '短期群体压力深度（滚动分位阈值）',
          currentValue: latestData.sthMvrv,
          targetValue: latestData.thresholds?.sthMvrv?.trigger ?? 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV6?.sthMvrv ?? latestData.signalsV4?.sthMvrv ?? latestData.signals.sthMvrv,
          format: 'ratio' as const,
          color: '#22C55E',
          dataDate: latestData.indicatorDates?.sthMvrv || latestData.date,
          detailValue: latestData.thresholds?.sthMvrv
            ? `滚动阈值：1460天 p27=${(latestData.thresholds.sthMvrv.trigger ?? 1).toFixed(4)}，深度 p13.5=${(latestData.thresholds.sthMvrv.deep ?? 0.85).toFixed(4)}`
            : undefined,
        },
        {
          name: 'STH-SOPR',
          description: '短期持有者已实现盈亏，触发层',
          currentValue: latestData.sthSoprMa3 ?? latestData.sthSopr,
          targetValue: latestData.thresholds?.sthSopr?.trigger ?? 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV6?.sthSoprTrigger
            ?? latestData.signalsV4?.sthSoprTrigger
            ?? latestData.signals.sthSopr,
          format: 'ratio' as const,
          color: '#EAB308',
          dataDate: latestData.indicatorDates?.sthSopr || latestData.date,
          detailValue: latestData.thresholds?.sthSopr
            ? `3日均值，原始值 ${(latestData.sthSopr ?? 0).toFixed(4)}；滚动阈值 p27=${(latestData.thresholds.sthSopr.trigger ?? 1).toFixed(4)}，深度 p13.5=${(latestData.thresholds.sthSopr.deep ?? 0.97).toFixed(4)}`
            : `3日均值，原始值 ${(latestData.sthSopr ?? 0).toFixed(4)}`,
        },
        {
          name: 'LTH-MVRV',
          description: '长期持有者未实现盈亏，确认层',
          currentValue: latestData.lthMvrv ?? 0,
          targetValue: latestData.thresholds?.lthMvrv?.trigger ?? 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV6?.lthMvrv ?? latestData.signalsV4?.lthMvrv ?? false,
          format: 'ratio' as const,
          color: '#8B5CF6',
          dataDate: latestData.indicatorDates?.lthMvrv || latestData.date,
        },
        {
          name: 'LTH-SOPR',
          description: '长期持有者已实现盈亏，确认层',
          currentValue: latestData.lthSoprMa3 ?? latestData.lthSopr ?? 0,
          targetValue: latestData.thresholds?.lthSopr?.trigger ?? 0.9,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV6?.lthSopr ?? latestData.signalsV4?.lthSopr ?? false,
          format: 'ratio' as const,
          color: '#A855F7',
          dataDate: latestData.indicatorDates?.lthSopr || latestData.date,
          detailValue: latestData.thresholds?.lthSopr
            ? `3日均值，原始值 ${(latestData.lthSopr ?? 0).toFixed(4)}；滚动阈值 p20=${(latestData.thresholds.lthSopr.trigger ?? 0.9).toFixed(4)}，深度 p10=${(latestData.thresholds.lthSopr.deep ?? 0.75).toFixed(4)}`
            : `3日均值，原始值 ${(latestData.lthSopr ?? 0).toFixed(4)}`,
        },
      ]
    : [];

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
        <header className="app-header">
          <div className="app-container py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="app-brand">
                  <Bitcoin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">基于链上指标的 BTC 大周期底部识别监测</h1>
                  <p className="text-sm text-muted-foreground">
                    基于估值、短期触发与长期确认指标，监测 BTC 大周期底部识别信号。
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
                  刷新
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="app-container py-6">
          {latestData && (
            <section className="status-strip fade-up mb-6">
              {statusTiles.map((tile) => {
                const Icon = tile.icon;
                return (
                  <article key={tile.label} className="status-chip">
                    <div className="status-chip-header">
                      <span className="status-icon">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="status-label">{tile.label}</p>
                    </div>
                    <p className="status-value">{tile.value}</p>
                    <Badge variant="secondary" className="status-note">{tile.note}</Badge>
                  </article>
                );
              })}
            </section>
          )}

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

              {dataSource === 'static' && latestData && !staticAlertDismissed && (
                <Alert className="relative border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800 dark:text-blue-200">本地数据模式</AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-300">
                    当前展示本地数据文件中的最新记录。
                  </AlertDescription>
                  <button
                    onClick={() => setStaticAlertDismissed(true)}
                    className="absolute right-3 top-3 text-blue-500 hover:text-blue-700"
                    aria-label="关闭"
                  >
                    ×
                  </button>
                </Alert>
              )}

              {dataSource === 'history' && latestData && (
                <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800 dark:text-yellow-200">历史数据模式</AlertTitle>
                  <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                    当前展示历史数据中的最新记录。
                  </AlertDescription>
                </Alert>
              )}

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

                  {strategyMnavData && (
                    <StrategyMnavCard data={strategyMnavData} />
                  )}

                  {laggingIndicators.length > 0 && (
                    <Alert className="chain-data-alert border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                      <Clock3 className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-800 dark:text-blue-200">链上数据说明</AlertTitle>
                      <AlertDescription className="text-blue-700 dark:text-blue-300">
                        BTC 价格来自实时行情数据；链上指标来自 BGeometrics 数据源，通常存在 1-3 天更新延迟。
                        {oldestIndicatorDate && <>当前最早指标日期：{oldestIndicatorDate}。</>}
                      </AlertDescription>
                    </Alert>
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
                        isHistoryLoading={isHistoryLoading}
                      />
                    </Suspense>
                  ) : (
                    <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-800 dark:text-blue-200">图表按需加载</AlertTitle>
                      <AlertDescription className="text-blue-700 dark:text-blue-300">
                        当前优先展示最新信号状态，可按需加载指标图表数据。
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void loadHistory(false, true)}
                            disabled={isHistoryLoading}
                          >
                            {isHistoryLoading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <History className="mr-2 h-4 w-4" />
                            )}
                            加载图表数据
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
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
                <div className="surface-card flex flex-col items-center justify-center gap-3 py-12">
                  {isHistoryLoading ? (
                    <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
                  ) : (
                    <History className="h-12 w-12 text-orange-500" />
                  )}
                  <p className="text-muted-foreground">
                    {isHistoryLoading ? '正在加载完整历史数据...' : '加载完整历史数据后可查看历史信号记录。'}
                  </p>
                  {!isHistoryLoading && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void loadHistory(false, true)}
                    >
                      <History className="mr-2 h-4 w-4" />
                      加载完整历史数据
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="guide" className="fade-up">
              <Suspense fallback={<SectionLoader message="正在加载指标说明..." />}>
                <IndicatorExplanationPanel />
              </Suspense>
            </TabsContent>
          </Tabs>
        </main>

        <footer className="footer-line mt-12">
          <div className="app-container flex flex-col gap-2 py-6 text-left text-sm text-muted-foreground">
            <p>数据来源：BGeometrics 链上指标 | Strategy 官方 mNAV | 实时 BTC 价格</p>
            <p>数据时间：{dataTimestampLabel}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
