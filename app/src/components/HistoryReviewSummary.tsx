import type { FilteredHistoryResult } from './historyReviewSelectors';
import { formatPrice } from './historyReviewSelectors';

interface HistoryReviewSummaryProps {
  filteredHistory: FilteredHistoryResult;
}

export function HistoryReviewSummary({ filteredHistory }: HistoryReviewSummaryProps) {
  const hasRows = filteredHistory.rows.length > 0;

  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <article className="rounded-xl border bg-background/70 p-4">
        <p className="text-sm text-muted-foreground">命中天数</p>
        <p className="text-2xl font-bold">{filteredHistory.rows.length}</p>
      </article>

      <article className="rounded-xl border bg-background/70 p-4">
        <p className="text-sm text-muted-foreground">最低价格</p>
        <p className="text-xl font-semibold">{hasRows ? formatPrice(filteredHistory.minPrice) : '-'}</p>
      </article>

      <article className="rounded-xl border bg-background/70 p-4">
        <p className="text-sm text-muted-foreground">最高价格</p>
        <p className="text-xl font-semibold">{hasRows ? formatPrice(filteredHistory.maxPrice) : '-'}</p>
      </article>

      <article className="rounded-xl border bg-background/70 p-4">
        <p className="text-sm text-muted-foreground">平均价格</p>
        <p className="text-xl font-semibold">{hasRows ? formatPrice(filteredHistory.avgPrice) : '-'}</p>
      </article>
    </section>
  );
}
