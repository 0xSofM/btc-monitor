#!/usr/bin/env python3
"""
Test script: Fetch full historical data for all 5 indicators
Usage: python scripts/test_api_history.py
"""

import sys
import time
import json
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.data_updater import DataUpdater


def test_full_history():
    """Test fetching full historical data for all indicators"""
    print("=" * 60)
    print("TEST: Fetch Full Historical Data (All 5 Indicators)")
    print("=" * 60)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    updater = DataUpdater()
    indicators = ['btc-price', 'mvrv-zscore', 'lth-mvrv', 'puell-multiple', 'nupl']
    results = {}

    for indicator in indicators:
        print(f"Fetching {indicator} (all history)...")
        try:
            # Try to fetch with days=0 (all history)
            data = updater.fetch_indicator_data(indicator, days=0)

            if data:
                results[indicator] = {
                    'success': True,
                    'count': len(data),
                    'first_date': data[0].get('d') if data else None,
                    'last_date': data[-1].get('d') if data else None,
                    'sample': data[0] if data else None
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

    # Save results to file
    output_file = Path(__file__).parent.parent / 'test_history_result.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print()
    print(f"Results saved to: {output_file}")

    return success_count == total_count


if __name__ == "__main__":
    success = test_full_history()
    sys.exit(0 if success else 1)
