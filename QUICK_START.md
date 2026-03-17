# BTC 定投指标监控系统 - 快速入门指南

## 问题：数据无法实时更新？

本系统目前提供多种解决方案来实现至少每天一次的数据更新：

---

## 方案一：自动数据更新服务（最简单 ⭐）

### Windows 用户

1. **双击运行** `start-data-service.bat`
2. 在菜单中选择：
   - `[2] 守护进程` - 每 10 分钟自动更新一次
   - `[3] 每日定时` - 每天 8 点和 20 点自动更新

### 命令行使用

```bash
# 单次更新
python auto_update_service.py

# 守护进程（每10分钟）
python auto_update_service.py --daemon

# 每日定时（8点和20点）
python auto_update_service.py --daily
```

### 安装 Windows 计划任务

```powershell
# 以管理员身份运行 PowerShell
.\start-data-service.ps1 -InstallTask
```

---

## 方案二：本地代理服务器（开发环境）

解决前端浏览器 CORS 跨域问题。

```bash
# 启动代理服务器
node proxy-server.js

# 显示：
# 代理地址: http://localhost:3001/api
# 静态文件: app/dist
```

### 前端配置

创建 `app/.env.local` 文件：
```
VITE_API_PROXY_URL=http://localhost:3001/api
```

---

## 方案三：GitHub Actions（云端部署）

1. 将代码推送到 GitHub
2. 已配置的 GitHub Actions 会自动每天更新数据两次
3. 无需额外操作

---

## 数据文件位置

更新后的数据保存在：
- `app/public/btc_indicators_history.json` - 前端使用
- `btc_indicators_history.json` - 根目录备份
- `btc_indicators_latest.json` - 最新数据摘要

---

## 故障排除

### API 连接失败
```bash
# 检查 API 连接
python auto_update_service.py --check
```

### 缺少 requests 模块
```bash
pip install requests
```

### 前端数据不刷新
1. 检查 `app/.env.local` 配置
2. 清除浏览器 LocalStorage
3. 检查网络请求是否成功

---

## 推荐配置

| 场景 | 推荐方案 |
|------|----------|
| 本地开发 | 代理服务器 + 自动更新服务 |
| 长期运行 | Windows 计划任务 / GitHub Actions |
| 生产部署 | GitHub Actions + CDN |

---

## 查看帮助

```bash
# Python 服务帮助
python auto_update_service.py --help

# PowerShell 脚本帮助
Get-Help .\start-data-service.ps1 -Full
```
