"""
数据校验与自动对齐工具

用于验证和修复前端展示数据与本地持久化数据之间的不一致性问题。
主要功能：
1. 验证历史数据与最新数据的一致性
2. 检查并修复 snake_case 和 camelCase 格式混用问题
3. 验证 indicatorDates 和 apiDataDate 字段的完整性
4. 自动对齐历史数据最后一条与 latest 文件
"""

import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

HISTORY_FILE = "btc_indicators_history.json"
LATEST_FILE = "btc_indicators_latest.json"
PUBLIC_DIR = "app/public"


def load_json_file(filepath: str) -> Optional[Any]:
    """加载 JSON 文件"""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f" [ERROR] 文件不存在：{filepath}")
        return None
    except json.JSONDecodeError as e:
        print(f" [ERROR] JSON 解析错误 {filepath}: {e}")
        return None


def save_json_file(filepath: str, data: Any, indent: int = 2) -> bool:
    """保存 JSON 文件"""
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)
        return True
    except Exception as e:
        print(f" [ERROR] 保存文件失败 {filepath}: {e}")
        return False


def normalize_keys(data: Dict) -> Dict:
    """将 snake_case 键转换为 camelCase"""
    if not isinstance(data, dict):
        return data

    result = {}
    for key, value in data.items():
        # 转换 snake_case 到 camelCase
        if "_" in key:
            parts = key.split("_")
            new_key = parts[0] + "".join(p.capitalize() for p in parts[1:])
        else:
            new_key = key

        # 递归处理嵌套字典
        if isinstance(value, dict):
            value = normalize_keys(value)
        elif isinstance(value, list):
            value = [normalize_keys(item) if isinstance(item, dict) else item for item in value]

        result[new_key] = value
    return result


def validate_indicator_dates(history: List[Dict], latest: Dict) -> Tuple[bool, List[str]]:
    """
    验证 indicatorDates 字段的完整性

    返回：(是否有效，问题列表)
    """
    issues = []

    if not history:
        issues.append("历史数据为空")
        return False, issues

    # 检查最新记录
    latest_record = history[-1]
    latest_date = latest_record.get("d", "")

    # 检查 latest 文件中的 indicatorDates
    indicator_dates = latest.get("indicatorDates", {})
    if not indicator_dates:
        issues.append("latest 文件中缺少 indicatorDates 字段")
    else:
        # 验证 priceMa200w 日期
        if "priceMa200w" not in indicator_dates:
            issues.append("indicatorDates 中缺少 priceMa200w 字段")
        elif indicator_dates["priceMa200w"] != latest_date:
            issues.append(f"priceMa200w 日期 ({indicator_dates['priceMa200w']}) 与最新记录日期 ({latest_date}) 不一致")

        # 验证其他指标日期
        for indicator in ["mvrvZ", "lthMvrv", "puell", "nupl"]:
            if indicator in indicator_dates:
                date_value = indicator_dates[indicator]
                if date_value != latest_date:
                    # 检查是否是历史日期（可能是数据未更新）
                    historical_dates = [r.get("d") for r in history]
                    if date_value not in historical_dates:
                        issues.append(f"{indicator} 日期 ({date_value}) 不在历史数据日期范围内")

    return len(issues) == 0, issues


def validate_data_consistency(history: List[Dict], latest: Dict) -> Tuple[bool, List[str]]:
    """
    验证历史数据与最新数据的一致性

    返回：(是否一致，问题列表)
    """
    issues = []

    if not history:
        issues.append("历史数据为空")
        return False, issues

    if not latest:
        issues.append("最新数据为空")
        return False, issues

    # 获取最新记录
    latest_record = history[-1]
    latest_date = latest_record.get("d", "")
    latest_date_in_file = latest.get("date", "") or latest.get("d", "")

    # 检查日期是否一致
    if latest_date != latest_date_in_file:
        issues.append(f"历史数据最后日期 ({latest_date}) 与 latest 文件日期 ({latest_date_in_file}) 不一致")

    # 检查关键字段是否一致
    field_mappings = [
        ("btcPrice", "btcPrice"),
        ("priceMa200wRatio", "priceMa200wRatio"),
        ("mvrvZscore", "mvrvZscore"),
        ("lthMvrv", "lthMvrv"),
        ("puellMultiple", "puellMultiple"),
        ("nupl", "nupl"),
    ]

    for history_key, latest_key in field_mappings:
        history_value = latest_record.get(history_key)
        latest_value = latest.get(latest_key)

        # 处理 null 和 0 的情况
        if history_value is None and latest_value == 0:
            continue
        if history_value == 0 and latest_value is None:
            continue

        if history_value != latest_value:
            # 特殊处理：如果都是数字且差值很小，认为是浮点精度问题
            if isinstance(history_value, (int, float)) and isinstance(latest_value, (int, float)):
                if abs(history_value - latest_value) < 0.0001:
                    continue

            issues.append(f"字段 {history_key} 不一致：历史记录={history_value}, latest={latest_value}")

    return len(issues) == 0, issues


