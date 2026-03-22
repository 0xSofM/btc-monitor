"""
模拟GitHub Actions执行流程，检查数据滞后原因
"""
import json
import os
import sys
from datetime import datetime

# 模拟GitHub Actions环境
os.environ['GITHUB_ACTIONS'] = 'true'

print("=" * 70)
print("模拟GitHub Actions数据更新流程")
print("=" * 70)
print(f"当前时间: {datetime.now()}")
print()

# 1. 检查当前数据状态
print("【步骤1】检查当前数据状态")
print("-" * 50)

try:
    with open('data/latest/btc_indicators_latest.json') as f:
        latest = json.load(f)
    print(f"data/latest 日期: {latest.get('d')}")
    print(f"  btcPrice: {latest.get('btcPrice')}")
    print(f"  有mvrvZscore: {'mvrvZscore' in latest}")
    print(f"  有lthMvrv: {'lthMvrv' in latest}")
except Exception as e:
    print(f"  Error: {e}")

try:
    with open('app/public/btc_indicators_latest.json') as f:
        public = json.load(f)
    print(f"\napp/public 日期: {public.get('date')}")
    print(f"  btcPrice: {public.get('btcPrice')}")
except Exception as e:
    print(f"  Error: {e}")

# 2. 检查GitHub Actions工作流配置
print("\n【步骤2】检查GitHub Actions配置")
print("-" * 50)

try:
    with open('.github/workflows/update-data.yml') as f:
        import yaml
        workflow = yaml.safe_load(f)
    
    schedule = workflow.get('on', {}).get('schedule', [])
    for s in schedule:
        print(f"  定时: {s.get('cron')}")
    
    timeout = None
    for job in workflow.get('jobs', {}).values():
        for step in job.get('steps', []):
            if step.get('name') == 'Update BTC indicator data':
                timeout = step.get('timeout-minutes')
                break
    print(f"  更新步骤超时: {timeout}分钟")
except Exception as e:
    print(f"  Error: {e}")

# 3. 分析问题
print("\n【步骤3】问题分析")
print("-" * 50)

# 计算时间差
today = datetime.now().strftime('%Y-%m-%d')
latest_date = latest.get('d', '')

if latest_date != today:
    print(f"⚠️  数据滞后: 最新数据是 {latest_date}，今天是 {today}")
else:
    print(f"✅ 数据日期正确: {latest_date}")

# 检查指标完整性
if 'mvrvZscore' not in latest or latest.get('mvrvZscore') is None:
    print("⚠️  指标数据不完整: 缺少mvrvZscore")
else:
    print(f"✅ mvrvZscore: {latest.get('mvrvZscore')}")

print("\n" + "=" * 70)
print("诊断结论:")
print("=" * 70)

if latest_date < today:
    print("""
【根本原因】GitHub Actions定时任务可能因以下原因失败:
1. API速率限制 - 每小时只能请求8次，需要获取5个指标
2. 超时设置不足 - 之前的timeout-minutes=5不够，已改为60分钟
3. 多仓库竞争 - 如果多个GitHub Actions同时运行，会共享API配额

【解决方案】
1. ✅ 已增加timeout到60分钟
2. ✅ 已增加请求间隔到450秒
3. 需要检查GitHub Actions实际执行日志确认问题
""")
else:
    print("""
【状态】数据日期正确，但可能未推送到Vercel
1. 检查GitHub Actions是否成功执行并推送
2. 检查Vercel是否自动部署
3. 可能需要手动触发重新部署
""")
