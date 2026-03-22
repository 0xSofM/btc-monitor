import json
from datetime import datetime

# Load last valid history entry (2026-03-19)
with open('data/history/btc_indicators_history.json', 'r') as f:
    history = json.load(f)

# Find last valid entry with full indicators
last_valid = None
for item in reversed(history):
    if item.get('btcPrice') and item.get('mvrvZscore') is not None:
        last_valid = item
        break

print(f"Last valid entry: {last_valid.get('d') if last_valid else 'None'}")

if last_valid:
    # Create today's data based on last valid entry but with today's btcPrice
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Load current latest to get today's btcPrice
    try:
        with open('data/latest/btc_indicators_latest.json', 'r') as f:
            current = json.load(f)
        today_price = current.get('btcPrice', last_valid.get('btcPrice'))
    except:
        today_price = last_valid.get('btcPrice')
    
    # Build complete data with all fields
    today_data = {
        'd': today,
        'btcPrice': today_price,
        'mvrvZscore': last_valid.get('mvrvZscore'),
        'lthMvrv': last_valid.get('lthMvrv'),
        'puellMultiple': last_valid.get('puellMultiple'),
        'nupl': last_valid.get('nupl'),
        'ma200w': last_valid.get('ma200w'),
        'price_ma200w_ratio': last_valid.get('price_ma200w_ratio'),
    }
    
    # Calculate signals
    price_ratio = float(today_data.get('price_ma200w_ratio') or 0) or 999
    mvrv = float(today_data.get('mvrvZscore') or 0) or 999
    lth = float(today_data.get('lthMvrv') or 0) or 999
    puell = float(today_data.get('puellMultiple') or 0) or 999
    nupl = float(today_data.get('nupl') or 0) or 999
    
    signals = {
        'price_200w_ma_signal': price_ratio < 1 and price_ratio > 0,
        'mvrv_zscore_signal': mvrv < 0,
        'lth_mvrv_signal': lth < 1 and lth > 0,
        'puell_multiple_signal': puell < 0.5 and puell > 0,
        'nupl_signal': nupl < 0,
    }
    signal_count = sum(signals.values())
    
    today_data.update(signals)
    today_data['signal_count'] = signal_count
    today_data['signal_strength'] = 'WEAK' if signal_count >= 2 else ('MINIMAL' if signal_count >= 1 else 'NONE')
    
    # Save to latest
    with open('data/latest/btc_indicators_latest.json', 'w') as f:
        json.dump(today_data, f, indent=2)
    
    # Also update history
    if history[-1].get('d') == today:
        history[-1] = today_data
    else:
        history.append(today_data)
    
    with open('data/history/btc_indicators_history.json', 'w') as f:
        json.dump(history, f, indent=2)
    
    print(f"Updated {today} with btcPrice={today_price}, signals={signal_count}")
    print(f"Data saved successfully!")
else:
    print("ERROR: No valid historical data found!")
