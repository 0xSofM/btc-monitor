#!/usr/bin/env python3
"""
Test script: Fetch full historical data for all 5 indicators and generate CSV table
Usage: python scripts/test_api_history.py
Output: data/table/all_indicators_history.csv (updated on each run)
"""

import sys
import time
import json
import csv
from pathlib import Path
from datetime import datetime
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.data_updater import DataUpdater


def test_full_history():
    """Test fetching full historical data and generate CSV table"""
    print("=" * 60)
    print("TEST: Fetch Full Historical Data (All 5 Indicators)")
    print("=" * 60)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    updater = DataUpdater()
    indicators = ['btc-price', 'mvrv-zscore', 'lth-mvrv', 'puell-multiple', 'nupl']
    all_data = {}  # Store all raw data
    results = {}

    for indicator in indicators:
        print(f"Fetching {indicator} (all history)...")
        try:
            # Try to fetch with days=0 (all history)
            data = updater.fetch_indicator_data(indicator, days=0)

            if data:
                all_data[indicator] = data
                results[indicator] = {
                    'success': True,
                    'count': len(data),
                    'first_date': data[0].get('d') if data else None,
                    'last_date': data[-1].get('d') if data else None,
                }
                print(f"  ✓ Success: {len(data)} records")
                print(f"    Date range: {data[0].get('d')} ~ {data[-1].get('d')}")
            else:
                results[indicator] = {'success': False, 'error': 'No data returned'}
                print(f"  ✗ Failed: No data returned")

        except Exception as e:
            results[indicator] = {'success': False, 'error': str(e)}
            print(f"  ✗ Failed: {e}")

        # Rate limit delay
        if indicator != indicators[-1]:
            print(f"  Waiting 5s...")
            time.sleep(5)
        print()

    # Generate CSV table if we have any data
    if all_data:
        generate_csv_table(all_data)

    # Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)

    success_count = sum(1 for r in results.values() if r.get('success'))
    total_count = len(indicators)

    print(f"Success: {success_count}/{total_count} indicators")
    print()

    for indicator, result in results.items():
        status = "✓" if result.get('success') else "✗"
        if result.get('success'):
            print(f"{status} {indicator}: {result['count']} records "
                  f"({result['first_date']} ~ {result['last_date']})")
        else:
            print(f"{status} {indicator}: {result.get('error', 'Unknown error')}")

    # Save JSON results to file
    output_file = Path(__file__).parent.parent / 'test_history_result.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print()
    print(f"Results saved to: {output_file}")

    return success_count == total_count


def generate_csv_table(all_data):
    """Generate CSV table with all indicators data by date"""
    print("=" * 60)
    print("Generating CSV table...")
    print("=" * 60)

    # Collect all dates
    all_dates = set()
    for indicator_data in all_data.values():
        for record in indicator_data:
            all_dates.add(record.get('d'))

    sorted_dates = sorted(all_dates)
    print(f"Total unique dates: {len(sorted_dates)}")

    # Build data lookup: {indicator: {date: values}}
    lookup = {}
    field_names = {
        'btc-price': ['btcPrice', 'price', 'ma200w', 'price_ma200w_ratio'],
        'mvrv-zscore': ['mvrvZscore', 'mvrv_zscore'],
        'lth-mvrv': ['lthMvrv', 'lth_mvrv'],
        'puell-multiple': ['puellMultiple', 'puell_multiple'],
        'nupl': ['nupl']
    }

    for indicator, data in all_data.items():
        lookup[indicator] = {}
        for record in data:
            date = record.get('d')
            if date:
                lookup[indicator][date] = record

    # Prepare CSV rows
    csv_rows = []
    for date in sorted_dates:
        row = {'date': date}

        # BTC Price fields
        btc_record = lookup.get('btc-price', {}).get(date, {})
        row['btc_price'] = btc_record.get('btcPrice') or btc_record.get('price')
        row['ma200w'] = btc_record.get('ma200w')
        row['price_ma200w_ratio'] = btc_record.get('price_ma200w_ratio')

        # MVRV Z-Score
        mvrv_record = lookup.get('mvrv-zscore', {}).get(date, {})
        row['mvrv_zscore'] = mvrv_record.get('mvrvZscore') or mvrv_record.get('mvrv_zscore')

        # LTH-MVRV
        lth_record = lookup.get('lth-mvrv', {}).get(date, {})
        row['lth_mvrv'] = lth_record.get('lthMvrv') or lth_record.get('lth_mvrv')

        # Puell Multiple
        puell_record = lookup.get('puell-multiple', {}).get(date, {})
        row['puell_multiple'] = puell_record.get('puellMultiple') or puell_record.get('puell_multiple')

        # NUPL
        nupl_record = lookup.get('nupl', {}).get(date, {})
        row['nupl'] = nupl_record.get('nupl')

        csv_rows.append(row)

    # Ensure output directory exists
    output_dir = Path(__file__).parent.parent / 'data' / 'table'
    output_dir.mkdir(parents=True, exist_ok=True)

    # Write CSV file
    csv_file = output_dir / 'all_indicators_history.csv'
    fieldnames = [
        'date', 'btc_price', 'ma200w', 'price_ma200w_ratio',
        'mvrv_zscore', 'lth_mvrv', 'puell_multiple', 'nupl'
    ]

    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(csv_rows)

    print(f"✓ CSV table saved: {csv_file}")
    print(f"  Records: {len(csv_rows)}")
    print(f"  Columns: {', '.join(fieldnames)}")
    print()


if __name__ == "__main__":
    success = test_full_history()
    sys.exit(0 if success else 1)
