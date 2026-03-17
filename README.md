# BTC 定投指标监控系统

一个用于监控比特币定投指标的 Web 应用，基于多个经典链上指标（MVRV Z-Score、LTH-MVRV、Puell Multiple、NUPL、200周均线）生成买入信号。

![BTC Monitor](app/public/screenshot.png)

## 功能特性

- 📊 **多指标监控**：同时监控 5 个经典 BTC 链上指标
- 🔔 **买入信号**：当多个指标同时触发时给出买入建议
- 📱 **响应式设计**：支持桌面和移动设备访问
- 🔄 **自动更新**：支持云端自动每日更新数据
- 📈 **历史回溯**：查看历史买入机会和信号触发情况

## 快速开始

### 方案一：云端部署（推荐）

使用 GitHub Pages + GitHub Actions，完全免费且自动更新：

```bash
# 1. Fork 本仓库到你的 GitHub 账号
# 2. 启用 GitHub Pages (Settings → Pages → Deploy from branch)
# 3. 访问 https://你的用户名.github.io/btc-monitor
```

详细部署指南：
- [云端部署完全指南](CLOUD_DEPLOY_GUIDE.md)
- [部署速查表](DEPLOY_SUMMARY.md)

### 方案二：本地运行

```bash
# 1. 克隆仓库
git clone https://github.com/你的用户名/btc-monitor.git
cd btc-monitor

# 2. 启动数据更新服务
python auto_update_service.py --daemon

# 3. 启动前端开发服务器
cd app
npm install
npm run dev

# 4. 浏览器访问 http://localhost:5173
```

### 方案三：本地代理模式（解决 CORS）

```bash
# 1. 启动代理服务器
node proxy-server.js

# 2. 配置前端环境变量
echo "VITE_API_PROXY_URL=http://localhost:3001/api" > app/.env.local

# 3. 启动前端
cd app && npm run dev
```

## 买入信号指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| Price / 200W-MA | < 1 | 价格低于200周均线 |
| MVRV Z-Score | < 0 | 市场价值低于历史平均 |
| LTH-MVRV | < 1 | 长期持有者亏损 |
| Puell Multiple | < 0.5 | 矿工收入低于平均 |
| NUPL | < 0 | 网络整体亏损 |

## 项目结构

```
.
├── .github/workflows/        # GitHub Actions 自动更新配置
├── app/                      # 前端 React 应用
│   ├── api/                  # Vercel Edge Function
│   ├── dist/                 # 构建输出
│   ├── public/               # 静态资源
│   └── src/                  # 源代码
├── auto_update_service.py    # 数据更新服务
├── proxy-server.js           # 本地代理服务器
├── start-data-service.ps1    # 启动脚本
├── btc-monitor-deploy.zip    # 部署包
├── DATA_UPDATE_SOLUTION.md   # 数据更新方案
├── CLOUD_DEPLOY_GUIDE.md     # 云端部署指南
└── README.md                 # 本文件
```

## 数据更新

### 自动更新（推荐）

**GitHub Actions**: 已配置每天北京时间 08:00 和 20:00 自动更新

**Windows 计划任务**:
```powershell
# 安装计划任务（以管理员身份运行）
.\start-data-service.ps1 -InstallTask
```

**守护进程模式**:
```bash
python auto_update_service.py --daemon
```

**每日定时模式**:
```bash
python auto_update_service.py --daily
```

### 手动更新

```bash
python auto_update_service.py
```

## 部署方案对比

| 方案 | 难度 | 费用 | 自动更新 | 推荐指数 |
|------|------|------|----------|----------|
| GitHub Pages + Actions | ⭐ | 免费 | ✅ | ⭐⭐⭐ |
| Vercel | ⭐⭐ | 免费 | ✅ | ⭐⭐⭐ |
| Netlify Drop | ⭐ | 免费 | ❌ | ⭐⭐ |
| 本地服务器 | ⭐⭐⭐ | 电费 | 需配置 | ⭐⭐ |

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS + Vite
- **数据获取**: Python + Requests
- **代理服务**: Node.js
- **部署**: GitHub Pages / Vercel / Netlify

## API 数据源

数据来自 [BGeometrics API](https://bitcoin-data.com)（免费版，每小时限制 8 次请求）

## 历史统计

- 5个信号全部触发: 47 天
- 4个及以上信号触发: 288 天
- 3个及以上信号触发: 604 天

最近一次5个信号全部触发: 2022年12月 (BTC价格约$16,000-$17,000)

## 相关文档

- [快速入门](QUICK_START.md)
- [数据更新方案](DATA_UPDATE_SOLUTION.md)
- [云端部署指南](CLOUD_DEPLOY_GUIDE.md)
- [部署速查表](DEPLOY_SUMMARY.md)

## 免责声明

本项目仅供学习和研究使用，不构成任何投资建议。加密货币投资存在高风险，请谨慎决策。

## License

MIT License
