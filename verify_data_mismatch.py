"""
检查当前数据 vs API实际数据
"""
import json
import requests
from datetime import datetime

print("=" * 70)
print("数据核查报告")
print("=" * 70)

# 1. 当前前端数据
print("\n【1】当前 app/public 数据:")
with open('app/public/btc_indicators_latest.json') as f:
    public = json.load(f)
print(f"  date: {public.get('date')}")
print(f"  btcPrice: {public.get('btcPrice')}")
print(f"  mvrvZscore: {public.get('mvrvZscore')}")
print(f"  lthMvrv: {public.get('lthMvrv')}")
print(f"  puellMultiple: {public.get('puellMultiple')}")
print(f"  nupl: {public.get('nupl')}")

# 2. 检查历史记录中各日期对应的真实数据
print("\n【2】历史记录中最近几天真实数据:")
with open('data/history/btc_indicators_history.json') as f:
    history = json.load(f)

# 去重并找出每天最新数据
seen_dates = {}
for item in history:
    d = item.get('d')
    if d and d not in seen_dates:
        seen_dates[d] = item

for d in sorted(seen_dates.keys())[-5:]:
    item = seen_dates[d]
    btc = item.get('btcPrice')
    mvrv = item.get('mvrvZscore')
    lth = item.get('lthMvrv')
    puell = item.get('puellMultiple')
    nupl = item.get('nupl')
    print(f"  {d}: btc={btc}, mvrv={mvrv}, lth={lth}, puell={puell}, nupl={nupl}")

# 3. 测试API（只测一个避免限流）
print("\n【3】API实际返回数据:")
try:
    r = requests.get('https://bitcoin-data.com/v1/btc-price/1', timeout=10)
    if r.status_code == 200:
        data = r.json()
        print(f"  btc-price: date={data.get('d')}, btcPrice={data.get('btcPrice')}")
    else:
        print(f"  btc-price: HTTP {r.status_code}")
except Exception as e:
    print(f"  Error: {e}")

# 4. 问题分析
print("\n" + "=" * 70)
print("问题分析:")
print("=" * 70)

# 找出哪天的数据被错误使用
public_date = public.get('date')
public_btc = public.get('btcPrice')
public_mvrv = public.get('mvrvZscore')

# 检查各指标是否匹配历史记录
for d, item in seen_dates.items():
    if abs(float(item.get('btcPrice') or 0) - float(public_btc or 0)) < 100:
        print(f"\nbtcPrice {public_btc} 匹配日期: {d}")
    if str(item.get('mvrvZscore')) == str(public_mvrv):
        print(f"mvrvZscore {public_mvrv} 匹配日期: {d}")

print("\n" + "=" * 70)
print("结论:")
print("=" * 70)
print(f"\n当前显示日期: {public_date}")
print(f"但指标数值可能来自不同日期的数据组合")
print(f"\n需要确保:")
print(f"1. 日期 = API返回的最新日期")
print(f"2. 所有指标 = 该日期的实际值（如果API限流则用最近有效值）")
