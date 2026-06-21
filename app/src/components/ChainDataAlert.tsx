import { Clock3 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ChainDataAlertProps {
  oldestIndicatorDate?: string | null;
}

export function ChainDataAlert({ oldestIndicatorDate }: ChainDataAlertProps) {
  return (
    <Alert className="chain-data-alert border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <Clock3 className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-800 dark:text-blue-200">链上数据说明</AlertTitle>
      <AlertDescription className="text-blue-700 dark:text-blue-300">
        BTC 价格来自实时行情数据；链上指标来自 BGeometrics 数据源，通常存在 1-3 天更新延迟。
        {oldestIndicatorDate && <>当前最早指标日期：{oldestIndicatorDate}。</>}
      </AlertDescription>
    </Alert>
  );
}
