#!/usr/bin/env python3
"""验证前端数据与本地存储一致性"""

import json
from pathlib import Path

def main():
    # 读取本地数据
    with open('btc_indicators_latest.json', 'r') as f:
        latest = json.load(f)
    
    with open('btc_indicators_history.json', 'r') as f:
        history = json.load(f)
    
    last_record = history[-1]
    
    print("=" * 60)
    print("数据一致性验证")
    print("=" * 60)
    
    print("\n本地最新数据摘要 (btc_indicators_latest.json):")
    print(f"  日期: {latest['date']}")
    print(f"  BTC价格: ${latest['btcPrice']:,.2f}")
    print(f"  Price/200W-MA: {latest['priceMa200wRatio']:.4f}")
    print(f"  MVRV Z-Score: {latest['mvrvZscore']}")
    print(f"  LTH-MVRV: {latest['lthMvrv']}")
    print(f"  Puell Multiple: {latest['puellMultiple']}")
    print(f"  NUPL: {latest['nupl']}")
    
    print("\n历史数据最新记录 (btc_indicators_history.json[-1]):")
    print(f"  日期: {last_record['d']}")
    print(f"  BTC价格: ${last_record['btcPrice']:,.2f}")
    print(f"  Price/200W-MA: {last_record['priceMa200wRatio']:.4f}")
    print(f"  MVRV Z-Score: {last_record['mvrvZscore']}")
    print(f"  LTH-MVRV: {last_record['lthMvrv']}")
    print(f"  Puell Multiple: {last_record['puellMultiple']}")
    print(f"  NUPL: {last_record['nupl']}")
    
    print("\n指标日期 (indicatorDates):")
    for k, v in latest.get('indicatorDates', {}).items():
        print(f"  {k}: {v}")
    
    print("\napiDataDate (历史记录):")
    api_dates = last_record.get('apiDataDate', {})
    for k, v in api_dates.items():
        print(f"  {k}: {v}")
    
    # 验证一致性
    print("\n" + "=" * 60)
    print("一致性检查结果:")
    print("=" * 60)
    
    checks = [
        ('日期', latest['date'], last_record['d']),
        ('BTC价格', latest['btcPrice'], last_record['btcPrice']),
        ('Price/200W-MA', latest['priceMa200wRatio'], last_record['priceMa200wRatio']),
        ('MVRV Z-Score', latest['mvrvZscore'], last_record['mvrvZscore']),
        ('LTH-MVRV', latest['lthMvrv'], last_record['lthMvrv']),
        ('Puell Multiple', latest['puellMultiple'], last_record['puellMultiple']),
        ('NUPL', latest['nupl'], last_record['nupl']),
    ]
    
    all_match = True
    for name, v1, v2 in checks:
        match = v1 == v2
        status = "✓ 一致" if match else "✗ 不一致"
        print(f"  {name}: {status}")
        if not match:
            print(f"    latest: {v1}")
            print(f"    history: {v2}")
            all_match = False
    
    print("\n" + "=" * 60)
    if all_match:
        print("✓ 所有数据一致")
    else:
        print("✗ 存在不一致数据")
    print("=" * 60)
    
    # 检查app/public目录
    print("\n检查 app/public 目录:")
    public_latest = Path('app/public/btc_indicators_latest.json')
    public_history = Path('app/public/btc_indicators_history.json')
    
    if public_latest.exists():
        with open(public_latest, 'r') as f:
            pub_latest = json.load(f)
        if pub_latest['date'] == latest['date']:
            print(f"  ✓ app/public/btc_indicators_latest.json 日期一致: {pub_latest['date']}")
        else:
            print(f"  ✗ app/public/btc_indicators_latest.json 日期不一致: {pub_latest['date']} vs {latest['date']}")
    
    if public_history.exists():
        with open(public_history, 'r') as f:
            pub_history = json.load(f)
        if len(pub_history) == len(history):
            print(f"  ✓ app/public/btc_indicators_history.json 记录数一致: {len(pub_history)}")
        else:
            print(f"  ✗ app/public/btc_indicators_history.json 记录数不一致: {len(pub_history)} vs {len(history)}")

if __name__ == '__main__':
    main()
