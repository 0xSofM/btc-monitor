#!/usr/bin/env python3
"""
验证最新数据：对比历史文件最后一条记录与最新摘要文件
"""

import json

def load_json_file(filename):
    """加载JSON文件"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"加载文件失败 {filename}: {e}")
        return None

def main():
    print("=" * 60)
    print("验证最新数据一致性")
    print("=" * 60)
    
    # 加载数据
    history = load_json_file('btc_indicators_history.json')
    latest = load_json_file('btc_indicators_latest.json')
    
    if not history or not latest:
        print("数据加载失败")
        return
    
    # 获取历史数据最后一条记录
    last_record = history[-1]
    
    print("\n历史数据最后一条记录:")
    print(f"  日期: {last_record.get('d')}")
    print(f"  BTC价格: {last_record.get('btcPrice')}")
    print(f"  Price/200W-MA: {last_record.get('priceMa200wRatio')}")
    print(f"  MVRV Z-Score: {last_record.get('mvrvZscore')}")
    print(f"  LTH-MVRV: {last_record.get('lthMvrv')}")
    print(f"  Puell Multiple: {last_record.get('puellMultiple')}")
    print(f"  NUPL: {last_record.get('nupl')}")
    print(f"  Signal Count: {last_record.get('signalCount')}")
    print(f"  API数据日期: {last_record.get('apiDataDate')}")
    
    print("\n最新摘要数据:")
    print(f"  日期: {latest.get('date')}")
    print(f"  BTC价格: {latest.get('btcPrice')}")
    print(f"  Price/200W-MA: {latest.get('priceMa200wRatio')}")
    print(f"  MVRV Z-Score: {latest.get('mvrvZscore')}")
    print(f"  LTH-MVRV: {latest.get('lthMvrv')}")
    print(f"  Puell Multiple: {latest.get('puellMultiple')}")
    print(f"  NUPL: {latest.get('nupl')}")
    print(f"  Signal Count: {latest.get('signalCount')}")
    print(f"  指标日期: {latest.get('indicatorDates')}")
    
    # 对比关键字段
    print("\n" + "=" * 60)
    print("数据一致性检查:")
    print("=" * 60)
    
    # 检查日期
    hist_date = last_record.get('d')
    latest_date = latest.get('date')
    print(f"日期匹配: {hist_date} == {latest_date} -> {'✓' if hist_date == latest_date else '✗'}")
    
    # 检查数值字段
    fields = ['btcPrice', 'priceMa200wRatio', 'mvrvZscore', 'lthMvrv', 'puellMultiple', 'nupl', 'signalCount']
    
    all_match = True
    for field in fields:
        hist_val = last_record.get(field)
        latest_val = latest.get(field)
        
        # 处理浮点数比较
        if isinstance(hist_val, (int, float)) and isinstance(latest_val, (int, float)):
            match = abs(hist_val - latest_val) < 0.0001
        else:
            match = hist_val == latest_val
        
        status = '✓' if match else '✗'
        print(f"{field}: {hist_val} == {latest_val} -> {status}")
        
        if not match:
            all_match = False
    
    print(f"\n整体一致性: {'✓ 所有数据匹配' if all_match else '✗ 存在不匹配'}")
    
    # 检查API数据日期
    api_dates = last_record.get('apiDataDate')
    indicator_dates = latest.get('indicatorDates')
    
    print(f"\nAPI数据日期对比:")
    print(f"  历史记录: {api_dates}")
    print(f"  最新摘要: {indicator_dates}")
    
    if api_dates and indicator_dates:
        date_match = True
        for key in ['mvrvZ', 'lthMvrv', 'puell', 'nupl']:
            api_date = api_dates.get(key)
            summary_date = indicator_dates.get(key)
            match = api_date == summary_date
            status = '✓' if match else '✗'
            print(f"  {key}: {api_date} == {summary_date} -> {status}")
            if not match:
                date_match = False
        
        if date_match:
            print("  所有API数据日期匹配 ✓")
        else:
            print("  部分API数据日期不匹配 ✗")

if __name__ == '__main__':
    main()
