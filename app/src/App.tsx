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
  fetchDataManifest,
  fetchFullHistoricalData,
  fetchHistoricalData,
  fetchRuntimeLatestData,
  fetchStaticLatestData,
  getDataFreshnessHours,
  getLatestFromHistory,
} from '@/services/dataService';

import './App.css';

type DataSource = 'api' | 'static' | 'history';
type IndicatorDateKey =
  | 'priceMa200w'
  | 'priceRealized'
  | 'reserveRisk'
  | 'mvrvZscore'
  | 'lthMvrv'
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
  if (source === 'api') return '实时 API';
  if (source === 'history') return '历史回退';
  return '静态快照';
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
  if (score >= thresholds.accumulate) return '分批配置';
  if (score >= thresholds.focus) return '重点关注';
  return '观察';
}

function formatSignalBand(code: string | undefined, score: number, maxScore: number): string {
  if (!code) {
    return scoreBandLabel(score, maxScore);
  }

  const normalized = code.trim().toLowerCase();
  if (normalized === 'watch') return '观察';
  if (normalized === 'focus') return '重点关注';
  if (normalized === 'accumulate') return '分批配置';
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

  return '主模型正常';
}

function hasCore6Coverage(rows: IndicatorData[]): boolean {
  if (!rows.length) {
    return false;
  }

  const recent = rows.slice(-Math.min(rows.length, 365));
  return [
    'priceMa200wRatio',
    'priceRealizedRatio',
    'mvrvZscore',
    'lthMvrv',
    'sthMvrv',
    'puellMultiple',
  ].every((field) =>
    recent.some((row) => {
      const value = row[field as keyof IndicatorData];
      return value !== null && value !== undefined;
    }),
  );
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
      if (fullHistory.length > 0 && hasCore6Coverage(fullHistory)) {
        setHistoricalData(fullHistory);
        setIsFullHistoryLoaded(true);
      } else {
        setIsFullHistoryLoaded(false);
        toast.warning('全量历史加载未通过完整性校验，仍使用当前可用数据。');
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
      if (mode === 'manual') {
        const runtimeData = await fetchRuntimeLatestData();
        if (runtimeData) {
          applyLatestData(runtimeData, 'api');

          const score = runtimeData.totalScoreV4 ?? runtimeData.signalScoreV2 ?? 0;
          const maxScore = runtimeData.maxTotalScoreV4 ?? runtimeData.maxSignalScoreV2 ?? 10;
          toast.success(`V4 运行时已刷新：${score}/${maxScore}`, {
            description: `BTC 价格：$${runtimeData.btcPrice.toLocaleString()}`,
            duration: 6000,
          });
          return;
        }
      }

      const staticData = await fetchStaticLatestData({
        enrichWithHistory: true,
        forceRefresh: mode === 'manual',
      });
      if (staticData) {
        applyLatestData(staticData, 'static');

        if (mode === 'manual') {
          const score = staticData.totalScoreV4 ?? staticData.signalScoreV2 ?? 0;
          const maxScore = staticData.maxTotalScoreV4 ?? staticData.maxSignalScoreV2 ?? 10;
          const scoreLabel = staticData.totalScoreV4 !== undefined ? '运行时不可用，已回退到 V4 快照' : '运行时不可用，已回退到静态快照';
          toast.info(`${scoreLabel}：${score}/${maxScore}`, {
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
          toast.info('静态快照不可用，已切换到历史回退模式。');
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

  const indicatorDateLabels: Partial<Record<IndicatorDateKey, string>> = {
    priceMa200w: 'Price / 200W-MA',
    priceRealized: 'Price / Realized Price',
    mvrvZscore: 'MVRV Z-Score',
    lthMvrv: 'LTH-MVRV',
    sthMvrv: 'STH-MVRV',
    puell: 'Puell Multiple',
  };

  const indicatorDateEntries = latestData?.indicatorDates
    ? (Object.entries(latestData.indicatorDates) as Array<[IndicatorDateKey, string | undefined]>)
        .reduce<Array<[IndicatorDateKey, string]>>((entries, [key, value]) => {
          if (value && indicatorDateLabels[key]) {
            entries.push([key, value]);
          }
          return entries;
        }, [])
    : [];

  const laggingIndicators = latestData
    ? indicatorDateEntries
        .filter(([, value]) => value < latestData.date)
        .map(([key]) => indicatorDateLabels[key] ?? key)
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
  const maxSignalScoreV2 = latestData?.maxSignalScoreV2 ?? 10;
  const totalScoreV4 = latestData?.totalScoreV4;
  const maxTotalScoreV4 = latestData?.maxTotalScoreV4 ?? 12;
  const signalCountDisplay = latestData?.signalCountV4 ?? latestData?.signalCount ?? 0;
  const activeIndicatorCount = latestData?.activeIndicatorCountV4 ?? latestData?.activeIndicatorCount ?? 6;
  const effectiveScore = totalScoreV4 ?? signalScoreV2;
  const effectiveMaxScore = totalScoreV4 !== undefined ? maxTotalScoreV4 : maxSignalScoreV2;
  const effectiveSignalBand = formatSignalBand(
    latestData?.signalBandV4 ?? latestData?.signalBandV2,
    effectiveScore,
    effectiveMaxScore,
  );
  const isSignalConfirmed = latestData?.signalConfirmed3dV4 ?? latestData?.signalConfirmed3d ?? false;
  const fallbackModeLabel = formatFallbackModeLabel(latestData?.fallbackMode);
  const confidencePercent = latestData?.signalConfidence === undefined
    ? null
    : Math.round(latestData.signalConfidence * 100);
  const freshnessPercent = latestData?.dataFreshnessScore === undefined
    ? null
    : Math.round(latestData.dataFreshnessScore * 100);
  const scoreThresholds = resolveScoreThresholds(effectiveMaxScore);

  const statusTiles = useMemo(() => {
    if (!latestData) return [];
    const baseTiles = [
      {
        label: totalScoreV4 !== undefined ? 'V4总分' : 'V2评分',
        value: `${effectiveScore}/${effectiveMaxScore}`,
        note: effectiveSignalBand,
      },
      {
        label: '核心触发',
        value: `${signalCountDisplay}/${activeIndicatorCount}`,
        note: isSignalConfirmed ? '已满足3日确认' : '等待3日确认',
      },
      {
        label: '数据来源',
        value: sourceLabel(dataSource),
        note: `截至 ${latestData.date}`,
      },
    ];

    if (totalScoreV4 === undefined) {
      return baseTiles;
    }

    return [
      baseTiles[0],
      baseTiles[1],
      {
        label: '信号置信度',
        value: confidencePercent === null ? '-' : `${confidencePercent}%`,
        note: fallbackModeLabel ?? (freshnessPercent === null ? '无额外说明' : `数据新鲜度 ${freshnessPercent}%`),
      },
      baseTiles[2],
    ];
  }, [
    latestData,
    totalScoreV4,
    effectiveScore,
    effectiveMaxScore,
    effectiveSignalBand,
    signalCountDisplay,
    activeIndicatorCount,
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
          triggered: latestData.signals.priceMa200w,
          format: 'ratio' as const,
          color: '#F7931A',
          dataDate: latestData.indicatorDates?.priceMa200w || latestData.date,
          detailValue: latestData.ma200w
            ? `BTC $${latestData.btcPrice.toLocaleString()} / 200W-MA $${Math.round(latestData.ma200w).toLocaleString()}`
            : `BTC $${latestData.btcPrice.toLocaleString()}`,
        },
        {
          name: 'Price / Realized Price',
          description: '链上成本锚点',
          currentValue: latestData.priceRealizedRatio,
          targetValue: 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signals.priceRealized,
          format: 'ratio' as const,
          color: '#0EA5E9',
          dataDate: latestData.indicatorDates?.priceRealized || latestData.date,
          detailValue: latestData.realizedPrice ? `Realized Price $${Math.round(latestData.realizedPrice).toLocaleString()}` : undefined,
        },
        {
          name: 'MVRV Z-Score',
          description: '估值温度主刻度',
          currentValue: latestData.mvrvZscore ?? 0,
          targetValue: latestData.thresholds?.mvrvZscoreCore?.trigger ?? latestData.thresholds?.mvrvZscore?.trigger ?? 0,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV4?.mvrvZscore
            ?? latestData.signalMvrvZscoreCore
            ?? latestData.signalMvrvZ
            ?? latestData.signalsV4?.reserveRisk
            ?? false,
          format: 'number' as const,
          color: '#10B981',
          dataDate: latestData.indicatorDates?.mvrvZscore || latestData.date,
          detailValue: latestData.indicatorDates?.reserveRisk
            ? `Reserve Risk 仅作观测：${latestData.reserveRisk.toFixed(6)}（${latestData.indicatorDates.reserveRisk}）`
            : 'Reserve Risk 仅作观测，不参与当前 Core-6 计分。',
        },
        {
          name: 'LTH-MVRV',
          description: '长期持有者成本结构确认',
          currentValue: latestData.lthMvrv ?? 0,
          targetValue: latestData.thresholds?.lthMvrv?.trigger ?? 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV4?.lthMvrv ?? false,
          format: 'ratio' as const,
          color: '#8B5CF6',
          dataDate: latestData.indicatorDates?.lthMvrv || latestData.date,
        },
        {
          name: 'STH-MVRV',
          description: '短期群体压力深度',
          currentValue: latestData.sthMvrv,
          targetValue: latestData.thresholds?.sthMvrv?.trigger ?? 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV4?.sthMvrv ?? latestData.signals.sthMvrv,
          format: 'ratio' as const,
          color: '#22C55E',
          dataDate: latestData.indicatorDates?.sthMvrv || latestData.date,
        },
        {
          name: 'Puell Multiple',
          description: '矿工压力确认项',
          currentValue: latestData.puellMultiple,
          targetValue: latestData.thresholds?.puellMultiple?.trigger ?? 0.6,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV4?.puell ?? latestData.signals.puell,
          format: 'ratio' as const,
          color: '#F97316',
          dataDate: latestData.indicatorDates?.puell || latestData.date,
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
          description: totalScoreV4 !== undefined
            ? `当前 V4 总分 ${effectiveScore}/${effectiveMaxScore}，估值、触发、确认三层已形成共振，可在风控前提下执行高优先级分批建仓。`
            : `当前评分 ${effectiveScore}/${effectiveMaxScore}，市场处于深度价值区间，可在风控前提下执行分批入场。`,
        }
      : effectiveScore >= scoreThresholds.accumulate
      ? {
          boxClass: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50',
          iconClass: 'text-emerald-600 dark:text-emerald-300',
          titleClass: 'text-emerald-800 dark:text-emerald-200',
          textClass: 'text-emerald-700 dark:text-emerald-300',
          title: '分批配置区',
          description: totalScoreV4 !== undefined
            ? `当前 V4 总分 ${effectiveScore}/${effectiveMaxScore}，至少两层信号正在协同改善，适合按计划分批配置。`
            : `当前评分 ${effectiveScore}/${effectiveMaxScore}，信号较强，适合按计划分批配置。`,
        }
      : effectiveScore >= scoreThresholds.focus
      ? {
          boxClass: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50',
          iconClass: 'text-amber-600 dark:text-amber-300',
          titleClass: 'text-amber-800 dark:text-amber-200',
          textClass: 'text-amber-700 dark:text-amber-300',
          title: '重点关注区',
          description: totalScoreV4 !== undefined
            ? `当前 V4 总分 ${effectiveScore}/${effectiveMaxScore}，估值或触发层已有改善，但确认层尚未跟上，适合重点跟踪。`
            : `当前评分 ${effectiveScore}/${effectiveMaxScore}，状态改善中，但尚未进入高确定性区间。`,
        }
      : {
          boxClass: 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60',
          iconClass: 'text-slate-600 dark:text-slate-300',
          titleClass: 'text-slate-800 dark:text-slate-200',
          textClass: 'text-slate-700 dark:text-slate-300',
          title: '观察区',
          description: totalScoreV4 !== undefined
            ? `当前 V4 总分 ${effectiveScore}/${effectiveMaxScore}，底部共振尚未形成，继续等待估值与确认层同步改善。`
            : `当前评分 ${effectiveScore}/${effectiveMaxScore}，暂未出现强大周期底部信号。`,
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
                  <h1 className="text-xl font-bold tracking-tight">BTC 大周期底部监测 V4</h1>
                  <p className="text-sm text-muted-foreground">
                    Core-6 分层模型：估值层 + 触发层 + 确认层，并保留旧版字段用于对照、归档与回滚
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
                <span className="hidden sm:inline">仪表盘</span>
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

            <TabsContent value="dashboard" className="space-y-6 fade-up">
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
                  <AlertTitle className="text-blue-800 dark:text-blue-200">静态快照模式</AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-300">
                    当前优先展示可归档、可回滚的静态快照数据，这是 V4 发布链路的默认模式。
                  </AlertDescription>
                </Alert>
              )}

              {dataSource === 'history' && latestData && (
                <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800 dark:text-yellow-200">历史回退模式</AlertTitle>
                  <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                    快照暂不可用，当前展示本地历史数据中的最新记录，可配合归档快照进行版本回退。
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
                    totalIndicators={activeIndicatorCount}
                    signalScoreV2={latestData.signalScoreV2}
                    maxSignalScoreV2={maxSignalScoreV2}
                    totalScoreV4={latestData.totalScoreV4}
                    maxTotalScoreV4={latestData.maxTotalScoreV4}
                    valuationScore={latestData.valuationScore}
                    maxValuationScore={latestData.maxValuationScore}
                    triggerScore={latestData.triggerScore}
                    maxTriggerScore={latestData.maxTriggerScore}
                    confirmationScore={latestData.confirmationScore}
                    maxConfirmationScore={latestData.maxConfirmationScore}
                    signalConfidence={latestData.signalConfidence}
                    fallbackMode={latestData.fallbackMode}
                    signalConfirmed3d={latestData.signalConfirmed3d}
                    signalConfirmed3dV4={latestData.signalConfirmed3dV4}
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
                      <AlertTitle className="text-amber-800 dark:text-amber-200">检测到指标延迟</AlertTitle>
                      <AlertDescription className="text-amber-700 dark:text-amber-300">
                        最新记录日期为 {latestData.date}。存在延迟的指标：{laggingIndicators.join('、')}（最早更新时间 {oldestIndicatorDate}）。
                      </AlertDescription>
                    </Alert>
                  )}

                  {historicalData.length > 0 ? (
                    <Suspense fallback={<SectionLoader message="正在加载图表工作区..." />}>
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
                      <AlertTitle className="text-blue-800 dark:text-blue-200">图表按需加载</AlertTitle>
                      <AlertDescription className="text-blue-700 dark:text-blue-300">
                        首屏优先展示当前信号状态，你可按需加载历史图表数据。
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
                            加载图表数据
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

                  <Alert className="border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60">
                    <AlertTriangle className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    <AlertTitle className="text-slate-800 dark:text-slate-200">辅助指标：STH-SOPR</AlertTitle>
                    <AlertDescription className="text-slate-700 dark:text-slate-300">
                      当前值 {latestData.sthSopr.toFixed(4)}，触发阈值 {'< '}
                      {(latestData.thresholds?.sthSopr?.trigger ?? 1).toFixed(4)}，
                      当前状态
                      {latestData.signalsV4?.sthSoprAux ?? latestData.signals.sthSopr ? ' 已触发' : ' 观察中'}。
                      该指标保留为辅助观察项，不计入 Core-6 V4 总分。
                      {fallbackModeLabel ? ` 当前回退状态：${fallbackModeLabel}。` : ''}
                    </AlertDescription>
                  </Alert>

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
                <Suspense fallback={<SectionLoader message="正在加载复盘工作区..." />}>
                  <>
                    {!isFullHistoryLoaded && (
                      <Alert className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                        <AlertTriangle className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-800 dark:text-blue-200">历史数据仍在扩展</AlertTitle>
                        <AlertDescription className="text-blue-700 dark:text-blue-300">
                          后台正在补齐全量历史数据，以支持完整复盘。
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
                    {isFullHistoryLoading ? '正在加载全量历史数据...' : '正在加载历史数据...'}
                  </p>
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
          <div className="app-container flex flex-col items-center justify-between gap-3 py-6 text-sm text-muted-foreground md:flex-row">
            <p>数据来源：BGeometrics 文件端点 | 模型：Core-6 V4（分层计分 + MVRV 替换 + 3日确认）</p>
            <p>
              数据时间：{dataTimestampLabel}
              {manifestGeneratedAt ? ` | 清单生成时间：${manifestGeneratedAt}` : ''}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
