#!/usr/bin/env python3
"""修复历史数据中缺失的指标数据 - 使用前向填充"""

import json
from typing import Optional

def fill_missing_values(data):
    """使用前向填充修复缺失的指标数据"""
    
    # 需要填充的字段
    indicator_fields = ['mvrvZscore', 'lthMvrv', 'puellMultiple', 'nupl']
    
    # 记录每个字段的最新值
    last_values = {}
    
    # 第一遍：从前向后填充
    for record in data:
        for field in indicator_fields:
            if record.get(field) is not None:
                # 有值，更新 last_values
                last_values[field] = record[field]
            elif field in last_values:
                # 无值，使用最近的值
                record[field] = last_values[field]
    
    # 重新计算信号
    for record in data:
        price = record.get('btcPrice')
        ratio = record.get('price_ma200w_ratio')
        mvrv = record.get('mvrvZscore')
        lth = record.get('lthMvrv')
        puell = record.get('puellMultiple')
        nupl = record.get('nupl')
        
        record['signal_price_ma'] = (price and ratio and price / ratio < 1) or False
        record['signal_mvrv_z'] = (mvrv is not None and mvrv < 0) or False
        record['signal_lth_mvrv'] = (lth is not None and lth < 1) or False
        record['signal_puell'] = (puell is not None and puell < 0.5) or False
        record['signal_nupl'] = (nupl is not None and nupl < 0) or False
        
        record['signal_count'] = sum([
            record['signal_price_ma'],
            record['signal_mvrv_z'],
            record['signal_lth_mvrv'],
            record['signal_puell'],
            record['signal_nupl']
        ])
    
    return data

def main():
    # 读取历史数据
    print("读取历史数据...")
    with open('app/public/btc_indicators_history.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"总记录数: {len(data)}")
    
    # 修复前统计
    incomplete_before = sum(1 for r in data if r.get('mvrvZscore') is None)
    print(f"修复前缺失指标的记录: {incomplete_before}")
    
    # 修复数据
    print("修复缺失的指标数据...")
    data = fill_missing_values(data)
    
    # 修复后统计
    incomplete_after = sum(1 for r in data if r.get('mvrvZscore') is None)
    print(f"修复后缺失指标的记录: {incomplete_after}")
    
    # 保存
    print("保存修复后的数据...")
    with open('app/public/btc_indicators_history.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    with open('btc_indicators_history.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # 更新 latest 文件
    latest = data[-1]
    latest_summary = {
        'date': latest['d'],
        'btcPrice': latest['btcPrice'],
        'priceMa200wRatio': latest['price_ma200w_ratio'],
        'mvrvZscore': latest['mvrvZscore'],
        'lthMvrv': latest['lthMvrv'],
        'puellMultiple': latest['puellMultiple'],
        'nupl': latest['nupl'],
        'signalCount': latest['signal_count'],
        'signals': {
            'priceMa200w': latest['signal_price_ma'],
            'mvrvZ': latest['signal_mvrv_z'],
            'lthMvrv': latest['signal_lth_mvrv'],
            'puell': latest['signal_puell'],
            'nupl': latest['signal_nupl']
        },
        'lastUpdated': 'fixed'
    }
    
    with open('app/public/btc_indicators_latest.json', 'w', encoding='utf-8') as f:
        json.dump(latest_summary, f, indent=2, ensure_ascii=False)
    
    with open('btc_indicators_latest.json', 'w', encoding='utf-8') as f:
        json.dump(latest_summary, f, indent=2, ensure_ascii=False)
    
    # 显示最后几条记录
    print("\n=== 修复后最后3条记录 ===")
    for record in data[-3:]:
        print(f"日期: {record['d']}")
        print(f"  BTC价格: {record['btcPrice']:.2f}")
        print(f"  MVRV: {record.get('mvrvZscore')}")
        print(f"  LTH-MVRV: {record.get('lthMvrv')}")
        print(f"  Puell: {record.get('puellMultiple')}")
        print(f"  NUPL: {record.get('nupl')}")
        print(f"  信号数: {record.get('signal_count')}")
        print()
    
    print("[OK] 数据修复完成！")

if __name__ == '__main__':
    main()
