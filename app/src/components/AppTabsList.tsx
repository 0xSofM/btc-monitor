import { BookOpen, History, LineChart } from 'lucide-react';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppTab } from '@/appDisplay';

const tabs: Array<{ value: AppTab; label: string; icon: typeof LineChart }> = [
  { value: 'dashboard', label: '仪表盘', icon: LineChart },
  { value: 'history', label: '历史记录', icon: History },
  { value: 'guide', label: '指标说明', icon: BookOpen },
];

export function AppTabsList() {
  return (
    <TabsList className="tab-shell grid w-full grid-cols-3 lg:w-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
