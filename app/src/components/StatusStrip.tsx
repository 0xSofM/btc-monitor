import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

export interface StatusTile {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
}

interface StatusStripProps {
  tiles: StatusTile[];
}

export function StatusStrip({ tiles }: StatusStripProps) {
  if (tiles.length === 0) {
    return null;
  }

  return (
    <section className="status-strip fade-up mb-6">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <article key={tile.label} className="status-chip">
            <div className="status-chip-header">
              <span className="status-icon">
                <Icon className="h-4 w-4" />
              </span>
              <p className="status-label">{tile.label}</p>
            </div>
            <p className="status-value">{tile.value}</p>
            <Badge variant="secondary" className="status-note">{tile.note}</Badge>
          </article>
        );
      })}
    </section>
  );
}
