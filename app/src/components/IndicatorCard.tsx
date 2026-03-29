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
    if (format === 'price') {
      return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return val.toFixed(4);
  };

  const getTargetText = () => {
    const op = targetOperator === 'lt' ? '<' : '>';
    return `${op} ${formatValue(targetValue)}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      return `${year}年${month}月${day}日`;
    }
    return dateStr;
  };

  return (
    <Card className={`relative overflow-hidden transition-all duration-300 ${triggered ? 'ring-2 ring-green-500 shadow-lg shadow-green-500/20' : ''}`}>
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: color }} />

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {name}
          </CardTitle>
          <Badge
            variant={triggered ? 'default' : 'secondary'}
            className={triggered ? 'bg-green-500 hover:bg-green-600' : ''}
          >
            {triggered ? (
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                买入信号
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Minus className="h-3 w-3" />
                观望
              </span>
            )}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>

      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{formatValue(currentValue)}</span>
        </div>

        {detailValue && (
          <div className="mt-2 rounded bg-muted/50 px-2 py-1 text-sm text-muted-foreground">
            {detailValue}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">目标值：</span>
          <span className={`font-medium ${triggered ? 'text-green-600' : 'text-muted-foreground'}`}>
            {getTargetText()}
          </span>
        </div>

        {dataDate && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>数据日期：{formatDate(dataDate)}</span>
          </div>
        )}

        {triggered && (
          <div className="mt-3 rounded-md bg-green-50 p-2 dark:bg-green-950">
            <p className="text-xs font-medium text-green-700 dark:text-green-300">
              指标已达到抄底区间，可作为底部识别信号
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
