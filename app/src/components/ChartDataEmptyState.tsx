import { AlertTriangle, History, Loader2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ChartDataEmptyStateProps {
  isLoading: boolean;
  onLoadLightHistory: () => void;
}

export function ChartDataEmptyState({
  isLoading,
  onLoadLightHistory,
}: ChartDataEmptyStateProps) {
  return (
    <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <AlertTriangle className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-800 dark:text-blue-200">图表按需加载</AlertTitle>
      <AlertDescription className="text-blue-700 dark:text-blue-300">
        当前优先展示最新信号状态，可按需加载指标图表数据。
        <div className="mt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={onLoadLightHistory}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <History className="mr-2 h-4 w-4" />
            )}
            加载轻量图表数据
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
