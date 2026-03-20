#!/usr/bin/env python3
"""
为历史数据添加 apiDataDate 字段

此脚本扫描历史数据文件，根据指标值的变化推断每个指标最后从API获取数据的日期，
并添加 apiDataDate 字段。

逻辑：
1. priceMa200w 使用最新记录的日期（因为它是根据价格计算的）
2. 其他指标：从后向前查找，找到该指标值最后一次变化后首次出现的日期
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any


def get_value(record: Dict, *keys) -> Optional[float]:
    """从记录中获取值，支持多个可能的键名"""
    if not record:
        return None
    for key in keys:
        if key in record:
            return record.get(key)
    return None


def find_indicator_dates(history: List[Dict]) -> Dict[str, str]:
    """
    查找每个指标最后更新的日期。
    
    逻辑：
    1. priceMa200w 使用最新记录的日期（因为它是根据价格计算的）
    2. 其他指标：从后向前查找，找到该指标值最后一次变化时的日期
       - 即：当前值首次出现的日期，这才是API返回新数据的日期
    """
    if not history:
        return {}
    
    latest = history[-1]
    dates = {
        "priceMa200w": latest["d"],
    }
    
    mapping = {
        "mvrvZ": ("mvrvZscore",),
        "lthMvrv": ("lthMvrv",),
        "puell": ("puellMultiple",),
        "nupl": ("nupl",),
    }
    
    # 首先尝试从最新记录获取指标值
    latest_values = {name: get_value(latest, *keys) for name, keys in mapping.items()}
    
    # 对于有最新值的指标，从后向前查找该值首次出现的日期
    for name, keys in mapping.items():
        latest_value = latest_values.get(name)
        if latest_value is None:
            # 该指标从未有过有效值，不添加
            continue
        
        # 从后向前查找，找到值第一次出现的位置
        first_occurrence_date = None
        for index in range(len(history) - 1, -1, -1):
            record = history[index]
            current_value = get_value(record, *keys)
            if current_value is None:
                # 遇到 None 值，说明之前没有数据，停止遍历
                break
            if current_value == latest_value:
                # 值相同，记录日期（继续向前查找看是否有更早的相同值）
                first_occurrence_date = record["d"]
            else:
                # 值不同，说明已经找到值变化的边界
                break
        
        if first_occurrence_date:
            dates[name] = first_occurrence_date
    
    return dates


def fix_history_file(input_file: str, output_file: Optional[str] = None) -> int:
    """
    为历史数据文件添加 apiDataDate 字段
    
    apiDataDate 记录每个指标值最后一次变化的日期（即API返回新数据的日期）
    
    返回：修复的记录数量
    """
    print(f"读取历史数据文件: {input_file}")
    
    with open(input_file, 'r', encoding='utf-8') as f:
        history = json.load(f)
    
    print(f"总记录数: {len(history)}")
    
    if not history:
        print("历史数据为空，无需处理")
        return 0
    
    # 追踪每个指标当前值和值变化的日期
    last_value = {
        'mvrvZ': None,
        'lthMvrv': None,
        'puell': None,
        'nupl': None
    }
    
    # 记录每个指标值最后一次变化的日期
    last_change_date = {
        'mvrvZ': None,
        'lthMvrv': None,
        'puell': None,
        'nupl': None
    }
    
    fixed_count = 0
    
    for record in history:
        date = record.get('d')
        if not date:
            continue
        
        # 检查每个指标值是否变化
        indicators = [
            ('mvrvZ', 'mvrvZscore'),
            ('lthMvrv', 'lthMvrv'),
            ('puell', 'puellMultiple'),
            ('nupl', 'nupl')
        ]
        
        for indicator_name, field_name in indicators:
            current_val = get_value(record, field_name)
            
            if current_val is not None:
                # 如果是第一次有值，或者值发生了变化
                if last_value[indicator_name] is None or current_val != last_value[indicator_name]:
                    last_change_date[indicator_name] = date
                    last_value[indicator_name] = current_val
                # 如果值相同，保持 last_change_date 不变（向前填充）
        
        # 构建 apiDataDate 字段：记录当前记录中各指标值最后变化的日期
        api_data_date = {}
        for indicator_name in ['mvrvZ', 'lthMvrv', 'puell', 'nupl']:
            if last_change_date[indicator_name] is not None:
                api_data_date[indicator_name] = last_change_date[indicator_name]
        
        # 只有当 apiDataDate 有内容时才添加
        if api_data_date:
            record['apiDataDate'] = api_data_date
            fixed_count += 1
    
    print(f"添加 apiDataDate 字段的记录数: {fixed_count}")
    
    # 输出文件路径
    output_path = output_file or input_file
    
    # 保存修复后的数据
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=None, separators=(',', ':'))
    
    print(f"已保存到: {output_path}")
    
    return fixed_count


def main():
    import sys
    
    # 默认文件路径
    root_history = "btc_indicators_history.json"
    public_history = "app/public/btc_indicators_history.json"
    
    files_to_fix = []
    
    # 检查文件是否存在
    if Path(root_history).exists():
        files_to_fix.append(root_history)
    if Path(public_history).exists():
        files_to_fix.append(public_history)
    
    if not files_to_fix:
        print("未找到历史数据文件")
        return 1
    
    print("=" * 60)
    print("为历史数据添加 apiDataDate 字段")
    print("=" * 60)
    
    for file_path in files_to_fix:
        print(f"\n处理文件: {file_path}")
        fix_history_file(file_path)
    
    print("\n" + "=" * 60)
    print("处理完成")
    print("=" * 60)
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
