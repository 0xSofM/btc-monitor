# BTC定投指标数据更新方案

## 问题分析

### 1. 原始问题
- **CORS 跨域问题**: 浏览器端直接请求 BGeometrics API 会遇到跨域限制
- **API 限制**: 免费版每小时限制 8 次请求
- **数据更新**: 需要自动化方案定期更新数据

## 解决方案（已实施）

### 方案一：GitHub Actions 自动更新（推荐 ⭐）

已创建 `.github/workflows/update-data.yml`，每天自动运行两次（北京时间 08:00 和 20:00）。

**使用方法：**
1. 将代码推送到 GitHub
2. GitHub Actions 会自动运行，每天更新数据
3. 更新后的数据会自动提交到仓库

**手动触发：**
- 进入 GitHub 仓库 → Actions → Update BTC Indicator Data → Run workflow

---

### 方案二：自动数据更新服务（新增 ⭐⭐ 推荐）

提供了 `auto_update_service.py`，支持多种运行模式：单次更新、守护进程模式、每日定时模式。

#### 快速开始

**Windows 用户（最简单）：**
```powershell
# 双击运行或使用 PowerShell
.\start-data-service.ps1
```

**使用批处理文件：**
```batch
start-data-service.bat
```

#### 命令行使用

```bash
# 单次更新
python auto_update_service.py

# 守护进程模式（每10分钟更新）
python auto_update_service.py --daemon

# 自定义间隔（每5分钟）
python auto_update_service.py --daemon --interval 300

# 每日定时（每天8点和20点）
python auto_update_service.py --daily

# 自定义时间
python auto_update_service.py --daily --time "09:00,18:00,22:00"

# 检查 API 连接
python auto_update_service.py --check

# 详细日志
python auto_update_service.py -v
```

#### PowerShell 脚本功能

```powershell
# 交互式菜单
.\start-data-service.ps1

# 单次更新
.\start-data-service.ps1 -Mode Once

# 守护进程
.\start-data-service.ps1 -Mode Daemon -Interval 300

# 每日定时
.\start-data-service.ps1 -Mode Daily -Times "08:00,20:00"

# 检查连接
.\start-data-service.ps1 -Mode Check

# 安装 Windows 计划任务（需要管理员权限）
.\start-data-service.ps1 -InstallTask

# 卸载计划任务
.\start-data-service.ps1 -UninstallTask
```

#### 特性

- ✅ **自动重试**: API 请求失败自动重试 3 次
- ✅ **智能缓存**: 内存缓存避免重复请求
- ✅ **优雅退出**: 支持 Ctrl+C 优雅停止
- ✅ **日志记录**: 详细的操作日志（控制台 + 文件）
- ✅ **数据验证**: 自动修复 NaN/Inf 值
- ✅ **双份保存**: 同时保存到 app/public 和项目根目录

---

### 方案三：本地代理服务器（开发环境）

使用 `proxy-server.js` 作为本地开发代理，解决 CORS 问题。

#### 使用方法

```bash
# 启动代理服务器
node proxy-server.js

# 启用自动刷新（同时启动数据更新服务）
set AUTO_REFRESH=true && node proxy-server.js
```

#### 前端配置

创建 `app/.env.local` 文件：
```
VITE_API_PROXY_URL=http://localhost:3001/api
```

#### 功能

- 🔄 代理 API 请求到 BGeometrics
- 📁 提供静态文件服务
- 💾 缓存 API 响应（5分钟）
- 🔄 可选自动数据刷新
- 🌐 CORS 支持

---

### 方案四：Windows 本地定时任务

适用于在本地 Windows 环境运行的场景。

**快速设置：**

1. **以管理员身份**打开 PowerShell，执行：
```powershell
cd 项目目录
.\scripts\setup-scheduled-task.ps1 -Hour 8 -Minute 0
```

2. 这会在 Windows 计划任务中创建一个每天 8:00 运行的任务

**管理任务：**
```powershell
# 立即运行
Start-ScheduledTask -TaskName "BTC-DCA-DataUpdate"

# 查看任务信息
Get-ScheduledTaskInfo -TaskName "BTC-DCA-DataUpdate"

# 删除任务
Unregister-ScheduledTask -TaskName "BTC-DCA-DataUpdate" -Confirm:$false
```

**手动运行更新：**
```powershell
# PowerShell 方式
.\scripts\update-btc-data.ps1

# 批处理方式
.\scripts\update-btc-data.bat
```

---

### 方案五：Vercel Edge Function 代理（可选）

如果部署到 Vercel，可以使用 Serverless Function 作为 API 代理，解决 CORS 问题。

**文件位置：** `app/api/btc-data.js`

**使用方法：**
1. 部署到 Vercel
2. 前端通过 `/api/btc-data/latest` 获取实时数据
3. 支持 CORS，可直接被浏览器调用

