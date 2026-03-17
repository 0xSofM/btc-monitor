#!/usr/bin/env python3
import json

with open('app/public/btc_indicators_history.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 检查最后一条记录的结构
last = data[-1]
print("最后一条记录的字段:")
for key, value in last.items():
    print(f"  {key}: {value}")

print("\n倒数第10条记录:")
record = data[-10]
for key, value in record.items():
    print(f"  {key}: {value}")
