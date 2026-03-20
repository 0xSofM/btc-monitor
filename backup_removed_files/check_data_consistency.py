#!/usr/bin/env python3
"""
数据一致性检查工具
检查前端展示的五个核心指标数值及日期与API实时获取的最新数据是否匹配
"""

import json
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any

# API配置
API_BASE_URL = 'https://bitcoin-data.com'

def fetch_api_data(endpoint: str) -> Optional[List[Dict]]:
    """获取API数据"""
    try:
        url = f"{API_BASE_URL}{endpoint}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"API请求失败 {endpoint}: {e}")
        return None

def get_latest_api_data() -> Dict[str, Any]:
    """获取API最新数据"""
    print("=" * 60)
    print("获取API实时数据...")
    print("=" * 60)
    
    # 并行获取所有指标数据
    endpoints = {
        'btc_price': '/v1/btc-price/1',
        'mvrv_z': '/v1/mvrv-zscore/1', 
        'lth_mvrv': '/v1/lth-mvrv/1',
        'puell': '/v1/puell-multiple/1',
        'nupl': '/v1/nupl/1'
    }
    
    results = {}
    for name, endpoint in endpoints.items():
        print(f"获取 {name}...")
        data = fetch_api_data(endpoint)
        if data and len(data) > 0:
            results[name] = data[0] if isinstance(data, list) else data
            # 获取显示值
            record = data[0] if isinstance(data, list) else data
            display_value = record.get('btcPrice')
            if not display_value:
                display_value = record.get('mvrvZscore')
            if not display_value:
                display_value = record.get('lthMvrv')
            if not display_value:
                display_value = record.get('puellMultiple')
            if not display_value:
                display_value = record.get('nupl')
            if not display_value:
                display_value = 'N/A'
                
            date = record.get('d', 'N/A')
            print(f"  ✓ {name}: {date} - {display_value}")
        else:
            print(f"  ✗ {name}: 获取失败")
    
    return results

def get_local_latest_data() -> Optional[Dict]:
    """获取本地最新数据文件"""
    try:
        with open('btc_indicators_latest.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"读取本地最新数据失败: {e}")
        return None

def get_public_latest_data() -> Optional[Dict]:
    """获取public目录最新数据文件"""
    try:
        with open('app/public/btc_indicators_latest.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"读取public最新数据失败: {e}")
        return None

def compare_data(api_data: Dict, local_data: Dict, source: str) -> None:
    """比较API数据与本地数据"""
    print(f"\n{'='*60}")
    print(f"数据一致性检查 - {source}")
    print('='*60)
    
    # 五个核心指标映射
    indicators = {
        'btcPrice': {
            'api_key': 'btc_price',
            'api_field': 'btcPrice',
            'local_field': 'btcPrice',
            'name': 'BTC价格'
        },
        'priceMa200wRatio': {
            'api_key': 'btc_price', 
            'api_field': None,  # 需要计算
            'local_field': 'priceMa200wRatio',
            'name': 'Price/200W-MA比值'
        },
        'mvrvZscore': {
            'api_key': 'mvrv_z',
            'api_field': 'mvrvZscore', 
            'local_field': 'mvrvZscore',
            'name': 'MVRV Z-Score'
        },
        'lthMvrv': {
            'api_key': 'lth_mvrv',
            'api_field': 'lthMvrv',
            'local_field': 'lthMvrv', 
            'name': 'LTH-MVRV'
        },
        'puellMultiple': {
            'api_key': 'puell',
            'api_field': 'puellMultiple',
            'local_field': 'puellMultiple',
            'name': 'Puell Multiple'
        },
        'nupl': {
            'api_key': 'nupl',
            'api_field': 'nupl',
            'local_field': 'nupl',
            'name': 'NUPL'
        }
    }
    
    consistency_issues = []
    
    for indicator, config in indicators.items():
        print(f"\n检查 {config['name']}:")
        
        # 获取API数据
        api_source = api_data.get(config['api_key'])
        if not api_source:
            print(f"  ✗ API数据缺失")
            consistency_issues.append(f"{config['name']}: API数据缺失")
            continue
            
        api_value = None
        if config['api_field']:
            api_value = api_source.get(config['api_field'])
        elif indicator == 'priceMa200wRatio':
            # 这个需要计算，暂时跳过
            print(f"  - 需要计算200周均线，跳过数值比较")
            api_value = None
        
        # 获取本地数据
        local_value = local_data.get(config['local_field'])
        
        # 获取日期信息
        api_date = api_source.get('d', 'N/A')
        local_date = local_data.get('indicatorDates', {}).get(
            'priceMa200w' if indicator == 'btcPrice' else 
            'mvrvZ' if indicator == 'mvrvZscore' else
            'lthMvrv' if indicator == 'lthMvrv' else
            'puell' if indicator == 'puellMultiple' else
            'nupl' if indicator == 'nupl' else None,
            local_data.get('date', 'N/A')
        )
        
        print(f"  API: {api_value} ({api_date})")
        print(f"  本地: {local_value} ({local_date})")
        
        # 检查数值一致性（允许小幅误差）
        if api_value is not None and local_value is not None:
            if isinstance(api_value, (int, float)) and isinstance(local_value, (int, float)):
                diff = abs(api_value - local_value)
                if diff > 0.01:  # 允许0.01的误差
                    print(f"  ⚠ 数值不一致: 差异 {diff}")
                    consistency_issues.append(f"{config['name']}: 数值不一致 (API:{api_value} vs 本地:{local_value})")
                else:
                    print(f"  ✓ 数值一致")
            else:
                if str(api_value) != str(local_value):
                    print(f"  ⚠ 数值不一致")
                    consistency_issues.append(f"{config['name']}: 数值不匹配")
                else:
                    print(f"  ✓ 数值一致")
        
        # 检查日期一致性
        if api_date != 'N/A' and local_date != 'N/A':
            if api_date != local_date:
                print(f"  ⚠ 日期不一致: API({api_date}) vs 本地({local_date})")
                consistency_issues.append(f"{config['name']}: 日期不一致")
            else:
                print(f"  ✓ 日期一致")
    
    # 总结
    print(f"\n{'='*60}")
    if consistency_issues:
        print(f"发现 {len(consistency_issues)} 个一致性问题:")
        for issue in consistency_issues:
            print(f"  - {issue}")
    else:
        print("✓ 所有数据检查项目均一致")
    print('='*60)

def main():
    print("BTC监控数据一致性检查工具")
    print(f"检查时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 获取API数据
    api_data = get_latest_api_data()
    
    # 获取本地数据
    local_data = get_local_latest_data()
    public_data = get_public_latest_data()
    
    # 比较数据
    if local_data:
        compare_data(api_data, local_data, "根目录本地文件")
    
    if public_data:
        compare_data(api_data, public_data, "app/public目录文件")
    
    # 检查两个本地文件是否一致
    if local_data and public_data:
        print(f"\n{'='*60}")
        print("本地文件一致性检查")
        print('='*60)
        
        if local_data == public_data:
            print("✓ 两个本地数据文件完全一致")
        else:
            print("⚠ 两个本地数据文件存在差异")
            # 详细比较
            for key in ['btcPrice', 'mvrvZscore', 'lthMvrv', 'puellMultiple', 'nupl']:
                local_val = local_data.get(key)
                public_val = public_data.get(key)
                if local_val != public_val:
                    print(f"  - {key}: 本地({local_val}) vs public({public_val})")

if __name__ == '__main__':
    main()
