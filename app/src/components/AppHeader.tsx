import {
  Bitcoin,
  Loader2,
  Moon,
  RefreshCw,
  Sun,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

interface AppHeaderProps {
  theme: string | undefined;
  loading: boolean;
  onToggleTheme: () => void;
  onRefresh: () => void;
}

export function AppHeader({
  theme,
  loading,
  onToggleTheme,
  onRefresh,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-container py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="app-brand">
              <Bitcoin className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">基于链上指标的 BTC 大周期底部识别监测</h1>
              <p className="text-sm text-muted-foreground">
                基于估值、短期触发与长期确认指标，监测 BTC 大周期底部识别信号。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="surface-card"
              onClick={onToggleTheme}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="surface-card"
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              刷新
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
