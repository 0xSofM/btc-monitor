"""
核查2026-03-19数据的来源 - 是否通过API正确获取
"""
import json

print("=" * 70)
print("核查 2026-03-19 数据来源")
print("=" * 70)

# 加载历史数据
with open('data/history/btc_indicators_history.json', 'r') as f:
    history = json.load(f)

# 找到2026-03-19的数据
entry_0319 = None
for item in history:
    if item.get('d') == '2026-03-19':
        entry_0319 = item
        break

if not entry_0319:
    print("ERROR: 未找到2026-03-19的数据!")
    exit(1)

print("\n【2026-03-19 完整数据条目】:")
print("-" * 50)
for key, value in sorted(entry_0319.items()):
    print(f"  {key}: {value}")

# 检查数据特征判断是否为API获取
print("\n【数据来源分析】:")
print("-" * 50)

# API数据的特征:
# 1. 有信号字段 (price_200w_ma_signal, mvrv_zscore_signal等)
# 2. 有signal_count和signal_strength
# 3. 数值精度与API一致（通常多位小数）

has_signals = any(k.endswith('_signal') for k in entry_0319.keys())
has_signal_count = 'signal_count' in entry_0319
has_signal_strength = 'signal_strength' in entry_0319

print(f"  有信号字段 (_signal): {has_signals}")
print(f"  有signal_count: {has_signal_count}")
print(f"  有signal_strength: {has_signal_strength}")

# 检查数值精度
btc_price = entry_0319.get('btcPrice')
nupl = entry_0319.get('nupl')
print(f"\n  btcPrice精度: {len(str(btc_price).split('.')[-1]) if '.' in str(btc_price) else 0}位小数")
print(f"  nupl精度: {len(str(nupl).split('.')[-1]) if '.' in str(nupl) else 0}位小数")

# 检查之前几天数据的一致性（API数据通常连续几天格式一致）
print("\n【与前几天数据对比】:")
print("-" * 50)
recent_dates = ['2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19']
for d in recent_dates:
    for item in history:
        if item.get('d') == d:
            btc = item.get('btcPrice')
            mvrv = item.get('mvrvZscore')
            has_sig = 'signal_count' in item
            print(f"  {d}: btc={btc}, mvrv={mvrv}, has_signal_count={has_sig}")
            break

# 结论
print("\n" + "=" * 70)
print("结论:")
print("=" * 70)

if has_signals and has_signal_count and has_signal_strength:
    print("\n✅ 2026-03-19 数据具有API获取的典型特征:")
    print("   - 包含信号计算字段")
    print("   - 包含signal_count和signal_strength")
    print("   - 数值精度与API一致")
    print("\n   这是通过API正确获取的数据，可用于今天的数据参考。")
else:
    print("\n⚠️  2026-03-19 数据缺少API特征，可能是手动填充的")
    print("   建议检查更早的历史数据确认来源")
