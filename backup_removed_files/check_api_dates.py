"""检查各 API 返回数据的最新日期"""
import requests
from datetime import datetime

API_BASE_URL = 'https://bitcoin-data.com'

def check_api_date(endpoint, days=1):
    """检查 API 返回的最新数据日期"""
    try:
        url = f"{API_BASE_URL}/v1/{endpoint}/{days}"
        print(f"  请求：{url}")
        response = requests.get(url, timeout=10)
        print(f"  响应状态码：{response.status_code}")
        print(f"  响应内容：{response.text[:500]}")
        if response.status_code == 200:
            data = response.json()
            print(f"  解析后的数据：{data}")
            if data and len(data) > 0:
                latest = data[0]
                date = latest.get('d', 'unknown')
                return date, latest
            return None, None
        return f"Error: {response.status_code}", None
    except Exception as e:
        print(f"  异常：{str(e)}")
        return f"Error: {str(e)}", None

# 检查各 API 端点
endpoints = [
    ('btc-price', 'BTC Price'),
    ('mvrv-zscore', 'MVRV Z-Score'),
    ('lth-mvrv', 'LTH-MVRV'),
    ('puell-multiple', 'Puell Multiple'),
    ('nupl', 'NUPL'),
]

print("检查各 API 端点返回的最新数据日期：")
print("=" * 60)

results = []
for endpoint, name in endpoints:
    date, data = check_api_date(endpoint)
    results.append((name, date, data))
    print(f"{name:20s}: {date}")
    if data:
        print(f"  数据：{data}")
    print()

print("=" * 60)
print("\n总结：")
for name, date, _ in results:
    print(f"  {name}: {date}")

# 检查日期是否都是同一天
dates = [date for _, date, _ in results if date and not date.startswith('Error')]
if dates:
    unique_dates = set(dates)
    if len(unique_dates) > 1:
        print(f"\n⚠️  警告：存在不同的日期：{unique_dates}")
    else:
        print(f"\n✓ 所有数据都是同一日期：{dates[0]}")
