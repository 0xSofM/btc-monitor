import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, Minus, Calendar } from 'lucide-react';

interface IndicatorCardProps {
  name: string;
  description: string;
  currentValue: number;
  targetValue: number;
  targetOperator: 'lt' | 'gt';
  triggered: boolean;
  format: 'price' | 'ratio' | 'number';
  color: string;
  dataDate?: string;  // 数据实际日期
  detailValue?: string;  // 详细数值（如MA200的BTC价格和均线值）
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
  detailValue
}: IndicatorCardProps) {
  const formatValue = (val: number) => {
    if (format === 'price') {
      return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (format === 'ratio') {
      return val.toFixed(4);
    } else {
      return val.toFixed(4);
    }
  };

  const getTargetText = () => {
    const op = targetOperator === 'lt' ? '<' : '>';
    return `${op} ${formatValue(targetValue)}`;
  };

  // 格式化日期显示 - 包含年份
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return `${year}年${month}月${day}日`;
    }
    return dateStr;
  };

  return (
    <Card className={`relative overflow-hidden transition-all duration-300 ${triggered ? 'ring-2 ring-green-500 shadow-lg shadow-green-500/20' : ''}`}>
      <div 
        className="absolute top-0 left-0 w-1 h-full" 
        style={{ backgroundColor: color }}
      />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {name}
          </CardTitle>
          <Badge 
            variant={triggered ? "default" : "secondary"}
            className={triggered ? 'bg-green-500 hover:bg-green-600' : ''}
          >
            {triggered ? (
              <span className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                买入信号
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Minus className="w-3 h-3" />
                观望
              </span>
            )}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {/* 主数值 */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            {formatValue(currentValue)}
          </span>
        </div>
        
        {/* 详细数值（如MA200的分解） */}
        {detailValue && (
          <div className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded px-2 py-1">
            {detailValue}
          </div>
        )}
        
        {/* 目标值 */}
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">目标:</span>
          <span className={`font-medium ${triggered ? 'text-green-600' : 'text-muted-foreground'}`}>
            {getTargetText()}
          </span>
        </div>
        
        {/* 数据日期 */}
        {dataDate && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>数据日期: {formatDate(dataDate)}</span>
          </div>
        )}
        
        {triggered && (
          <div className="mt-3 p-2 bg-green-50 dark:bg-green-950 rounded-md">
            <p className="text-xs text-green-700 dark:text-green-300 font-medium">
              指标已达到买入区间，建议定投
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
