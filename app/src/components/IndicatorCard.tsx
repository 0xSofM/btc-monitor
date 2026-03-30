import { Calendar, Minus, TrendingDown } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface IndicatorCardProps {
  name: string;
  description: string;
  currentValue: number;
  targetValue: number;
  targetOperator: 'lt' | 'gt';
  triggered: boolean;
  format: 'price' | 'ratio' | 'number';
  color: string;
  dataDate?: string;
  detailValue?: string;
}

function formatDate(dateStr?: string) {
  if (!dateStr) {
    return '';
  }

  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    return dateStr;
  }

  const [year, month, day] = parts;
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function IndicatorCard({
  name,
  description,
  currentValue,
  targetValue,
  targetOperator,
  triggered,
  format,
  color,
  dataDate,
  detailValue,
}: IndicatorCardProps) {
  const formatValue = (val: number) => {
    if (!Number.isFinite(val)) {
      return '-';
    }

    if (format === 'price') {
      return `$${val.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    if (Math.abs(val) >= 10) {
      return val.toFixed(2);
    }

    if (Math.abs(val) >= 1) {
      return val.toFixed(3);
    }

    return val.toFixed(4);
  };

  const targetText = `${targetOperator === 'lt' ? '<' : '>'} ${formatValue(targetValue)}`;

  return (
    <Card className={`surface-card relative overflow-hidden transition-all duration-300 ${triggered ? 'ring-1 ring-emerald-500/60' : ''}`}>
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: color }} />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">{name}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>

          <Badge
            variant={triggered ? 'default' : 'secondary'}
            className={triggered ? 'bg-emerald-600 text-white hover:bg-emerald-600' : ''}
          >
            {triggered ? (
              <span className="inline-flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                已触发
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Minus className="h-3 w-3" />
                观察中
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-2xl font-bold">{formatValue(currentValue)}</p>

        {detailValue && (
          <div className="mt-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
            {detailValue}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">触发阈值：</span>
          <span className={triggered ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'font-medium'}>
            {targetText}
          </span>
        </div>

        {dataDate && (
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            数据日期：{formatDate(dataDate)}
          </div>
        )}

        {triggered && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            该指标当前位于底部识别区间内。
          </div>
        )}
      </CardContent>
    </Card>
  );
}
