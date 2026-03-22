import json
from datetime import datetime, timedelta

# Load history
with open('data/history/btc_indicators_history.json', 'r') as f:
    data = json.load(f)

print(f"Total records before: {len(data)}")

# Remove corrupted entries (2026-03-20 onwards with invalid data)
valid_data = []
removed = []
for item in data:
    d = item.get('d', '')
    btc = item.get('btcPrice')
    # Convert to float if it's a string
    if isinstance(btc, str):
        try:
            btc = float(btc)
        except (ValueError, TypeError):
            btc = None
    # Keep if: date is before 2026-03-20, OR has valid btcPrice > 1000
    if d < '2026-03-20' or (btc and float(btc) > 1000):
        valid_data.append(item)
    else:
        removed.append(d)

print(f"Removed corrupted dates: {removed}")
print(f"Total records after: {len(valid_data)}")

# Save cleaned history
with open('data/history/btc_indicators_history.json', 'w') as f:
    json.dump(valid_data, f, indent=2)

print("History cleaned successfully!")
