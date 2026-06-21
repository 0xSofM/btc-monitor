import { useMemo, useState } from 'react';
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { IndicatorData } from '@/types';
import { INDICATOR_CONFIG, getIndicatorChartData, getMA200ChartData } from '@/services/dataService';
import type { DetailSeriesPoint, IndicatorType, MaSeriesPoint, SignalMarkerPlan } from './indicatorChartUtils';
import { IndicatorChartLegend } from './IndicatorChartLegend';
import { IndicatorChartsHeader } from './IndicatorChartsHeader';
import { FullHistoryPrompt } from './FullHistoryPrompt';
import { IndicatorTooltip } from './IndicatorChartOverlay';
import { IndicatorMiniCards } from './IndicatorMiniCards';
import { renderSignalMarker, renderSkippedSignalMarker } from './indicatorChartMarkers';
import {
  BTC_PRICE_COMPARE_COLOR,
  CHART_FLOOR_CONFIG,
  INDICATOR_ORDER,
  RANGE_DAYS,
  TIME_RANGES,
  buildSignalMarkerPlan,
  buildThresholdDescription,
  findLatestThresholdPoint,
  formatDate,
  formatDateFromMs,
  formatNumber,
  formatPriceAxis,
  getPaddedDomain,
  parseDateMs,
} from './indicatorChartUtils';

interface IndicatorChartsProps {
  data: IndicatorData[];
  historyMode?: 'none' | 'light' | 'full';
  isHistoryLoading?: boolean;
  isFullHistoryLoading?: boolean;
  onRequestFullHistory?: () => Promise<void> | void;
}

