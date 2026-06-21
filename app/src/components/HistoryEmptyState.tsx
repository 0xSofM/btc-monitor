import { History, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface HistoryEmptyStateProps {
  isLoading: boolean;
  onLoadFullHistory: () => void;
}

export function HistoryEmptyState({
  isLoading,
  onLoadFullHistory,
}: HistoryEmptyStateProps) {
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 py-12">
      {isLoading ? (
        <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
      ) : (
        <History className="h-12 w-12 text-orange-500" />
      )}
      <p className="text-muted-foreground">
        {isLoading ? '正在加载完整历史数据...' : '加载完整历史数据后可查看历史信号记录。'}
      </p>
      {!isLoading && (
        <Button
          size="sm"
          variant="outline"
          onClick={onLoadFullHistory}
        >
          <History className="mr-2 h-4 w-4" />
          加载完整历史数据
        </Button>
      )}
    </div>
  );
}
