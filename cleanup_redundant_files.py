"""
BTC Monitor 冗余文件清理脚本
删除已被新架构替代的旧文件
"""

import os
import shutil
from pathlib import Path


def cleanup_redundant_files():
    """清理冗余文件"""
    
    # 已被新架构替代的Python脚本
    redundant_scripts = [
        'auto_update_service.py',      # 替代为 src/services/auto_update_service.py
        'update_data.py',             # 替代为 src/core/data_updater.py
        'check_data.py',              # 替代为 src/services/data_validator.py
        'check_data_consistency.py',   # 替代为 src/services/data_validator.py
        'verify_latest_data.py',       # 替代为 src/services/data_validator.py
        'frontend_data_verification.py', # 替代为 src/services/data_validator.py
        'fix_data.py',                # 功能整合到 core 模块
        'fix_ma200_data.py',          # 功能整合到 core 模块
        'fix_history_api_dates.py',   # 功能整合到 core 模块
        'local_storage_sync_fix.py',   # 功能整合到 core 模块
        'validate_and_sync_data.py',   # 替代为 src/services/data_validator.py
        'check_api_dates.py',         # 替代为 src/core/api_client.py
        'check_history_api_dates.py',  # 替代为 src/core/api_client.py
        'check_history_dates.py',      # 替代为 src/core/api_client.py
        'check_indicator_lag.py',     # 功能整合到 core 模块
        'verify_data_match.py',        # 替代为 src/services/data_validator.py
        'check_structure.py',          # 简单功能，不再需要
    ]
    
    # 冗余文档文件
    redundant_docs = [
        'CLOUD_DEPLOY_GUIDE.md',      # 内容已整合到 README.md
        'DEPLOY_SUMMARY.md',          # 内容已整合到 README.md
        'QUICK_START.md',             # 内容已整合到 README.md
        'DATA_UPDATE_SOLUTION.md',    # 内容已整合到 README.md
        'RATE_LIMIT_SOLUTION.md',     # 内容已整合到 README.md
        'LOCAL_DEBUG_GUIDE.md',        # 内容已整合到 README.md
        'VERCEL_DEPLOY_CHECKLIST.md',  # 内容已整合到 README.md
        'PROJECT_AUDIT_REPORT.md',     # 临时报告文件
        'PROJECT_CLEANUP_REPORT.md',    # 临时报告文件
        'PROJECT_CLEANUP_ANALYSIS.md', # 临时报告文件
        'FINAL_DATA_VERIFICATION_REPORT.md', # 临时报告文件
        'FINAL_STRUCTURE.md',          # 临时报告文件
        'DATA_SYNC_FIX_REPORT.md',     # 临时报告文件
        'data_flow_analysis.md',       # 临时分析文件
    ]
    
    # 冗余脚本文件
    redundant_batch_scripts = [
        'start-data-service.bat',
        'start-monitor.bat',
        'create-desktop-shortcut.ps1',
        'deploy-to-vercel.ps1',
    ]
    
    # 其他冗余文件
    redundant_other = [
        'btc-monitor-deploy.zip',      # 旧的部署包
        'check_output.txt',           # 临时输出文件
        'btc_update.log',             # 旧日志文件（新日志在项目根目录）
        'project_structure_analysis.md', # 临时分析文件
    ]
    
    # 创建备份目录
    backup_dir = Path('backup_removed_files')
    backup_dir.mkdir(exist_ok=True)
    
    moved_files = []
    removed_files = []
    
    def move_to_backup(file_path):
        """移动文件到备份目录"""
        source = Path(file_path)
        if source.exists():
            dest = backup_dir / source.name
            shutil.move(str(source), str(dest))
            moved_files.append(str(source))
            print(f"✓ 移动到备份: {source} -> {dest}")
    
    def remove_file(file_path):
        """删除文件"""
        source = Path(file_path)
        if source.exists():
            source.unlink()
            removed_files.append(str(source))
            print(f"✗ 删除: {source}")
    
    # 处理各类冗余文件
    all_redundant = redundant_scripts + redundant_docs + redundant_batch_scripts + redundant_other
    
    for file_name in all_redundant:
        move_to_backup(file_name)
    
    # 清理空的 __pycache__ 目录
    for pycache in Path('.').rglob('__pycache__'):
        if pycache.is_dir():
            shutil.rmtree(pycache)
            print(f"✗ 删除目录: {pycache}")
    
    # 生成清理报告
    report = f"""
# BTC Monitor 清理报告

## 清理时间
{os.popen('date').read().strip()}

## 移动到备份的文件 ({len(moved_files)} 个)
"""
    for f in moved_files:
        report += f"- {f}\n"
    
    report += f"""
## 直接删除的文件/目录 ({len(removed_files)} 个)
"""
    for f in removed_files:
        report += f"- {f}\n"
    
    report += """
## 说明
- 所有被删除的文件都已备份到 `backup_removed_files/` 目录
- 如果发现误删，可以从备份目录恢复
- 新的架构使用 `src/` 目录下的模块化代码
- 文档已整合到主 README.md 文件中

## 新的命令行工具
```bash
# 数据更新
python src/cli/main.py update

# 数据验证
python src/cli/main.py validate

# API 检查
python src/cli/main.py check-api
```
"""
    
    with open('cleanup_report.md', 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n清理完成！")
    print(f"- 移动了 {len(moved_files)} 个文件到备份目录")
    print(f"- 删除了 {len(removed_files)} 个文件/目录")
    print(f"- 详细的清理报告已保存到 cleanup_report.md")
    print(f"- 备份文件位于 backup_removed_files/ 目录")


if __name__ == "__main__":
    print("开始清理 BTC Monitor 冗余文件...")
    print("注意：所有文件都会先备份到 backup_removed_files/ 目录\n")
    
    response = input("确认继续清理吗？(y/N): ")
    if response.lower() in ['y', 'yes']:
        cleanup_redundant_files()
    else:
        print("清理已取消")
