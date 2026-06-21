import { Clock3, Database } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

type BadgeDisplay = {
  label: string;
  className: string;
};

type SignalOverviewBadgesProps = {
  sourceBadge: BadgeDisplay;
  priceFreshnessBadge: BadgeDisplay;
  onchainFreshnessBadge: BadgeDisplay;
  dataTimestampLabel: string;
};

export function SignalOverviewBadges({
  sourceBadge,
  priceFreshnessBadge,
  onchainFreshnessBadge,
  dataTimestampLabel,
}: SignalOverviewBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className={sourceBadge.className}>
        <Database className="mr-1 h-3 w-3" />
        {sourceBadge.label}
      </Badge>
      <Badge variant="outline" className={priceFreshnessBadge.className}>
        <Clock3 className="mr-1 h-3 w-3" />
        价格：{priceFreshnessBadge.label}
      </Badge>
      <Badge variant="outline" className={onchainFreshnessBadge.className}>
        <Clock3 className="mr-1 h-3 w-3" />
        链上：{onchainFreshnessBadge.label}
      </Badge>
      <Badge variant="outline" className="text-xs">
        数据更新：{dataTimestampLabel}
      </Badge>
    </div>
  );
}
