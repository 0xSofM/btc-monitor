#!/usr/bin/env python3
"""为历史数据添加ma200w字段"""

import json

with open('app/public/btc_indicators_history.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"总记录数: {len(data)}")

# 为每条记录计算ma200w
for record in data:
    btc_price = record.get('btcPrice')
    ratio = record.get('price_ma200w_ratio') or record.get('priceMa200wRatio')
    
    if btc_price and ratio and ratio > 0:
        record['ma200w'] = btc_price / ratio
    else:
        record['ma200w'] = None

# 检查最后几条记录
print("\n最后3条记录:")
for record in data[-3:]:
    print(f"日期: {record['d']}")
    print(f"  BTC价格: {record['btcPrice']:.2f}")
    print(f"  Ratio: {record['price_ma200w_ratio']:.4f}")
    print(f"  MA200: {record['ma200w']:.2f}" if record['ma200w'] else "  MA200: None")
    print()

# 保存
with open('app/public/btc_indicators_history.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

with open('btc_indicators_history.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("[OK] 数据已更新，ma200w字段已添加")
