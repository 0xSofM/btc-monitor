import json
import requests
from datetime import datetime

print("=" * 70)
print("详细诊断报告")
print("=" * 70)

# 1. 检查历史记录最后几条
print("\n【1】历史记录最后5条:")
print("-" * 50)
with open('data/history/btc_indicators_history.json') as f:
    history = json.load(f)

for item in history[-5:]:
    d = item.get('d')
    btc = item.get('btcPrice')
    mvrv = item.get('mvrvZscore')
    lth = item.get('lthMvrv')
    print(f"  {d}: btc={btc}, mvrv={mvrv}, lth={lth}")

# 2. 测试API实际返回的数据（不使用rate limit）
print("\n【2】API实际数据（测试端点）:")
print("-" * 50)

base_url = "https://bitcoin-data.com/v1"
endpoints = {
    'btc-price': ['btc-price/1', 'btcPrice'],
    'mvrv-zscore': ['mvrv-zscore/1', 'mvrvZscore'],
    'lth-mvrv': ['lth-mvrv/1', 'lthMvrv'],
}

for name, (ep, field) in endpoints.items():
    url = f"{base_url}/{ep}"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            data = r.json()
            d = data.get('d') if isinstance(data, dict) else (data[0].get('d') if data else 'N/A')
            val = data.get(field) if isinstance(data, dict) else (data[0].get(field) if data else 'N/A')
            print(f"  {name}: date={d}, {field}={val}")
        else:
            print(f"  {name}: HTTP {r.status_code}")
    except Exception as e:
        print(f"  {name}: Error - {str(e)[:50]}")

# 3. 检查当前 latest 文件
print("\n【3】当前 latest 文件:")
print("-" * 50)
with open('data/latest/btc_indicators_latest.json') as f:
    latest = json.load(f)
print(f"  date: {latest.get('d')}")
print(f"  btcPrice: {latest.get('btcPrice')}")
print(f"  mvrvZscore: {latest.get('mvrvZscore')}")
print(f"  lthMvrv: {latest.get('lthMvrv')}")
print(f"  puellMultiple: {latest.get('puellMultiple')}")
print(f"  nupl: {latest.get('nupl')}")

print("\n" + "=" * 70)
print("问题分析:")
print("=" * 70)

# 找出问题
last_good = None
for item in reversed(history):
    btc = item.get('btcPrice')
    mvrv = item.get('mvrvZscore')
    if btc and str(btc).replace('.','',1).isdigit() and float(btc) > 1000:
        if mvrv and str(mvrv).replace('.','',1).replace('-','',1).isdigit() and abs(float(mvrv)) < 10:
            last_good = item
            break

if last_good:
    print(f"\n最后有效数据日期: {last_good.get('d')}")
    print(f"  btcPrice: {last_good.get('btcPrice')}")
    print(f"  mvrvZscore: {last_good.get('mvrvZscore')}")
    print(f"  lthMvrv: {last_good.get('lthMvrv')}")
else:
    print("\n未找到有效历史数据!")

print("\n当前数据问题:")
if str(latest.get('mvrvZscore')) == '0':
    print("  - mvrvZscore = 0 (错误，应为约0.67)")
if str(latest.get('lthMvrv')) == '816.457':
    print("  - lthMvrv = 816.457 (错误，应为约1.69)")
