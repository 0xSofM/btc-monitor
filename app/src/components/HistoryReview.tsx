import { useMemo, useState } from 'react';
import { Calendar, Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { IndicatorData } from '@/types';

interface HistoryReviewProps {
  data: IndicatorData[];
}

function parsePrice(value: number | string | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatPrice(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getSignalBadges(item: IndicatorData): string[] {
  const signals: string[] = [];

  if (item.signalPriceMa200w || item.signalPriceMa) signals.push('Price / 200W MA');
  if (item.signalPriceRealized) signals.push('Price / Realized');
  if (item.signalReserveRisk) signals.push('Reserve Risk');
  if (item.signalSthSopr) signals.push('STH-SOPR');
  if (item.signalSthMvrv) signals.push('STH-MVRV');
  if (item.signalPuell) signals.push('Puell');

  return signals;
}

export function HistoryReview({ data }: HistoryReviewProps) {
  const [minSignals, setMinSignals] = useState(4);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const dateRange = useMemo(() => {
    if (!data.length) {
      return { min: '', max: '' };
    }

    const dates = data.map((row) => row.d).sort();
    return {
      min: dates[0],
      max: dates[dates.length - 1],
    };
  }, [data]);

  const filteredData = useMemo(() => {
    const startAt = startDate ? Date.parse(`${startDate}T00:00:00Z`) : null;
    const endAt = endDate ? Date.parse(`${endDate}T23:59:59Z`) : null;

    return data
      .filter((item) => {
        const signalCount = item.signalCount ?? 0;
        if (signalCount < minSignals) {
          return false;
        }

        const itemTime = Date.parse(`${item.d}T00:00:00Z`);
        if (startAt && itemTime < startAt) {
          return false;
        }

        if (endAt && itemTime > endAt) {
          return false;
        }

        return true;
      })
      .slice()
      .sort((left, right) => right.d.localeCompare(left.d));
  }, [data, endDate, minSignals, startDate]);

  const summary = useMemo(() => {
    if (!filteredData.length) {
      return {
        minPrice: 0,
        maxPrice: 0,
        avgPrice: 0,
      };
    }

    const prices = filteredData.map((row) => parsePrice(row.btcPrice));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((acc, price) => acc + price, 0) / prices.length;

    return {
      minPrice,
      maxPrice,
      avgPrice,
    };
  }, [filteredData]);

  const hasActiveFilters = Boolean(startDate || endDate || minSignals !== 4);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setMinSignals(4);
  };

  return (
    <Card className="surface-card mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5" />
          Historical Replay (Core-6)
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <section className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
          Range: {dateRange.min || '-'} to {dateRange.max || '-'} | {data.length} rows
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <Label htmlFor="min-signals">Minimum triggers</Label>
            <select
              id="min-signals"
              value={minSignals}
              onChange={(event) => setMinSignals(Number(event.target.value))}
              className="mt-1 w-full rounded-md border bg-background p-2"
            >
              <option value={3}>3 (Watch)</option>
              <option value={4}>4 (Focus)</option>
              <option value={5}>5 (Strong)</option>
              <option value={6}>6 (Extreme)</option>
            </select>
          </div>

          <div>
            <Label htmlFor="start-date">Start date</Label>
            <Input
              id="start-date"
              type="date"
              min={dateRange.min}
              max={dateRange.max}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="end-date">End date</Label>
            <Input
              id="end-date"
              type="date"
              min={dateRange.min}
              max={dateRange.max}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex items-end">
            <Button variant="outline" onClick={clearFilters} disabled={!hasActiveFilters} className="w-full">
              <X className="mr-2 h-4 w-4" />
              Clear filters
            </Button>
          </div>
        </section>

        {hasActiveFilters && (
          <section className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            Active filter:
            <span className="ml-2">signals {'>='} {minSignals}</span>
            {startDate && <span className="ml-3">from {startDate}</span>}
            {endDate && <span className="ml-3">to {endDate}</span>}
          </section>
        )}

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="rounded-xl border bg-background/70 p-4">
            <p className="text-sm text-muted-foreground">Matched days</p>
            <p className="text-2xl font-bold">{filteredData.length}</p>
          </article>

          <article className="rounded-xl border bg-background/70 p-4">
            <p className="text-sm text-muted-foreground">Min price</p>
            <p className="text-xl font-semibold">{filteredData.length ? formatPrice(summary.minPrice) : '-'}</p>
          </article>

          <article className="rounded-xl border bg-background/70 p-4">
            <p className="text-sm text-muted-foreground">Max price</p>
            <p className="text-xl font-semibold">{filteredData.length ? formatPrice(summary.maxPrice) : '-'}</p>
          </article>

          <article className="rounded-xl border bg-background/70 p-4">
            <p className="text-sm text-muted-foreground">Average price</p>
            <p className="text-xl font-semibold">{filteredData.length ? formatPrice(summary.avgPrice) : '-'}</p>
          </article>
        </section>

        {filteredData.length > 0 ? (
          <section className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>BTC Price</TableHead>
                  <TableHead>Triggers</TableHead>
                  <TableHead>V2 Score</TableHead>
                  <TableHead>Triggered indicators</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredData.slice(0, 120).map((item) => (
                  <TableRow key={`${item.d}-${item.signalCount ?? 0}`}>
                    <TableCell>{item.d}</TableCell>
                    <TableCell className="font-medium">{formatPrice(parsePrice(item.btcPrice))}</TableCell>
                    <TableCell>
                      <Badge
                        variant={(item.signalCount ?? 0) >= 5 ? 'default' : 'secondary'}
                        className={(item.signalCount ?? 0) >= 5 ? 'bg-emerald-600 text-white hover:bg-emerald-600' : ''}
                      >
                        {item.signalCount ?? 0} / 6
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.signalScoreV2 ?? '-'} / 12</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getSignalBadges(item).map((signal) => (
                          <Badge key={`${item.d}-${signal}`} variant="outline" className="text-xs">
                            {signal}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredData.length > 120 && (
              <p className="px-4 py-3 text-center text-sm text-muted-foreground">
                {filteredData.length - 120} additional rows are hidden for readability.
              </p>
            )}
          </section>
        ) : (
          <section className="rounded-xl border py-10 text-center text-muted-foreground">
            <Search className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>No records match current filters.</p>
            <p className="text-sm">Try reducing minimum triggers or widening the date range.</p>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
