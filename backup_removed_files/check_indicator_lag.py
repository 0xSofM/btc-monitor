#!/usr/bin/env python3
"""检查指标数据滞后情况"""

import json
from pathlib import Path

def main():
    h = json.load(open('btc_indicators_history.json'))
    
    print('=' * 80)
    print('检查1: 各指标数据滞后情况')
    print('=' * 80)
    
    # 显示最近15天数据
    print('\n最近15天各指标值:')
    print('-' * 80)
    header = f"{'日期':<12} {'BTC价格':>12} {'MVRV':>8} {'LTH-MVRV':>10} {'Puell':>8} {'NUPL':>10}"
    print(header)
    print('-' * 80)
    
    for record in h[-15:]:
        d = record['d']
        price = record.get('btcPrice', 0) or 0
        mvrv = record.get('mvrvZscore')
        lth = record.get('lthMvrv')
        puell = record.get('puellMultiple')
        nupl = record.get('nupl')
        
        mvrv_str = f"{mvrv:.4f}" if mvrv is not None else "N/A"
        lth_str = f"{lth:.2f}" if lth is not None else "N/A"
        puell_str = f"{puell:.3f}" if puell is not None else "N/A"
        nupl_str = f"{nupl:.4f}" if nupl is not None else "N/A"
        
        print(f"{d:<12} ${price:>10,.2f} {mvrv_str:>8} {lth_str:>10} {puell_str:>8} {nupl_str:>10}")
    
    # 检查每个指标值最后一次变化的日期
    print('\n' + '=' * 80)
    print('各指标值最后变化日期分析:')
    print('=' * 80)
    
    def find_last_value_change(history, field):
        """找到指标值最后一次变化的日期"""
        prev_val = None
        for i in range(len(history) - 1, -1, -1):
            val = history[i].get(field)
            if val is not None and val != 0:
                if prev_val is None:
                    prev_val = val
                elif val != prev_val:
                    # 找到变化点，返回变化后的日期
                    return history[i+1]['d'], history[i+1].get(field)
        return None, prev_val
    
    fields = {
        'mvrvZscore': 'MVRV Z-Score',
        'lthMvrv': 'LTH-MVRV',
        'puellMultiple': 'Puell Multiple',
        'nupl': 'NUPL'
    }
    
    latest = h[-1]
    print(f"\n最新记录日期: {latest['d']}")
    print(f"最新记录的 apiDataDate: {latest.get('apiDataDate', {})}")
    print()
    
    for field, name in fields.items():
        change_date, change_val = find_last_value_change(h, field)
        current_val = latest.get(field)
        
        # 检查值是否连续相同
        same_count = 0
        for i in range(len(h) - 1, -1, -1):
            if h[i].get(field) == current_val:
                same_count += 1
            else:
                break
        
        print(f"{name}:")
        print(f"  当前值: {current_val}")
        print(f"  值开始出现的日期: {change_date}")
        print(f"  连续相同天数: {same_count}")
        print()
    
    # 检查2: 前端历史数据与本地存储一致性
    print('=' * 80)
    print('检查2: 前端历史数据与本地存储一致性')
    print('=' * 80)
    
    public_history = Path('app/public/btc_indicators_history.json')
    
    if public_history.exists():
        with open(public_history, 'r') as f:
            pub_h = json.load(f)
        
        print(f"\n本地历史记录数: {len(h)}")
        print(f"前端历史记录数: {len(pub_h)}")
        
        # 比较最后10条记录
        print('\n比较最后10条记录:')
        all_match = True
        for i in range(-10, 0):
            local_rec = h[i]
            public_rec = pub_h[i]
            
            match = (local_rec['d'] == public_rec['d'] and
                     local_rec.get('btcPrice') == public_rec.get('btcPrice') and
                     local_rec.get('mvrvZscore') == public_rec.get('mvrvZscore') and
                     local_rec.get('lthMvrv') == public_rec.get('lthMvrv') and
                     local_rec.get('puellMultiple') == public_rec.get('puellMultiple') and
                     local_rec.get('nupl') == public_rec.get('nupl'))
            
            status = "✓" if match else "✗"
            if not match:
                all_match = False
                print(f"  {status} {local_rec['d']}: 不匹配")
                print(f"      本地: {local_rec}")
                print(f"      前端: {public_rec}")
            else:
                print(f"  {status} {local_rec['d']}: 匹配")
        
        print()
        if all_match:
            print("✓ 前端历史数据与本地存储完全一致")
        else:
            print("✗ 存在不一致的记录")
    else:
        print("✗ 前端历史数据文件不存在")

if __name__ == '__main__':
    main()
