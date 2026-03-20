#!/usr/bin/env python3
"""检查数据文件中的记录"""

import json

# 读取历史数据
with open('app/public/btc_indicators_history.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print('=== 最后3条记录 ===')
for record in data[-3:]:
    print(f"日期: {record['d']}")
    print(f"  BTC价格: {record['btcPrice']}")
    print(f"  MVRV: {record.get('mvrvZscore', 'N/A')}")
    print(f"  LTH-MVRV: {record.get('lthMvrv', 'N/A')}")
    print(f"  Puell: {record.get('puellMultiple', 'N/A')}")
    print(f"  NUPL: {record.get('nupl', 'N/A')}")
    print(f"  信号数: {record.get('signal_count', 'N/A')}")
    print()

# 统计有多少条记录缺少指标数据
incomplete = 0
for r in data:
    if r.get('mvrvZscore') is None or r.get('lthMvrv') is None:
        incomplete += 1

print(f'总记录数: {len(data)}')
print(f'缺少指标数据的记录: {incomplete}')
