"""
修复数据：用2026-03-19的完整指标 + 今天的BTC价格
同时确保日期严格对应API数据日期
"""
import json
from datetime import datetime

print("=" * 70)
print("修复数据 - 使用最后完整指标数据")
print("=" * 70)

# 加载历史数据
with open('data/history/btc_indicators_history.json', 'r') as f:
    history = json.load(f)

print(f"\n历史记录总数: {len(history)}")

# 找到最后一条有完整指标的有效数据
last_complete = None
for item in reversed(history):
    d = item.get('d', '')
    btc = item.get('btcPrice')
    mvrv = item.get('mvrvZscore')
    lth = item.get('lthMvrv')
    puell = item.get('puellMultiple')
    nupl = item.get('nupl')
    
    # 检查是否完整
    try:
        btc_val = float(btc) if btc else 0
        mvrv_val = float(mvrv) if mvrv is not None else None
        lth_val = float(lth) if lth is not None else None
        puell_val = float(puell) if puell is not None else None
        nupl_val = float(nupl) if nupl is not None else None
    except:
        continue
    
    if btc_val > 10000 and mvrv_val is not None and lth_val is not None and puell_val is not None and nupl_val is not None:
        last_complete = item
        print(f"\n找到最后完整数据: {d}")
        print(f"  btcPrice: {btc_val}")
        print(f"  mvrvZscore: {mvrv_val}")
        print(f"  lthMvrv: {lth_val}")
        print(f"  puellMultiple: {puell_val}")
        print(f"  nupl: {nupl_val}")
        break

if not last_complete:
    print("ERROR: 未找到完整的历史数据!")
    exit(1)

# 清理历史中的重复/损坏的03-22条目
cleaned_history = [item for item in history if not (item.get('d', '').startswith('2026-03-2') and item.get('d') != '2026-03-19')]

# 获取今天的BTC价格（从历史最后一条或latest文件）
today_price = None
for item in reversed(history):
    if item.get('d') == '2026-03-22' and item.get('btcPrice'):
        try:
            p = float(item.get('btcPrice'))
            if p > 10000:
                today_price = p
                print(f"\n使用API获取的今天BTC价格: {today_price}")
                break
        except:
            pass

if not today_price:
    # 使用CoinGecko或Coinbase获取
    print("\n尝试获取实时BTC价格...")
    import requests
    try:
        r = requests.get('https://api.coinbase.com/v2/prices/BTC-USD/spot', timeout=10)
        today_price = float(r.json()['data']['amount'])
        print(f"Coinbase BTC价格: {today_price}")
    except:
        today_price = last_complete.get('btcPrice')  # 回退到历史价格
        print(f"使用历史BTC价格: {today_price}")

# 构建今天的完整数据
today = '2026-03-22'
today_data = {
    'd': today,
    'date': today,
    'btcPrice': today_price,
    'mvrvZscore': last_complete.get('mvrvZscore'),
    'lthMvrv': last_complete.get('lthMvrv'),
    'puellMultiple': last_complete.get('puellMultiple'),
    'nupl': last_complete.get('nupl'),
    'ma200w': last_complete.get('ma200w'),
    'price_ma200w_ratio': today_price / last_complete.get('ma200w') if last_complete.get('ma200w') else None,
}

# 添加API数据日期标记（指标实际来源日期）
today_data['apiDataDate'] = {
    'btcPrice': today,  # 今天获取
    'mvrvZ': last_complete.get('d'),  # 指标来自历史数据
    'lthMvrv': last_complete.get('d'),
    'puell': last_complete.get('d'),
    'nupl': last_complete.get('d'),
}

# 计算信号
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
    'signal_count': 0,
    'signal_strength': 'NONE'
}
signals['signal_count'] = sum([v for k, v in signals.items() if k not in ['signal_count', 'signal_strength']])
signals['signal_strength'] = 'WEAK' if signals['signal_count'] >= 2 else ('MINIMAL' if signals['signal_count'] >= 1 else 'NONE')

today_data.update(signals)

# 保存latest
with open('data/latest/btc_indicators_latest.json', 'w') as f:
    json.dump(today_data, f, indent=2)
print(f"\n✓ Saved data/latest: {today}")

# 更新历史
if cleaned_history[-1].get('d') == today:
    cleaned_history[-1] = today_data
    print(f"✓ Updated history entry: {today}")
else:
    cleaned_history.append(today_data)
    print(f"✓ Added history entry: {today}")

with open('data/history/btc_indicators_history.json', 'w') as f:
    json.dump(cleaned_history, f, indent=2)

print(f"\n最终数据:")
print(f"  日期: {today}")
print(f"  BTC价格: {today_price} (来源: {'API' if today_price != last_complete.get('btcPrice') else '历史'})")
print(f"  MVRV Z-Score: {today_data.get('mvrvZscore')} (来源日期: {last_complete.get('d')})")
print(f"  LTH-MVRV: {today_data.get('lthMvrv')} (来源日期: {last_complete.get('d')})")
print(f"  信号数: {signals['signal_count']}")
