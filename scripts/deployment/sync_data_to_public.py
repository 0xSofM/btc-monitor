#!/usr/bin/env python3
"""
Sync data files from data/ to app/public/
Transforms Python backend format to frontend format with correct signal calculations
"""

import json
import shutil
from pathlib import Path


def calculate_signals(data: dict) -> dict:
    """Calculate buy signals based on indicator values"""
    signals = {
        'priceMa200w': False,
        'mvrvZ': False,
        'lthMvrv': False,
        'puell': False,
        'nupl': False
    }
    
    # Price / 200W-MA: triggered when ratio < 1
    price_ratio = float(data.get('price_ma200w_ratio', data.get('priceMa200wRatio', 0)) or 0)
    signals['priceMa200w'] = price_ratio < 1 and price_ratio > 0
    
    # MVRV Z-Score: triggered when < 0
    mvrv_z = float(data.get('mvrv_zscore', data.get('mvrvZscore', 0)) or 0)
    signals['mvrvZ'] = mvrv_z < 0
    
    # LTH-MVRV: triggered when < 1
    lth_mvrv = float(data.get('lth_mvrv', data.get('lthMvrv', 0)) or 0)
    signals['lthMvrv'] = lth_mvrv < 1 and lth_mvrv > 0
    
    # Puell Multiple: triggered when < 0.5
    puell = float(data.get('puell_multiple', data.get('puellMultiple', 0)) or 0)
    signals['puell'] = puell < 0.5 and puell > 0
    
    # NUPL: triggered when < 0
    nupl = float(data.get('nupl', 0) or 0)
    signals['nupl'] = nupl < 0
    
    return signals


def is_valid_data(data: dict) -> bool:
    """Check if data has valid (non-zero) btcPrice"""
    btc_price = float(data.get('btcPrice', data.get('btc_price', 0)) or 0)
    return btc_price > 0


def transform_latest_data(input_path: Path, output_path: Path, history_path: Path = None) -> None:
    """Transform latest data from Python format to frontend format"""
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # If latest data is corrupted (btcPrice=0), try to use last valid history entry
    if not is_valid_data(data) and history_path and history_path.exists():
        with open(history_path, 'r', encoding='utf-8') as f:
            history = json.load(f)
        # Find last valid entry
        for item in reversed(history):
            if is_valid_data(item):
                print(f"⚠ Latest data corrupted, using last valid history entry: {item.get('d')}")
                data = item
                break
    
    # Extract values with multiple format support
    btc_price = float(data.get('btcPrice', data.get('btc_price', 0)) or 0)
    price_ratio = float(data.get('price_ma200w_ratio', data.get('priceMa200wRatio', 0)) or 0)
    ma200w = float(data.get('ma200w', 0) or 0)
    mvrv_z = float(data.get('mvrv_zscore', data.get('mvrvZscore', 0)) or 0)
    lth_mvrv = float(data.get('lth_mvrv', data.get('lthMvrv', 0)) or 0)
    puell = float(data.get('puell_multiple', data.get('puellMultiple', 0)) or 0)
    nupl = float(data.get('nupl', 0) or 0)
    date = data.get('d', data.get('date', ''))
    
    # Calculate signals based on actual values
    signals = calculate_signals(data)
    signal_count = sum(signals.values())
    
    # Extract indicator dates from apiDataDate if available
    api_dates = data.get('apiDataDate', data.get('api_data_date', {}))
    indicator_dates = {
        'priceMa200w': date,
        'mvrvZ': api_dates.get('mvrvZ', api_dates.get('mvrv_z', date)),
        'lthMvrv': api_dates.get('lthMvrv', api_dates.get('lth_mvrv', date)),
        'puell': api_dates.get('puell', date),
        'nupl': api_dates.get('nupl', date)
    }
    
    # Build frontend format
    frontend_data = {
        'date': date,
        'btcPrice': btc_price,
        'priceMa200wRatio': price_ratio,
        'ma200w': ma200w if ma200w > 0 else None,
        'mvrvZscore': mvrv_z,
        'lthMvrv': lth_mvrv,
        'puellMultiple': puell,
        'nupl': nupl,
        'signalCount': signal_count,
        'signals': signals,
        'indicatorDates': indicator_dates,
        'lastUpdated': data.get('lastUpdated', f'{date}T00:00:00.000000')
    }
    
    # Remove None values
    frontend_data = {k: v for k, v in frontend_data.items() if v is not None}
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(frontend_data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Synced latest data: {date}, signals: {signal_count}")


def transform_history_data(input_path: Path, output_path: Path) -> None:
    """Transform history data from Python format to frontend format"""
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    transformed = []
    for item in data:
        # Convert snake_case to camelCase
        transformed_item = {
            'd': item.get('d', ''),
            'btcPrice': item.get('btcPrice', item.get('btc_price')),
            'priceMa200wRatio': item.get('priceMa200wRatio', item.get('price_ma200w_ratio')),
            'ma200w': item.get('ma200w'),
            'mvrvZscore': item.get('mvrvZscore', item.get('mvrv_zscore')),
            'lthMvrv': item.get('lthMvrv', item.get('lth_mvrv')),
            'puellMultiple': item.get('puellMultiple', item.get('puell_multiple')),
            'nupl': item.get('nupl'),
            'signalPriceMa': item.get('signalPriceMa', item.get('signal_price_ma', item.get('price_200w_ma_signal'))),
            'signalMvrvZ': item.get('signalMvrvZ', item.get('signal_mvrv_z', item.get('mvrv_zscore_signal'))),
            'signalLthMvrv': item.get('signalLthMvrv', item.get('signal_lth_mvrv', item.get('lth_mvrv_signal'))),
            'signalPuell': item.get('signalPuell', item.get('signal_puell', item.get('puell_multiple_signal'))),
            'signalNupl': item.get('signalNupl', item.get('signal_nupl', item.get('nupl_signal'))),
            'signalCount': item.get('signalCount', item.get('signal_count', 0)),
        }
        
        # Preserve apiDataDate if present
        if 'apiDataDate' in item or 'api_data_date' in item:
            api_dates = item.get('apiDataDate', item.get('api_data_date', {}))
            transformed_item['apiDataDate'] = {
                'mvrvZ': api_dates.get('mvrvZ', api_dates.get('mvrv_z')),
                'lthMvrv': api_dates.get('lthMvrv', api_dates.get('lth_mvrv')),
                'puell': api_dates.get('puell'),
                'nupl': api_dates.get('nupl')
            }
        
        transformed.append(transformed_item)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(transformed, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Synced history data: {len(transformed)} records")


def main():
    """Main sync function"""
    repo_root = Path(__file__).parent.parent.parent
    
    # Paths
    data_dir = repo_root / 'data'
    public_dir = repo_root / 'app' / 'public'
    
    # Ensure public directory exists
    public_dir.mkdir(parents=True, exist_ok=True)
    
    # Sync latest data
    latest_input = data_dir / 'latest' / 'btc_indicators_latest.json'
    latest_output = public_dir / 'btc_indicators_latest.json'
    
    history_input = data_dir / 'history' / 'btc_indicators_history.json'
    
    if latest_input.exists():
        transform_latest_data(latest_input, latest_output, history_input)
    else:
        print(f"⚠ Latest data not found: {latest_input}")
    
    # Sync history data
    history_input = data_dir / 'history' / 'btc_indicators_history.json'
    history_output = public_dir / 'btc_indicators_history.json'
    
    if history_input.exists():
        transform_history_data(history_input, history_output)
    else:
        print(f"⚠ History data not found: {history_input}")
    
    print("✓ Data sync completed")


if __name__ == '__main__':
    main()
