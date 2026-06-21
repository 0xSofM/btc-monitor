import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { DataSource } from '@/appDisplay';

interface DataModeAlertsProps {
  dataSource: DataSource;
  hasLatestData: boolean;
  staticAlertDismissed: boolean;
  onDismissStaticAlert: () => void;
}

export function DataModeAlerts({
  dataSource,
  hasLatestData,
  staticAlertDismissed,
  onDismissStaticAlert,
}: DataModeAlertsProps) {
  if (dataSource === 'static' && hasLatestData && !staticAlertDismissed) {
    return (
      <Alert className="relative border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">本地数据模式</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          当前展示本地数据文件中的最新记录。
        </AlertDescription>
        <button
          onClick={onDismissStaticAlert}
          className="absolute right-3 top-3 text-blue-500 hover:text-blue-700"
          aria-label="关闭"
        >
          ×
        </button>
      </Alert>
    );
  }

  if (dataSource === 'history' && hasLatestData) {
    return (
      <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">历史数据模式</AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
          当前展示历史数据中的最新记录。
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
