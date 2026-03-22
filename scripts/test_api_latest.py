#!/usr/bin/env python3
"""
Test script: Fetch latest data for all 5 indicators
Usage: python scripts/test_api_latest.py
"""

import sys
import time
import json
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.data_updater import DataUpdater


def test_latest_data():
    """Test fetching latest data for all indicators"""
    print("=" * 60)
    print("TEST: Fetch Latest Data (All 5 Indicators)")
    print("=" * 60)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    updater = DataUpdater()
    indicators = ['btc-price', 'mvrv-zscore', 'lth-mvrv', 'puell-multiple', 'nupl']
    results = {}
    combined_data = {}

    for indicator in indicators:
        print(f"Fetching {indicator} (latest)...")
        try:
            # Fetch only latest 1 day
            data = updater.fetch_indicator_data(indicator, days=1)

            if data and len(data) > 0:
                latest = data[0]  # API returns latest first
                results[indicator] = {
                    'success': True,
                    'date': latest.get('d'),
                    'data': latest
                }

                # Extract key fields for combined view
                if indicator == 'btc-price':
                    combined_data['btcPrice'] = latest.get('btcPrice') or latest.get('price')
                    combined_data['ma200w'] = latest.get('ma200w')
                    combined_data['price_ma200w_ratio'] = latest.get('price_ma200w_ratio')
                elif indicator == 'mvrv-zscore':
                    combined_data['mvrvZscore'] = latest.get('mvrvZscore') or latest.get('mvrv_zscore')
                elif indicator == 'lth-mvrv':
                    combined_data['lthMvrv'] = latest.get('lthMvrv') or latest.get('lth_mvrv')
                elif indicator == 'puell-multiple':
                    combined_data['puellMultiple'] = latest.get('puellMultiple') or latest.get('puell_multiple')
                elif indicator == 'nupl':
                    combined_data['nupl'] = latest.get('nupl')

                print(f"  ✓ Success: date={latest.get('d')}")
                # Print key values
                key_fields = ['btcPrice', 'price', 'mvrvZscore', 'mvrv_zscore',
                             'lthMvrv', 'lth_mvrv', 'puellMultiple', 'puell_multiple', 'nupl']
                for field in key_fields:
                    if field in latest and latest[field] is not None:
                        print(f"    {field}: {latest[field]}")
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
            print(f"{status} {indicator}: date={result['date']}")
        else:
            print(f"{status} {indicator}: {result.get('error', 'Unknown error')}")

    print()
    print("Combined Data Preview:")
    print("-" * 40)
    for key, value in combined_data.items():
        print(f"  {key}: {value}")

    # Save results to file
    output_file = Path(__file__).parent.parent / 'test_latest_result.json'
    save_data = {
        'timestamp': datetime.now().isoformat(),
        'combined_data': combined_data,
        'indicator_results': results
    }
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(save_data, f, indent=2, ensure_ascii=False)
    print()
    print(f"Results saved to: {output_file}")

    return success_count == total_count


if __name__ == "__main__":
    success = test_latest_data()
    sys.exit(0 if success else 1)
