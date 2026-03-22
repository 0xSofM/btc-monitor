import requests
import json

print("=" * 60)
print("详细检查API响应")
print("=" * 60)

base_url = "https://bitcoin-data.com/v1"

# Test different endpoints
endpoints = [
    'btc-price',
    'btc-price/1',
    'btc-price?days=1',
    'mvrv-zscore',
    'mvrv-zscore/1',
]

for ep in endpoints:
    url = f"{base_url}/{ep}"
    print(f"\nTesting: {url}")
    try:
        r = requests.get(url, timeout=10)
        print(f"  Status: {r.status_code}")
        print(f"  Content-Type: {r.headers.get('content-type', 'N/A')}")
        text = r.text[:500]
        print(f"  Response (first 500 chars): {text}")
        try:
            data = r.json()
            print(f"  JSON parsed: {type(data)}")
            if isinstance(data, list) and len(data) > 0:
                print(f"  First item: {data[0]}")
        except:
            print(f"  Not valid JSON")
    except Exception as e:
        print(f"  Error: {e}")
