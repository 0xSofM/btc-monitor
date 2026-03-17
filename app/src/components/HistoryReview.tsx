import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar, Search, X } from 'lucide-react';
import type { IndicatorData } from '@/types';

interface HistoryReviewProps {
  data: IndicatorData[];
}

export function HistoryReview({ data }: HistoryReviewProps) {
  const [minSignals, setMinSignals] = useState(4);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const signalCount = item.signalCount || 0;
      
      // 解析数据日期（格式：YYYY-MM-DD）
      const itemDateStr = item.d;
      const itemDate = new Date(itemDateStr + 'T00:00:00');
      
      if (signalCount < minSignals) return false;
      
      // 日期筛选 - 将输入日期转换为时间戳进行比较
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00').getTime();
        if (itemDate.getTime() < start) return false;
      }
      
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59').getTime();
        if (itemDate.getTime() > end) return false;
      }
      
      return true;
    }).reverse(); // 最新的在前面
  }, [data, minSignals, startDate, endDate]);

  const getSignalBadges = (item: IndicatorData) => {
    const signals = [];
    if (item.signalPriceMa) signals.push('Price/200W-MA');
    if (item.signalMvrvZ) signals.push('MVRV-Z');
    if (item.signalLthMvrv) signals.push('LTH-MVRV');
    if (item.signalPuell) signals.push('Puell');
    if (item.signalNupl) signals.push('NUPL');
    return signals;
  };

  const formatPrice = (price: number | string | undefined) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : (price || 0);
    return `$${numPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getMinPrice = () => {
    if (filteredData.length === 0) return 0;
    return Math.min(...filteredData.map(d => {
      const price = d.btcPrice;
      return typeof price === 'string' ? parseFloat(price) : (price || 0);
    }));
  };

  const getMaxPrice = () => {
    if (filteredData.length === 0) return 0;
    return Math.max(...filteredData.map(d => {
      const price = d.btcPrice;
      return typeof price === 'string' ? parseFloat(price) : (price || 0);
    }));
  };

  const getAvgPrice = () => {
    if (filteredData.length === 0) return 0;
    const sum = filteredData.reduce((a, b) => {
      const price = b.btcPrice;
      return a + (typeof price === 'string' ? parseFloat(price) : (price || 0));
    }, 0);
    return sum / filteredData.length;
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setMinSignals(4);
  };

  const hasActiveFilters = startDate || endDate || minSignals !== 4;

  // 获取数据日期范围
  const dateRange = useMemo(() => {
    if (data.length === 0) return { min: '', max: '' };
    const dates = data.map(d => d.d).sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [data]);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          历史复盘
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 数据范围提示 */}
        <div className="mb-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
          数据范围: {dateRange.min} 至 {dateRange.max} (共 {data.length} 天)
        </div>

        {/* 筛选器 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <Label htmlFor="min-signals">最少信号数</Label>
            <select
              id="min-signals"
              value={minSignals}
              onChange={(e) => setMinSignals(Number(e.target.value))}
              className="w-full mt-1 p-2 border rounded-md bg-background"
            >
              <option value={3}>3个信号 (关注)</option>
              <option value={4}>4个信号 (买入)</option>
              <option value={5}>5个信号 (绝佳)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="start-date">开始日期</Label>
            <Input
              id="start-date"
              type="date"
              min={dateRange.min}
              max={dateRange.max}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="end-date">结束日期</Label>
            <Input
              id="end-date"
              type="date"
              min={dateRange.min}
              max={dateRange.max}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" />
              清除筛选
            </Button>
          </div>
        </div>

        {/* 当前筛选条件显示 */}
        {hasActiveFilters && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
            <span className="font-medium">当前筛选: </span>
            {minSignals !== 4 && <span className="mr-3">信号数 ≥ {minSignals}</span>}
            {startDate && <span className="mr-3">从 {startDate}</span>}
            {endDate && <span className="mr-3">到 {endDate}</span>}
          </div>
        )}

        {/* 统计信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">符合条件的天数</p>
            <p className="text-2xl font-bold">{filteredData.length}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">最低价格</p>
            <p className="text-xl font-bold">
              {filteredData.length > 0 
                ? formatPrice(getMinPrice())
                : '-'
              }
            </p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">最高价格</p>
            <p className="text-xl font-bold">
              {filteredData.length > 0 
                ? formatPrice(getMaxPrice())
                : '-'
              }
            </p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">平均价格</p>
            <p className="text-xl font-bold">
              {filteredData.length > 0 
                ? formatPrice(getAvgPrice())
                : '-'
              }
            </p>
          </div>
        </div>

        {/* 数据表格 */}
        {filteredData.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>BTC价格</TableHead>
                  <TableHead>信号数</TableHead>
                  <TableHead>触发的指标</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.slice(0, 100).map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.d}</TableCell>
                    <TableCell className="font-medium">
                      {formatPrice(item.btcPrice)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={item.signalCount === 5 ? "default" : "secondary"}
                        className={item.signalCount === 5 ? 'bg-green-500' : ''}
                      >
                        {item.signalCount} / 5
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getSignalBadges(item).map((signal, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {signal}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredData.length > 100 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                还有 {filteredData.length - 100} 条记录未显示
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>没有找到符合条件的数据</p>
            <p className="text-sm">请调整筛选条件</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