export function IndicatorCharts({
  data,
  historyMode = 'light',
  isHistoryLoading = false,
  isFullHistoryLoading = false,
  onRequestFullHistory,
}: IndicatorChartsProps) {
  const [activeIndicator, setActiveIndicator] = useState<IndicatorType>('priceMa200w');
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [hasRequestedFullHistory, setHasRequestedFullHistory] = useState(false);
  const [showThresholds, setShowThresholds] = useState(true);
  const [selectedRange, setSelectedRange] = useState<(typeof TIME_RANGES)[number]['key']>('all');
  const [brushStartIndex, setBrushStartIndex] = useState(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  const [brushKey, setBrushKey] = useState(0);

  const detailSeries = useMemo(() => {
    if (activeIndicator === 'priceMa200w') {
      return getMA200ChartData(data, 'all').map((point) => ({
        ...point,
        time: parseDateMs(point.date),
        signalValue: point.signal ? point.price : null,
      })) as MaSeriesPoint[];
    }

    return getIndicatorChartData(data, activeIndicator, 'all').map((point) => ({
      ...point,
      time: parseDateMs(point.date),
      signalValue: point.signal && typeof point.value === 'number' ? point.value : null,
    })) as DetailSeriesPoint[];
  }, [activeIndicator, data]);

  const miniSeriesMap = useMemo(() => {
    return {
      priceMa200w: getIndicatorChartData(data, 'priceMa200w', '1y') as DetailSeriesPoint[],
      mvrvZscore: getIndicatorChartData(data, 'mvrvZscore', '1y') as DetailSeriesPoint[],
      nupl: getIndicatorChartData(data, 'nupl', '1y') as DetailSeriesPoint[],
      puell: getIndicatorChartData(data, 'puell', '1y') as DetailSeriesPoint[],
      sthMvrv: getIndicatorChartData(data, 'sthMvrv', '1y') as DetailSeriesPoint[],
      sthSopr: getIndicatorChartData(data, 'sthSopr', '1y') as DetailSeriesPoint[],
      lthMvrv: getIndicatorChartData(data, 'lthMvrv', '1y') as DetailSeriesPoint[],
      lthSopr: getIndicatorChartData(data, 'lthSopr', '1y') as DetailSeriesPoint[],
    };
  }, [data]);

  const config = INDICATOR_CONFIG[activeIndicator];
  const detailThresholdPoint = activeIndicator === 'priceMa200w'
    ? null
    : findLatestThresholdPoint(detailSeries as DetailSeriesPoint[]);
  const thresholdDescription = activeIndicator === 'priceMa200w'
    ? '价格跌破 200W-MA 时通常进入长期底部观察区。'
    : buildThresholdDescription(activeIndicator, detailThresholdPoint);
  const totalPoints = detailSeries.length;
  const historyStartDate = data[0]?.d ?? '-';
  const historyEndDate = data.at(-1)?.d ?? '-';

  const resolvedEndIndex = totalPoints > 0
    ? Math.min(brushEndIndex ?? (totalPoints - 1), totalPoints - 1)
    : 0;

  const resolvedStartIndex = totalPoints > 0
    ? Math.min(brushStartIndex, resolvedEndIndex)
    : 0;
  const visibleDetailSeries = useMemo(() => (
    totalPoints > 0 ? detailSeries.slice(resolvedStartIndex, resolvedEndIndex + 1) : []
  ), [detailSeries, resolvedEndIndex, resolvedStartIndex, totalPoints]);
  const chartDomains = useMemo(() => {
    if (activeIndicator === 'priceMa200w') {
      const visibleValues = (visibleDetailSeries as MaSeriesPoint[])
        .flatMap((row) => [row.price, row.ma200])
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
      const valueDomain = getPaddedDomain(visibleValues, 0.06, 0);

      return {
        valueDomain,
        priceDomain: valueDomain,
      };
    }

    const visibleIndicatorSeries = visibleDetailSeries as DetailSeriesPoint[];
    const values = visibleIndicatorSeries
      .flatMap((row) => [row.value, row.triggerValue])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const priceValues = visibleIndicatorSeries
      .map((row) => row.btcPrice)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    const dataMin = values.length ? Math.min(...values) : 0;
    const dataMax = values.length ? Math.max(...values) : 0;
    const padding = (dataMax - dataMin) * 0.12 || 0.5;

    return {
      valueDomain: [
        Math.min(dataMin - padding, CHART_FLOOR_CONFIG[activeIndicator]),
        dataMax + padding,
      ] as [number, number],
      priceDomain: getPaddedDomain(priceValues, 0.06, 0),
    };
  }, [activeIndicator, visibleDetailSeries]);
  const signalMarkerPlan = useMemo<SignalMarkerPlan>(() => {
    if (!totalPoints) {
      return { keys: new Set<string>(), totalCount: 0, compact: false };
    }

    if (activeIndicator === 'priceMa200w') {
      return buildSignalMarkerPlan(
        detailSeries as MaSeriesPoint[],
        resolvedStartIndex,
        resolvedEndIndex,
        (point) => point.signal,
        (point) => point.date,
      );
    }

    return buildSignalMarkerPlan(
      detailSeries as DetailSeriesPoint[],
      resolvedStartIndex,
      resolvedEndIndex,
      (point) => point.signal && typeof point.value === 'number',
      (point) => point.date,
    );
  }, [activeIndicator, detailSeries, resolvedEndIndex, resolvedStartIndex, totalPoints]);

  const activateIndicator = (indicator: IndicatorType, expandDetail = false) => {
    setActiveIndicator(indicator);
    setSelectedRange('all');
    setBrushStartIndex(0);
    setBrushEndIndex(undefined);
    setBrushKey((prev) => prev + 1);

    if (!expandDetail) {
      return;
    }

    setIsDetailExpanded(true);
    if (historyMode !== 'full') {
      setHasRequestedFullHistory(true);
      void onRequestFullHistory?.();
    }
  };

  const handleTimeRangeSelect = (rangeKey: (typeof TIME_RANGES)[number]['key']) => {
    if (!totalPoints) {
      return;
    }

    const days = RANGE_DAYS[rangeKey];
    const startIndex = rangeKey === 'all' ? 0 : Math.max(0, totalPoints - days);

    setSelectedRange(rangeKey);
    setBrushStartIndex(startIndex);
    setBrushEndIndex(totalPoints - 1);
    setBrushKey((prev) => prev + 1);
  };

  const resetView = () => {
    setSelectedRange('all');
    setBrushStartIndex(0);
    setBrushEndIndex(undefined);
    setBrushKey((prev) => prev + 1);
  };

  const handleBrushChange = (range: { startIndex?: number; endIndex?: number } | null | undefined) => {
    if (!range) {
      return;
    }

    if (typeof range.startIndex === 'number') {
      setBrushStartIndex(range.startIndex);
    }

    if (typeof range.endIndex === 'number') {
      setBrushEndIndex(range.endIndex);
    }
  };

  const renderPriceChart = () => {
    const series = detailSeries as MaSeriesPoint[];
    if (!series.length) {
      return <div className="flex h-[420px] items-center justify-center text-muted-foreground">暂无 MA200 数据</div>;
    }

    const [domainMin, domainMax] = chartDomains.valueDomain;

    return (
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={series} margin={{ top: 10, right: 24, left: 8, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatDateFromMs}
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis yAxisId="left" domain={[domainMin, domainMax]} tick={{ fontSize: 11 }} tickFormatter={formatPriceAxis} />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[domainMin, domainMax]}
            tick={{ fontSize: 11 }}
            tickFormatter={formatPriceAxis}
          />
          <Tooltip content={<IndicatorTooltip />} />

          <Line
            yAxisId="left"
            type="monotone"
            dataKey="price"
            name="BTC Price"
            stroke="#F7931A"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="signalValue"
            name="跌破 200W-MA 信号点"
            stroke="transparent"
            strokeWidth={0}
            dot={(dotProps) => {
              const index = typeof dotProps.index === 'number' ? dotProps.index : -1;
              const payload = dotProps.payload as { date?: string } | undefined;
              const cx = typeof dotProps.cx === 'number' ? dotProps.cx : 0;
              const cy = typeof dotProps.cy === 'number' ? dotProps.cy : 0;
              const key = payload?.date ?? (index >= 0 ? String(index) : `${cx}-${cy}`);

              if (!signalMarkerPlan.keys.has(key)) {
                return renderSkippedSignalMarker(`price-ma200-signal-hidden-${key}`);
              }

              return renderSignalMarker(
                `price-ma200-signal-${key}`,
                cx,
                cy,
                signalMarkerPlan.compact,
              );
            }}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="ma200"
            name="200W-MA"
            stroke="#3B82F6"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
          />

          <Brush
            key={brushKey}
            dataKey="date"
            height={30}
            stroke="#F7931A"
            tickFormatter={formatDate}
            startIndex={brushStartIndex}
            endIndex={resolvedEndIndex}
            onChange={handleBrushChange}
            travellerWidth={8}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderIndicatorChart = () => {
    const series = detailSeries as DetailSeriesPoint[];
    if (!series.length) {
      return <div className="flex h-[420px] items-center justify-center text-muted-foreground">暂无指标数据</div>;
    }

    const [yMin, yMax] = chartDomains.valueDomain;
    const [priceYMin, priceYMax] = chartDomains.priceDomain;

    return (
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={series} margin={{ top: 10, right: 28, left: 8, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatDateFromMs}
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis yAxisId="indicator" tick={{ fontSize: 11 }} domain={[yMin, yMax]} tickFormatter={formatNumber} />
          <YAxis
            yAxisId="price"
            orientation="right"
            domain={[priceYMin, priceYMax]}
            tick={{ fontSize: 11, fill: BTC_PRICE_COMPARE_COLOR }}
            tickFormatter={formatPriceAxis}
            width={54}
          />
          <Tooltip content={<IndicatorTooltip />} />

          {showThresholds && (
            <Line
              yAxisId="indicator"
              type="monotone"
              dataKey="triggerValue"
              name="触发阈值"
              stroke="#10B981"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}

          <Line
            yAxisId="price"
            type="monotone"
            dataKey="btcPrice"
            name="BTC Price"
            stroke={BTC_PRICE_COMPARE_COLOR}
            strokeWidth={1.5}
            strokeDasharray="5 5"
            strokeOpacity={0.72}
            dot={false}
            activeDot={{ r: 4, stroke: BTC_PRICE_COMPARE_COLOR, strokeWidth: 1.5 }}
            connectNulls={false}
            isAnimationActive={false}
          />

          <Line
            yAxisId="indicator"
            type="monotone"
            dataKey="value"
            name={config.name}
            stroke={config.color}
            strokeWidth={2}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="indicator"
            type="monotone"
            dataKey="signalValue"
            name="信号点"
            stroke="transparent"
            strokeWidth={0}
            connectNulls={false}
            dot={(dotProps) => {
              const index = typeof dotProps.index === 'number' ? dotProps.index : -1;
              const payload = dotProps.payload as { date?: string } | undefined;
              const cx = typeof dotProps.cx === 'number' ? dotProps.cx : 0;
              const cy = typeof dotProps.cy === 'number' ? dotProps.cy : 0;
              const key = payload?.date ?? (index >= 0 ? String(index) : `${cx}-${cy}`);

              if (!signalMarkerPlan.keys.has(key)) {
                return renderSkippedSignalMarker(`indicator-signal-hidden-${key}`);
              }

              return renderSignalMarker(
                `indicator-signal-${key}`,
                cx,
                cy,
                signalMarkerPlan.compact,
              );
            }}
            activeDot={false}
            isAnimationActive={false}
          />

          <Brush
            key={brushKey}
            dataKey="date"
            height={30}
            stroke={config.color}
            tickFormatter={formatDate}
            startIndex={brushStartIndex}
            endIndex={resolvedEndIndex}
            onChange={handleBrushChange}
            travellerWidth={8}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className="surface-card mb-6">
      <CardHeader>
        <IndicatorChartsHeader
          historyMode={historyMode}
          historyStartDate={historyStartDate}
          historyEndDate={historyEndDate}
          rowCount={data.length}
          isHistoryLoading={isHistoryLoading}
          isDetailExpanded={isDetailExpanded}
          selectedRange={selectedRange}
          timeRanges={TIME_RANGES}
          showThresholds={showThresholds}
          onSelectRange={handleTimeRangeSelect}
          onResetView={resetView}
          onToggleThresholds={() => setShowThresholds((prev) => !prev)}
          onCollapseDetail={() => setIsDetailExpanded(false)}
        />
      </CardHeader>

      <CardContent>
        <IndicatorMiniCards
          activeIndicator={activeIndicator}
          miniSeriesMap={miniSeriesMap}
          showThresholds={showThresholds}
          onActivateIndicator={(indicatorKey) => activateIndicator(indicatorKey, true)}
        />

        {!isDetailExpanded ? (
          <FullHistoryPrompt />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {INDICATOR_ORDER.map((indicatorKey) => {
                const indicator = INDICATOR_CONFIG[indicatorKey];
                const isActive = indicatorKey === activeIndicator;

                return (
                  <button
                    key={indicatorKey}
                    type="button"
                    onClick={() => activateIndicator(indicatorKey, historyMode !== 'full')}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    style={{ backgroundColor: isActive ? indicator.color : undefined }}
                  >
                    {indicator.name}
                  </button>
                );
              })}
            </div>

            <div className="mb-4 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium" style={{ color: config.color }}>
                {config.name}
              </span>
              <span className="mx-2">|</span>
              <span>{config.description}</span>
              {activeIndicator !== 'priceMa200w' && (
                <>
                  <span className="mx-2">|</span>
                  <span>{thresholdDescription}</span>
                </>
              )}
            </div>

            {historyMode !== 'full' && isFullHistoryLoading ? (
              <div className="flex h-[420px] flex-col items-center justify-center rounded-lg border bg-muted/20 text-muted-foreground">
                <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                <p>正在加载完整历史数据...</p>
              </div>
            ) : (
              <>
                {historyMode !== 'full' && hasRequestedFullHistory && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    完整历史暂不可用，当前使用轻量历史展示。
                  </div>
                )}

                {activeIndicator === 'priceMa200w' ? renderPriceChart() : renderIndicatorChart()}

                <IndicatorChartLegend
                  activeIndicator={activeIndicator}
                  indicatorName={config.name}
                  indicatorColor={config.color}
                  showThresholds={showThresholds}
                  signalCount={signalMarkerPlan.totalCount}
                  thresholdDescription={thresholdDescription}
                />
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
