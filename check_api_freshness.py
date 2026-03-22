import requests
import json

print("=" * 60)
print("检查API数据新鲜度")
print("=" * 60)

base_url = "https://bitcoin-data.com/v1"
indicators = [
    ('btc-price', ['d', 'btcPrice', 'price', 'ma200w', 'price_ma200w_ratio']),
    ('mvrv-zscore', ['d', 'mvrvZscore', 'mvrv_zscore']),
    ('lth-mvrv', ['d', 'lthMvrv', 'lth_mvrv']),
    ('puell-multiple', ['d', 'puellMultiple', 'puell_multiple']),
    ('nupl', ['d', 'nupl'])
]

for endpoint, fields in indicators:
    url = f"{base_url}/{endpoint}/1"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list) and len(data) > 0:
                latest = data[0]
                print(f"\n{endpoint}:")
                print(f"  Status: 200 OK")
                for f in fields:
                    if f in latest:
                        print(f"  {f}: {latest[f]}")
            else:
                print(f"\n{endpoint}: Empty response")
        else:
            print(f"\n{endpoint}: HTTP {r.status_code}")
            if r.status_code == 429:
                print(f"  ERROR: Rate limited!")
    except Exception as e:
        print(f"\n{endpoint}: Error - {e}")

print("\n" + "=" * 60)
print("检查本地数据文件")
print("=" * 60)

# Check local files
for path in ['data/latest/btc_indicators_latest.json', 'app/public/btc_indicators_latest.json']:
    try:
        with open(path) as f:
            data = json.load(f)
        d = data.get('d') or data.get('date')
        print(f"\n{path}:")
        print(f"  Date: {d}")
        print(f"  btcPrice: {data.get('btcPrice') or data.get('btc_price')}")
    except Exception as e:
        print(f"\n{path}: Error - {e}")
