import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

import type { StatusTile } from '@/components/StatusStrip';
import type { LatestData } from '@/types';
import type { DataSource } from './appDisplay';
import { sourceLabel } from './appDisplay';

export const TOTAL_CORE_INDICATORS = 8;

export function buildStatusTiles(params: {
  latestData: LatestData;
  dataSource: DataSource;
  hasLayeredScore: boolean;
  effectiveScore: number;
  effectiveMaxScore: number;
  effectiveSignalBand: string;
  signalCountDisplay: number;
  isSignalConfirmed: boolean;
  confidencePercent: number | null;
  fallbackModeLabel: string | null;
  freshnessPercent: number | null;
}): StatusTile[] {
  const baseTiles = [
    {
      label: params.hasLayeredScore ? '综合评分' : '加权评分',
      value: `${params.effectiveScore}/${params.effectiveMaxScore}`,
      note: params.effectiveSignalBand,
      icon: TrendingUp,
    },
    {
      label: '指标触发',
      value: `${params.signalCountDisplay}/${TOTAL_CORE_INDICATORS}`,
      note: params.isSignalConfirmed ? '已确认3日' : '等待确认',
      icon: params.isSignalConfirmed ? CheckCircle2 : AlertTriangle,
    },
    {
      label: '数据来源',
      value: sourceLabel(params.dataSource),
      note: `截至 ${params.latestData.date}`,
      icon: Database,
    },
  ];

  if (!params.hasLayeredScore) {
    return baseTiles;
  }

  return [
    baseTiles[0],
    baseTiles[1],
    {
      label: '信号置信度',
      value: params.confidencePercent === null ? '-' : `${params.confidencePercent}%`,
      note: params.fallbackModeLabel ?? (params.freshnessPercent === null ? '' : `新鲜度 ${params.freshnessPercent}%`),
      icon: ShieldCheck,
    },
    baseTiles[2],
  ];
}
