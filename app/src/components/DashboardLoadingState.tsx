import { Loader2 } from 'lucide-react';

interface DashboardLoadingStateProps {
  show: boolean;
}

export function DashboardLoadingState({ show }: DashboardLoadingStateProps) {
  if (!show) {
    return null;
  }

  return (
    <div className="surface-card flex flex-col items-center justify-center py-14">
      <Loader2 className="mb-4 h-12 w-12 animate-spin text-orange-500" />
      <p className="text-muted-foreground">正在加载最新市场状态...</p>
    </div>
  );
}