**前端修改：** 如需使用此方案，需要修改 `dataService.ts` 中的 API 地址：
```typescript
// 修改前
const API_BASE_URL = 'https://bitcoin-data.com';

// 修改后（Vercel 部署后）
const API_BASE_URL = '/api';
```

---

### 方案六：手动运行更新脚本

**检查 API 连接：**
```bash
python update_data.py --check-only
```

**完整更新数据：**
```bash
python update_data.py
```

**指定输出路径：**
```bash
python update_data.py --output ./custom/path/data.json
```

---

## 推荐配置

### 开发环境（本地）

**方案 A - 代理服务器（推荐）:**
```bash
# 终端 1：启动代理服务器
node proxy-server.js

# 终端 2：启动前端开发服务器
cd app && npm run dev
```

**方案 B - 自动更新服务:**
```bash
# 启动自动更新服务
python auto_update_service.py --daemon

# 然后启动前端
cd app && npm run dev
```

### 生产环境（GitHub Pages / Vercel / Netlify）

**推荐组合:**
1. **GitHub Actions**: 每天自动更新数据文件
2. **前端缓存策略**: 使用 dataService.ts 的自动刷新功能
3. **CDN 部署**: 静态文件部署到 CDN

### 私有服务器部署

**Linux 服务器:**
```bash
# 使用 crontab 设置定时任务
crontab -e

# 添加以下行（每天8点和20点更新）
0 8,20 * * * cd /path/to/project && /usr/bin/python3 auto_update_service.py
```

**Windows 服务器:**
```powershell
# 使用新的 PowerShell 脚本安装任务
.\start-data-service.ps1 -InstallTask
```

---

## 前端自动刷新

改进后的 `dataService.ts` 支持自动刷新：

```typescript
import { startAutoRefresh, fetchAllLatestIndicators } from '@/services/dataService';

// 在 React 组件中使用
useEffect(() => {
  // 启动自动刷新（每5分钟）
  const cleanup = startAutoRefresh((data) => {
    setLatestData(data);
  }, 5 * 60 * 1000);
  
  return cleanup; // 组件卸载时清理
}, []);
```

### 数据源优先级

1. **API 直连**（如果配置了代理）
2. **代理服务器**（如果配置了 CORS 代理）
3. **历史数据文件**（JSON 文件）
4. **本地存储**（LocalStorage 缓存）

---

## 数据文件说明

### 输出文件
- `app/public/btc_indicators_history.json` - 前端使用的历史数据
- `btc_indicators_history.json` - 根目录备份（同时更新）
- `btc_indicators_latest.json` - 最新数据摘要

### 数据字段
```json
{
  "d": "2026-03-16",                    // 日期
  "btcPrice": 72798.23,                 // BTC价格
  "price_ma200w_ratio": 1.2357,         // 价格/200周MA比值
  "mvrvZscore": 0.5778,                 // MVRV Z-Score
  "lthMvrv": 1.690,                     // LTH-MVRV
  "puellMultiple": 0.631,               // Puell Multiple
  "nupl": 0.2334,                       // NUPL
  "signal_price_ma": false,             // Price/200W-MA信号
  "signal_mvrv_z": false,               // MVRV-Z信号
  "signal_lth_mvrv": false,             // LTH-MVRV信号
  "signal_puell": false,                // Puell信号
  "signal_nupl": false,                 // NUPL信号
  "signal_count": 0                     // 总信号数
}
```

---

## 买入信号阈值

| 指标 | 目标值 | 说明 |
|------|--------|------|
| BTC Price / 200W-MA | < 1 | 价格低于200周均线 |
| MVRV Z-Score | < 0 | 市场价值低于历史平均 |
| LTH-MVRV | < 1 | 长期持有者亏损 |
| Puell Multiple | < 0.5 | 矿工收入低于平均 |
| NUPL | < 0 | 网络整体亏损 |

---

## 故障排除

### API 请求失败
- 检查网络连接
- BGeometrics API 免费版每小时限制 8 次请求
- 使用代理服务器缓存响应
- 检查 `btc_update.log` 日志文件

### 数据未更新
- 检查自动更新服务是否运行: `python auto_update_service.py --check`
- 查看 GitHub Actions 运行状态
- 检查 `scripts/update-btc-data.ps1` 执行日志
- 确认 `requests` 模块已安装: `pip install requests`

### CORS 问题（开发环境）
- 启动代理服务器: `node proxy-server.js`
- 配置前端 `.env.local` 文件
- 使用 `auto_update_service.py` 定期更新本地数据

### 前端数据不刷新
- 检查浏览器控制台网络请求
- 清除 LocalStorage 缓存
- 检查 `dataService.ts` 中的 API 配置
- 查看 `getDataStatus()` 返回的状态

---

## 历史统计

- 5个信号全部触发: 47 天
- 4个及以上信号触发: 287 天
- 3个及以上信号触发: 604 天

最近一次5个信号全部触发: 2022年12月 (BTC价格约$16,000-$17,000)
