#!/usr/bin/env python3
"""
本地存储同步修复工具
强制实现本地存储数据与前端展示数据的统一
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

def load_json_file(file_path: str) -> Optional[Dict]:
    """安全加载JSON文件"""
    try:
        if not os.path.exists(file_path):
            print(f"文件不存在: {file_path}")
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"加载文件失败 {file_path}: {e}")
        return None

def save_json_file(file_path: str, data: Dict) -> bool:
    """安全保存JSON文件"""
    try:
        # 确保目录存在
        dir_path = os.path.dirname(file_path)
        if dir_path:  # 只有当目录路径不为空时才创建
            os.makedirs(dir_path, exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"保存文件失败 {file_path}: {e}")
        return False

def normalize_indicator_data(item: Dict) -> Dict:
    """规范化指标数据格式（统一snake_case到camelCase）"""
    if not item or isinstance(item, str):
        return item
    
    # 处理api_data_date字段
    api_data_date = item.get('api_data_date') or item.get('apiDataDate')
    indicator_dates = None
    if api_data_date and isinstance(api_data_date, dict):
        indicator_dates = {
            'mvrvZ': api_data_date.get('mvrvZ') or api_data_date.get('mvrv_z'),
            'lthMvrv': api_data_date.get('lthMvrv') or api_data_date.get('lth_mvrv'),
            'puell': api_data_date.get('puell'),
            'nupl': api_data_date.get('nupl')
        }
    
    normalized = {
        'd': item.get('d'),
        'unixTs': item.get('unixTs') or item.get('unix_ts'),
        'btcPrice': item.get('btcPrice') or item.get('btc_price'),
        'priceMa200wRatio': item.get('priceMa200wRatio') or item.get('price_ma200w_ratio'),
        'ma200w': item.get('ma200w'),
        'mvrvZscore': item.get('mvrvZscore') or item.get('mvrv_zscore'),
        'lthMvrv': item.get('lthMvrv') or item.get('lth_mvrv'),
        'puellMultiple': item.get('puellMultiple') or item.get('puell_multiple'),
        'nupl': item.get('nupl'),
        'signalPriceMa': item.get('signalPriceMa') or item.get('signal_price_ma'),
        'signalMvrvZ': item.get('signalMvrvZ') or item.get('signal_mvrv_z'),
        'signalLthMvrv': item.get('signalLthMvrv') or item.get('signal_lth_mvrv'),
        'signalPuell': item.get('signalPuell') or item.get('signal_puell'),
        'signalNupl': item.get('signalNupl') or item.get('signal_nupl'),
        'signalCount': item.get('signalCount') or item.get('signal_count'),
        'apiDataDate': indicator_dates
    }
    
    # 移除None值，保持数据整洁
    return {k: v for k, v in normalized.items() if v is not None}

def normalize_latest_data(item: Dict) -> Dict:
    """规范化最新数据格式"""
    if not item or isinstance(item, str):
        return item
    
    # 处理indicatorDates字段
    api_data_date = item.get('api_data_date') or item.get('apiDataDate')
    incoming_indicator_dates = item.get('indicatorDates') or api_data_date
    
    indicator_dates = {
        'priceMa200w': incoming_indicator_dates.get('priceMa200w') if incoming_indicator_dates else item.get('date'),
        'mvrvZ': (incoming_indicator_dates.get('mvrvZ') or incoming_indicator_dates.get('mvrv_z')) if incoming_indicator_dates else item.get('date'),
        'lthMvrv': (incoming_indicator_dates.get('lthMvrv') or incoming_indicator_dates.get('lth_mvrv')) if incoming_indicator_dates else item.get('date'),
        'puell': incoming_indicator_dates.get('puell') if incoming_indicator_dates else item.get('date'),
        'nupl': incoming_indicator_dates.get('nupl') if incoming_indicator_dates else item.get('date')
    }
    
    # 处理signals字段
    signals = item.get('signals', {})
    normalized_signals = {
        'priceMa200w': signals.get('priceMa200w') or item.get('signalPriceMa') or item.get('signal_price_ma'),
        'mvrvZ': signals.get('mvrvZ') or item.get('signalMvrvZ') or item.get('signal_mvrv_z'),
        'lthMvrv': signals.get('lthMvrv') or item.get('signalLthMvrv') or item.get('signal_lth_mvrv'),
        'puell': signals.get('puell') or item.get('signalPuell') or item.get('signal_puell'),
        'nupl': signals.get('nupl') or item.get('signalNupl') or item.get('signal_nupl')
    }
    
    normalized = {
        'date': item.get('date') or item.get('d'),
        'btcPrice': item.get('btcPrice') or item.get('btc_price'),
        'priceMa200wRatio': item.get('priceMa200wRatio') or item.get('price_ma200w_ratio'),
        'ma200w': item.get('ma200w'),
        'mvrvZscore': item.get('mvrvZscore') or item.get('mvrv_zscore'),
        'lthMvrv': item.get('lthMvrv') or item.get('lth_mvrv'),
        'puellMultiple': item.get('puellMultiple') or item.get('puell_multiple'),
        'nupl': item.get('nupl'),
        'signalCount': item.get('signalCount') or item.get('signal_count'),
        'signals': normalized_signals,
        'indicatorDates': indicator_dates
    }
    
    # 添加lastUpdated字段
    if 'lastUpdated' in item:
        normalized['lastUpdated'] = item['lastUpdated']
    else:
        normalized['lastUpdated'] = datetime.now().isoformat()
    
    # 移除None值
    return {k: v for k, v in normalized.items() if v is not None}

def validate_data_consistency(history_data: List[Dict], latest_data: Dict) -> List[str]:
    """验证历史数据与最新数据的一致性"""
    issues = []
    
    if not history_data or not latest_data:
        issues.append("历史数据或最新数据为空")
        return issues
    
    # 检查最新日期是否匹配
    latest_history_date = history_data[-1].get('d') if history_data else None
    latest_summary_date = latest_data.get('date')
    
    if latest_history_date != latest_summary_date:
        issues.append(f"日期不匹配: 历史数据最新日期 {latest_history_date} vs 摘要日期 {latest_summary_date}")
    
    # 检查关键字段是否一致
    latest_history_record = history_data[-1]
    
    key_fields = ['btcPrice', 'mvrvZscore', 'lthMvrv', 'puellMultiple', 'nupl', 'signalCount']
    for field in key_fields:
        history_val = latest_history_record.get(field)
        latest_val = latest_data.get(field)
        
        if history_val != latest_val:
            issues.append(f"字段不一致 {field}: 历史({history_val}) vs 摘要({latest_val})")
    
    return issues

def sync_data_files():
    """同步所有数据文件，确保一致性"""
    print("=" * 60)
    print("本地存储数据同步修复工具")
    print(f"执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # 文件路径
    files = {
        'root_history': 'btc_indicators_history.json',
        'root_latest': 'btc_indicators_latest.json', 
        'public_history': 'app/public/btc_indicators_history.json',
        'public_latest': 'app/public/btc_indicators_latest.json'
    }
    
    # 1. 加载所有数据文件
    print("\n1. 加载数据文件...")
    data = {}
    for key, path in files.items():
        print(f"   加载 {path}...")
        data[key] = load_json_file(path)
        if data[key]:
            print(f"     ✓ 成功")
        else:
            print(f"     ✗ 失败")
    
    # 2. 确定权威数据源（优先使用public目录数据）
    print("\n2. 确定权威数据源...")
    
    # 历史数据权威源
    if data['public_history']:
        authority_history = data['public_history']
        print("   使用 app/public/btc_indicators_history.json 作为历史数据权威源")
    elif data['root_history']:
        authority_history = data['root_history']
        print("   使用根目录 btc_indicators_history.json 作为历史数据权威源")
    else:
        print("   ✗ 无可用的历史数据")
        return
    
    # 最新数据权威源
    if data['public_latest']:
        authority_latest = data['public_latest']
        print("   使用 app/public/btc_indicators_latest.json 作为最新数据权威源")
    elif data['root_latest']:
        authority_latest = data['root_latest']
        print("   使用根目录 btc_indicators_latest.json 作为最新数据权威源")
    else:
        print("   ✗ 无可用的最新数据")
        return
    
    # 3. 规范化数据格式
    print("\n3. 规范化数据格式...")
    
    # 规范化历史数据
    if isinstance(authority_history, list):
        normalized_history = [normalize_indicator_data(item) for item in authority_history]
        print(f"   规范化历史数据: {len(normalized_history)} 条记录")
    else:
        print("   ✗ 历史数据格式错误")
        return
    
    # 规范化最新数据
    if isinstance(authority_latest, dict):
        normalized_latest = normalize_latest_data(authority_latest)
        print("   规范化最新数据: ✓")
    else:
        print("   ✗ 最新数据格式错误")
        return
    
    # 4. 验证数据一致性
    print("\n4. 验证数据一致性...")
    issues = validate_data_consistency(normalized_history, normalized_latest)
    
    if issues:
        print(f"   发现 {len(issues)} 个一致性问题:")
        for issue in issues:
            print(f"     - {issue}")
    else:
        print("   ✓ 数据一致性验证通过")
    
    # 5. 重新生成最新数据摘要（确保与历史数据同步）
    print("\n5. 重新生成最新数据摘要...")
    
    if normalized_history:
        # 从历史数据最新记录生成摘要
        latest_record = normalized_history[-1]
        
        # 计算信号
        signals = {
            'priceMa200w': (latest_record.get('priceMa200wRatio') and latest_record['priceMa200wRatio'] < 1) or False,
            'mvrvZ': (latest_record.get('mvrvZscore') and latest_record['mvrvZscore'] < 0) or False,
            'lthMvrv': (latest_record.get('lthMvrv') and latest_record['lthMvrv'] < 1) or False,
            'puell': (latest_record.get('puellMultiple') and latest_record['puellMultiple'] < 0.5) or False,
            'nupl': (latest_record.get('nupl') and latest_record['nupl'] < 0) or False
        }
        
        signal_count = sum(1 for v in signals.values() if v)
        
        # 使用apiDataDate或默认最新日期
        api_data_date = latest_record.get('apiDataDate')
        indicator_dates = {
            'priceMa200w': latest_record.get('d'),
            'mvrvZ': api_data_date.get('mvrvZ') if api_data_date else latest_record.get('d'),
            'lthMvrv': api_data_date.get('lthMvrv') if api_data_date else latest_record.get('d'),
            'puell': api_data_date.get('puell') if api_data_date else latest_record.get('d'),
            'nupl': api_data_date.get('nupl') if api_data_date else latest_record.get('d')
        }
        
        regenerated_latest = {
            'date': latest_record.get('d'),
            'btcPrice': latest_record.get('btcPrice'),
            'priceMa200wRatio': latest_record.get('priceMa200wRatio'),
            'ma200w': latest_record.get('ma200w'),
            'mvrvZscore': latest_record.get('mvrvZscore'),
            'lthMvrv': latest_record.get('lthMvrv'),
            'puellMultiple': latest_record.get('puellMultiple'),
            'nupl': latest_record.get('nupl'),
            'signalCount': signal_count,
            'signals': signals,
            'indicatorDates': indicator_dates,
            'lastUpdated': datetime.now().isoformat()
        }
        
        print("   ✓ 重新生成最新数据摘要")
        
        # 替换权威最新数据
        normalized_latest = regenerated_latest
    else:
        print("   ⚠ 无法重新生成，使用原始最新数据")
    
    # 6. 同步到所有文件
    print("\n6. 同步数据到所有文件...")
    
    success_count = 0
    
    # 保存历史数据
    if save_json_file(files['root_history'], normalized_history):
        print(f"   ✓ 保存 {files['root_history']}")
        success_count += 1
    else:
        print(f"   ✗ 保存失败 {files['root_history']}")
    
    if save_json_file(files['public_history'], normalized_history):
        print(f"   ✓ 保存 {files['public_history']}")
        success_count += 1
    else:
        print(f"   ✗ 保存失败 {files['public_history']}")
    
    # 保存最新数据
    if save_json_file(files['root_latest'], normalized_latest):
        print(f"   ✓ 保存 {files['root_latest']}")
        success_count += 1
    else:
        print(f"   ✗ 保存失败 {files['root_latest']}")
    
    if save_json_file(files['public_latest'], normalized_latest):
        print(f"   ✓ 保存 {files['public_latest']}")
        success_count += 1
    else:
        print(f"   ✗ 保存失败 {files['public_latest']}")
    
    # 7. 总结
    print(f"\n{'='*60}")
    print("同步修复完成")
    print(f"成功同步文件: {success_count}/4")
    
    if success_count == 4:
        print("✓ 所有数据文件已强制同步统一")
        
        # 显示最新数据摘要
        print(f"\n最新数据摘要:")
        print(f"  日期: {normalized_latest.get('date')}")
        print(f"  BTC价格: ${normalized_latest.get('btcPrice'):,.2f}" if normalized_latest.get('btcPrice') else "  BTC价格: N/A")
        print(f"  买入信号: {normalized_latest.get('signalCount')}/5")
        
        # 显示指标日期
        indicator_dates = normalized_latest.get('indicatorDates', {})
        print(f"  指标日期:")
        for indicator, date in indicator_dates.items():
            print(f"    {indicator}: {date}")
    else:
        print("⚠ 部分文件同步失败，请检查错误信息")
    
    print('='*60)

if __name__ == '__main__':
    sync_data_files()
