import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush } from 'recharts';
import type { IndicatorData } from '@/types';
import {
  getIndicatorChartData,
  getMA200ChartData,
  INDICATOR_CONFIG
} from '@/services/dataService';

interface IndicatorChartsProps {
  data: IndicatorData[];
}

type IndicatorType = 'priceMa200w' | 'mvrvZ' | 'lthMvrv' | 'puell' | 'nupl';

// 时间范围配置
const TIME_RANGES = [
  { key: 'all', label: '全部历史' },
  { key: '1y', label: '近一年' },
  { key: '6m', label: '近半年' },
  { key: '1m', label: '近一月' },
  { key: '1w', label: '近一周' }
];

// 击球区配置（买入区间）
const BUY_ZONE_CONFIG = {
  priceMa200w: { min: 0, max: 1, description: '0 ~ 1' },
  mvrvZ: { min: -1, max: 0, description: '-1 ~ 0' },
  lthMvrv: { min: 0, max: 1, description: '0 ~ 1' },
  puell: { min: 0, max: 0.5, description: '0 ~ 0.5' },
  nupl: { min: -1, max: 0, description: '-1 ~ 0' }
};

export function IndicatorCharts({ data }: IndicatorChartsProps) {
  const [activeIndicator, setActiveIndicator] = useState<IndicatorType>('priceMa200w');
  const [brushKey, setBrushKey] = useState(0);
  const [brushStartIndex, setBrushStartIndex] = useState<number>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

  // 获取完整历史数据
  const fullChartData = useMemo(() => {
    if (activeIndicator === 'priceMa200w') {
      return getMA200ChartData(data, 'all');
    }
    return getIndicatorChartData(data, activeIndicator, 'all');
  }, [data, activeIndicator]);

  // 获取指标配置
  const config = INDICATOR_CONFIG[activeIndicator];
  const buyZone = BUY_ZONE_CONFIG[activeIndicator];

  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0].slice(2);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return `${year}/${month}/${day}`;
    }
    return dateStr;
  };

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-900 border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium mb-2">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : entry.value}
            </p>
          ))}
          {payload[0]?.payload?.btcPrice && (
            <p className="text-sm text-muted-foreground mt-1">
              BTC价格: ${Number(payload[0].payload.btcPrice).toLocaleString()}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // 初始化及切换指标时重置滑轮
  useEffect(() => {
    if (fullChartData.length > 0) {
      setBrushStartIndex(0);
      setBrushEndIndex(fullChartData.length - 1);
      setBrushKey(prev => prev + 1);
    }
  }, [activeIndicator, fullChartData.length]);

  // 处理时间范围快捷选择
  const handleTimeRangeSelect = (rangeKey: string) => {
    const totalData = fullChartData.length;
    if (totalData === 0) return;

    let startIndex = 0;
    
    switch (rangeKey) {
      case '1w':
        startIndex = Math.max(0, totalData - 7);
        break;
      case '1m':
        startIndex = Math.max(0, totalData - 30);
        break;
      case '6m':
        startIndex = Math.max(0, totalData - 180);
        break;
      case '1y':
        startIndex = Math.max(0, totalData - 365);
        break;
      case 'all':
      default:
        startIndex = 0;
        break;
    }
    
    setBrushStartIndex(startIndex);
    setBrushEndIndex(totalData - 1);
    setBrushKey(prev => prev + 1);
  };

  // 处理滑轮变化
  const handleBrushChange = (range: any) => {
    if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number') {
      setBrushStartIndex(range.startIndex);
      setBrushEndIndex(range.endIndex);
    }
  };

  // 渲染MA200特殊图表
  const renderMA200Chart = () => {
    const validData = fullChartData as Array<{ date: string; price: number; ma200: number; signal: boolean }>;

    if (validData.length === 0) {
      return (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          暂无MA200数据
        </div>
      );
    }

    // 获取当前可见数据
    const visibleData = (brushStartIndex !== undefined && brushEndIndex !== undefined)
      ? validData.slice(brushStartIndex, brushEndIndex + 1)
      : validData;

    // 基于可见数据计算Y轴范围
    const visiblePrices = visibleData.map(d => d.price).filter(v => v > 0);
    const visibleMA200s = visibleData.map(d => d.ma200).filter(v => v > 0);
    const allVisibleValues = [...visiblePrices, ...visibleMA200s];
    const visibleMin = allVisibleValues.length > 0 ? Math.min(...allVisibleValues) : 0;
    const visibleMax = allVisibleValues.length > 0 ? Math.max(...allVisibleValues) : 0;
    const padding = (visibleMax - visibleMin) * 0.05;
    const yDomainMin = Math.max(0, visibleMin - padding);
    const yDomainMax = visibleMax + padding;

    // 计算可见范围内MA200的变化率
    const visibleMA200Min = visibleMA200s.length > 0 ? Math.min(...visibleMA200s) : 0;
    const visibleMA200Max = visibleMA200s.length > 0 ? Math.max(...visibleMA200s) : 0;
    const ma200ChangePercent = visibleMA200Min > 0 ? ((visibleMA200Max - visibleMA200Min) / visibleMA200Min) * 100 : 0;
    const isMA200Flat = ma200ChangePercent < 5;

    return (
      <>
        {isMA200Flat && (
          <div className="mb-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
            💡 提示：200周均线变化幅度{ma200ChangePercent.toFixed(1)}%，使用右侧独立刻度显示
          </div>
        )}

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={validData} margin={{ top: 5, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            {/* 左Y轴 - BTC价格，基于可见数据动态调整 */}
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
              domain={[yDomainMin, yDomainMax]}
              allowDataOverflow={true}
            />
            {/* 右Y轴 - MA200（当变化很小时使用） */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
              domain={isMA200Flat ? [visibleMA200Min * 0.95, visibleMA200Max * 1.05] : [yDomainMin, yDomainMax]}
              allowDataOverflow={true}
            />
            <Tooltip content={<CustomTooltip />} />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="price"
              name="BTC价格"
              stroke="#F7931A"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId={isMA200Flat ? "right" : "left"}
              type="monotone"
              dataKey="ma200"
              name="200周均线"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
            />

            {/* 底部滑轮 */}
            <Brush
              key={brushKey}
              dataKey="date"
              height={30}
              stroke="#F7931A"
              tickFormatter={formatDate}
              startIndex={brushStartIndex}
              endIndex={brushEndIndex}
              onChange={handleBrushChange}
              travellerWidth={8}
            />
          </LineChart>
        </ResponsiveContainer>
      </>
    );
  };

  // 渲染普通指标图表
  const renderIndicatorChart = () => {
    const validData = fullChartData as Array<{ date: string; value: number; btcPrice?: number; signal: boolean }>;

    if (validData.length === 0) {
      return (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          暂无数据
        </div>
      );
    }

    // 基于可见数据动态计算Y轴范围
    const visibleData = (brushStartIndex !== undefined && brushEndIndex !== undefined)
      ? validData.slice(brushStartIndex, brushEndIndex + 1)
      : validData;
    const values = visibleData.map(d => d.value).filter(v => v !== null && v !== undefined);
    const dataMin = values.length > 0 ? Math.min(...values) : 0;
    const dataMax = values.length > 0 ? Math.max(...values) : 0;
    const range = dataMax - dataMin;
    const padding = range * 0.1 || 0.5;
    // 确保买入区间边界线也在可见范围内
    const yMin = Math.min(dataMin - padding, buyZone.min);
    const yMax = Math.max(dataMax + padding, buyZone.max);


    // Y轴刻度格式化
const formatYAxisValue = (value: number): string => {
if (Math.abs(value) >= 1000) return value.toFixed(0);
if (Math.abs(value) >= 10) return value.toFixed(1);
if (Math.abs(value) >= 1) return value.toFixed(2);
return value.toFixed(3);
};


    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={validData} margin={{ top: 5, right: 30, left: 20, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
					<YAxis tick={{ fontSize: 11 }} tickFormatter={formatYAxisValue} domain={[yMin, yMax]} allowDataOverflow={true} />

          <Tooltip content={<CustomTooltip />} />

          {/* 击球区边界线 */}
          <ReferenceLine
            y={buyZone.max}
            stroke="#10B981"
            strokeDasharray="3 3"
            label={{
              value: `${buyZone.description}`,
              position: 'right',
              fontSize: 10,
              fill: '#10B981'
            }}
          />

          <Line
            type="monotone"
            dataKey="value"
            name={config.name}
            stroke={config.color}
            strokeWidth={2}
            dot={(props: any) => {
              if (props.payload?.signal) {
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={4}
                    fill="#10B981"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }
              return <></>;
            }}
            activeDot={{ r: 6 }}
          />

          {/* 底部滑轮 */}
          <Brush
            key={brushKey}
            dataKey="date"
            height={30}
            stroke={config.color}
            tickFormatter={formatDate}
            startIndex={brushStartIndex}
            endIndex={brushEndIndex}
            onChange={handleBrushChange}
            travellerWidth={8}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg font-semibold">历史指标走势</CardTitle>
          
          {/* 快捷时间范围选择 */}
          <div className="flex gap-1 flex-wrap">
            {TIME_RANGES.map((range) => (
              <button
                key={range.key}
                onClick={() => handleTimeRangeSelect(range.key)}
                className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 transition-colors"
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* 指标选择标签 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(INDICATOR_CONFIG) as IndicatorType[]).map((indicator) => (
            <button
              key={indicator}
              onClick={() => {
                setActiveIndicator(indicator);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeIndicator === indicator
                  ? 'text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              style={{
                backgroundColor: activeIndicator === indicator ? INDICATOR_CONFIG[indicator].color : undefined
              }}
            >
              {INDICATOR_CONFIG[indicator].name}
            </button>
          ))}
        </div>
        
        {/* 图表说明 */}
        <div className="mb-4 text-sm text-muted-foreground">
          <span className="font-medium" style={{ color: config.color }}>{config.name}</span>
          <span className="mx-2">|</span>
          <span>{config.description}</span>
        </div>
        
        {/* 图表 */}
        {activeIndicator === 'priceMa200w' ? renderMA200Chart() : renderIndicatorChart()}
        
        {/* 图例说明 */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }}></div>
            <span>{config.name}</span>
          </div>
          {activeIndicator === 'priceMa200w' ? (
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 bg-blue-500" style={{ borderTop: '2px dashed #3B82F6' }}></div>
              <span>200周均线</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <div className="w-4 h-0.5" style={{ borderTop: '2px dashed #10B981' }}></div>
                <span>买入阈值 ({buyZone.description})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>信号触发点</span>
              </div>
            </>
          )}
        </div>

        {/* 使用说明 */}
        <div className="mt-4 text-xs text-muted-foreground bg-muted/30 rounded p-2">
          💡 <strong>使用提示：</strong>拖动图表底部的滑轮可以调节时间范围，纵坐标会随选择范围自动调整。
          {activeIndicator === 'priceMa200w' && ' 当BTC价格（橙色线）低于200周均线（蓝色虚线）时触发买入信号。'}
        </div>
      </CardContent>
    </Card>
  );
}