def check_api_data_date(history: List[Dict]) -> Tuple[bool, List[str]]:
    """
    检查 apiDataDate 字段的完整性
    """
    issues = []

    if not history:
        return False, ["历史数据为空"]

    latest_record = history[-1]
    api_date = latest_record.get("apiDataDate") or latest_record.get("api_data_date")

    if api_date:
        # 检查 apiDataDate 中的日期是否在历史数据中
        historical_dates = {r.get("d") for r in history}
        for indicator, date in api_date.items():
            if date not in historical_dates:
                issues.append(f"apiDataDate 中的 {indicator} 日期 ({date}) 不在历史数据中")
    else:
        # 检查是否有需要 apiDataDate 的指标
        indicators_with_data = ["mvrvZscore", "lthMvrv", "puellMultiple", "nupl"]
        for indicator in indicators_with_data:
            value = latest_record.get(indicator)
            if value is not None and value != 0:
                # 有数据但没有 apiDataDate，可能需要添加
                pass  # 这不一定是问题，只是说明数据可能是通过或向前填充的

    return len(issues) == 0, issues


def sync_data(history: List[Dict], latest: Dict, auto_fix: bool = False) -> Tuple[Dict, bool]:
    """
    同步历史数据和最新数据

    返回：(更新后的 latest 数据，是否有修改)
    """
    if not history or not latest:
        return latest, False

    modified = False
    latest_record = history[-1]
    latest_date = latest_record.get("d", "")

    # 同步日期
    if latest.get("date") != latest_date:
        if auto_fix:
            latest["date"] = latest_date
            modified = True
            print(f" [FIX] 同步日期为：{latest_date}")
        else:
            print(f" [WARN] 日期不同步：latest.date={latest.get('date')}, history.d={latest_date}")

    # 同步 apiDataDate
    history_api_date = latest_record.get("apiDataDate") or latest_record.get("api_data_date")
    latest_api_date = latest.get("apiDataDate") or latest.get("api_data_date")

    if history_api_date and history_api_date != latest_api_date:
        if auto_fix:
            latest["apiDataDate"] = history_api_date
            modified = True
            print(f" [FIX] 同步 apiDataDate")

    # 同步 indicatorDates
    if history_api_date:
        current_indicator_dates = latest.get("indicatorDates", {})
        expected_indicator_dates = {
            "priceMa200w": latest_date,
            **history_api_date
        }

        for key, expected_value in expected_indicator_dates.items():
            if current_indicator_dates.get(key) != expected_value:
                if auto_fix:
                    if "indicatorDates" not in latest:
                        latest["indicatorDates"] = {}
                    latest["indicatorDates"][key] = expected_value
                    modified = True
                    print(f" [FIX] 同步 indicatorDates.{key} 为：{expected_value}")

    return latest, modified


def run_validation(auto_fix: bool = False) -> Dict:
    """
    运行数据校验和同步
    """
    print("=" * 60)
    print("数据校验与自动对齐工具")
    print("=" * 60)

    result = {
        "success": True,
        "issues": [],
        "fixed": 0,
        "history_records": 0,
        "latest_date": None,
    }

    # 加载数据
    print("\n[1] 加载数据...")
    history = load_json_file(HISTORY_FILE)
    latest = load_json_file(LATEST_FILE)

    if history is None or latest is None:
        print(" [ERROR] 无法加载必要的数据文件")
        result["success"] = False
        return result

    result["history_records"] = len(history)
    result["latest_date"] = latest.get("date") or latest.get("d")

    print(f"  历史数据记录数：{len(history)}")
    print(f"  最新数据日期：{result['latest_date']}")

    # 验证 indicatorDates
    print("\n[2] 验证 indicatorDates 字段...")
    valid, issues = validate_indicator_dates(history, latest)
    if issues:
        for issue in issues:
            print(f"  [ISSUE] {issue}")
        result["issues"].extend(issues)
    else:
        print("  [OK] indicatorDates 字段验证通过")

    # 验证数据一致性
    print("\n[3] 验证数据一致性...")
    valid, issues = validate_data_consistency(history, latest)
    if issues:
        for issue in issues:
            print(f"  [ISSUE] {issue}")
        result["issues"].extend(issues)
    else:
        print("  [OK] 数据一致性验证通过")

    # 检查 apiDataDate
    print("\n[4] 检查 apiDataDate 字段...")
    valid, issues = check_api_data_date(history)
    if issues:
        for issue in issues:
            print(f"  [ISSUE] {issue}")
        result["issues"].extend(issues)
    else:
        print("  [OK] apiDataDate 字段验证通过")

    # 同步数据
    print("\n[5] 同步历史数据与最新数据...")
    if result["issues"]:
        if auto_fix:
            print("  执行自动修复...")
            latest, modified = sync_data(history, latest, auto_fix=True)
            if modified:
                result["fixed"] += 1
                # 保存修复后的数据
                if save_json_file(LATEST_FILE, latest):
                    print(f"  [OK] 已保存修复后的数据到 {LATEST_FILE}")

                # 同步到 public 目录
                public_latest = os.path.join(PUBLIC_DIR, "btc_indicators_latest.json")
                if save_json_file(public_latest, latest):
                    print(f"  [OK] 已同步到 {public_latest}")
            else:
                print("  [INFO] 无需修复")
        else:
            print("  发现不一致问题，使用 --fix 参数执行自动修复")
            result["success"] = False
    else:
        print("  [OK] 数据已同步，无需修复")

    # 总结
    print("\n" + "=" * 60)
    if result["success"] and not result["issues"]:
        print("校验完成：所有检查通过")
    elif result["issues"]:
        print(f"校验完成：发现 {len(result['issues'])} 个问题")
        if auto_fix and result["fixed"] > 0:
            print(f"已修复 {result['fixed']} 个问题")
        else:
            print("建议运行 --fix 参数进行自动修复")
            result["success"] = False

    return result


if __name__ == "__main__":
    auto_fix = "--fix" in sys.argv or "-f" in sys.argv
    result = run_validation(auto_fix)
    sys.exit(0 if result["success"] else 1)
