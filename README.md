# BTC Monitor - 比特币定投指标监控系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)

一个专业的比特币投资指标监控工具，基于多个经典链上指标生成定投信号，帮助投资者把握最佳买入时机。

## 🎯 项目背景

比特币作为数字黄金，其价格波动剧烈，如何在合适的时机进行定投是投资者面临的重要问题。BTC Monitor 通过监控 5 个经过市场验证的核心指标，当多个指标同时发出买入信号时提示用户，有效提高定投收益。

历史数据显示，当 5 个指标全部触发时，往往是历史性的买入机会。例如 2022 年 12 月，所有指标同时触发时 BTC 价格约为 $16,000-$17,000，随后的市场反弹验证了这一策略的有效性。

## ✨ 核心功能

### 📊 多指标监控
- **Price / 200W-MA**: 价格与 200 周移动平均线比值
- **MVRV Z-Score**: 市场价值与实现价值 Z 分数
- **LTH-MVRV**: 长期持有者 MVRV 比率
- **Puell Multiple**: 矿工收入倍数指标
- **NUPL**: 未实现利润净额指标

### 🌙 暗色模式支持
- **系统主题检测**: 自动跟随系统主题设置
- **手动切换**: 一键切换明暗主题
- **优化体验**: 暗色模式下的视觉优化

### 🚀 智能信号系统
- **多级信号强度**: 根据触发指标数量分为 MINIMAL、WEAK、MODERATE、STRONG、MAXIMUM 五个等级
- **历史回测**: 查看历史买入机会和信号触发情况
- **实时更新**: 支持自动和手动数据更新

### 🌐 多平台部署
- **云端部署**: GitHub Pages 免费托管，自动更新
- **本地运行**: 支持传统部署方式
- **API 服务**: 提供 RESTful API 接口

## 🏗️ 技术架构

### 项目结构
```
btc-monitor/
├── README.md                   # 项目文档
├── requirements.txt             # Python 依赖
├── pyproject.toml              # Python 项目配置
├── vercel.json                # Vercel 部署配置
├── src/                        # Python 源代码
│   ├── core/                   # 核心功能模块
│   │   ├── data_updater.py     # 数据更新引擎
│   │   ├── indicator_calculator.py  # 指标计算器
│   │   └── api_client.py       # API 客户端
│   ├── services/               # 服务层
│   │   ├── auto_update_service.py   # 自动更新服务
│   │   └── data_validator.py   # 数据验证服务
│   └── cli/                    # 命令行接口
│       └── main.py            # 统一 CLI 入口
├── app/                        # React 前端
│   ├── src/                    # 前端源码
│   │   ├── components/         # React 组件
│   │   ├── hooks/             # 自定义 Hooks
│   │   ├── lib/               # 工具库
│   │   └── services/         # 前端服务
│   ├── public/                 # 静态资源
│   └── package.json            # 前端依赖
├── scripts/                    # 开发脚本
│   ├── dev.py                # 开发环境启动器
│   └── validate_project.py   # 项目验证脚本
├── docs/                       # 文档目录
└── tests/                      # 测试文件
```

### 前端架构
- **React 19+**: 现代化前端框架
- **TypeScript**: 类型安全的 JavaScript
- **Tailwind CSS**: 实用优先的 CSS 框架
- **Vite**: 快速构建工具
- **shadcn/ui**: 高质量 UI 组件库
- **next-themes**: 主题管理

### 数据源
- **主要数据源**: [BGeometrics API](https://bitcoin-data.com)
- **备用数据源**: Coinbase、CoinGecko
- **数据格式**: JSON，支持历史数据和实时数据

## 🚀 快速开始

### 方案一：云端部署（推荐）

1. **Fork 仓库**
   ```bash
   # 访问 GitHub 页面，点击 Fork 按钮
   # 将仓库 fork 到你的账号下
   ```

2. **启用 GitHub Pages**
   ```
   Settings → Pages → Deploy from branch → 选择 main 分支和 /docs 文件夹
   ```

3. **访问应用**
   ```
   https://你的用户名.github.io/btc-monitor
   ```

4. **配置自动更新**
   - GitHub Actions 已配置每日自动更新
   - 无需额外配置，完全自动化运行

### 方案二：本地部署

#### 环境要求
- Python 3.8+
- Node.js 16+
- npm 或 yarn

#### 快速启动（推荐）

```bash
# 使用开发启动器（自动安装依赖并启动服务）
python scripts/dev.py
```

#### 手动安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/你的用户名/btc-monitor.git
   cd btc-monitor
   ```

2. **安装 Python 依赖**
   ```bash
   pip install -r requirements.txt
   ```

3. **安装前端依赖**
   ```bash
   cd app
   npm install
   cd ..
   ```

4. **启动数据服务**
   ```bash
   # 单次更新
   python src/cli/main.py update
   
   # 或启动守护进程
   python src/cli/main.py update --daemon
   ```

5. **启动前端服务**
   ```bash
   cd app
   npm run dev
   ```

6. **访问应用**
   ```
   http://localhost:5173
   ```

## 📖 使用指南

### 命令行工具

BTC Monitor 提供统一的命令行接口：

```bash
# 数据更新
python src/cli/main.py update                    # 单次更新
python src/cli/main.py update --daemon           # 守护进程模式
python src/cli/main.py update --daily 08:00      # 每日定时更新

# 数据验证
python src/cli/main.py validate                   # 基础验证
python src/cli/main.py validate --full           # 完整验证（含 API 对比）

# API 检查
python src/cli/main.py check-api                  # 检查 API 连接状态
```

### 开发工具

```bash
# 项目验证
python scripts/validate_project.py               # 验证项目结构和依赖

# 开发环境
python scripts/dev.py                           # 启动完整开发环境
```

### 买入信号解读

| 信号强度 | 触发指标数 | 投资建议 |
|----------|------------|----------|
| MAXIMUM | 5/5 | 🟢 强烈建议买入，历史性机会 |
| STRONG | 4/5 | 🟡 建议买入，良好时机 |
| MODERATE | 3/5 | 🟡 考虑买入，可分批建仓 |
| WEAK | 2/5 | 🟠 观望为主，小量试水 |
| MINIMAL | 1/5 | 🔴 保持观望，不宜买入 |
| NONE | 0/5 | 🔴 绝对避免买入 |

## 📊 历史统计

基于历史数据回测（2013-2023）：

- **5个信号全部触发**: 47 天
- **4个及以上信号触发**: 288 天  
- **3个及以上信号触发**: 604 天

**最近一次 MAXIMUM 信号**: 2022年12月（BTC价格约$16,000-$17,000）

## 🔧 开发指南

### 代码质量

项目配备了完整的代码质量检查工具：

- **Python**: ruff（代码检查）、black（格式化）、mypy（类型检查）
- **TypeScript**: ESLint + TypeScript 编译检查
- **CI/CD**: GitHub Actions 自动化检查

### 项目验证

```bash
# 验证项目完整性
python scripts/validate_project.py

# 运行测试
pytest tests/
```

### 贡献指南

1. **Fork 项目** 并创建特性分支
2. **遵循代码规范**（Python 使用 ruff/black，JavaScript 使用 ESLint）
3. **添加测试** 确保功能正常
4. **提交 PR** 并描述变更内容

## 🚀 部署指南

### GitHub Pages 部署

1. 启用 GitHub Pages
2. 配置 GitHub Actions 自动更新
3. 设置自定义域名（可选）

### Vercel 部署

项目已配置 `vercel.json`，支持一键部署：

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

## 🐛 故障排除

### 常见问题

1. **开发环境启动失败**
   ```bash
   # 检查 Node.js 和 Python 版本
   node --version  # 需要 16+
   python --version  # 需要 3.8+
   ```

2. **API 限制错误**
   ```
   解决方案：等待 API 限制重置，或使用备用数据源
   ```

3. **前端构建失败**
   ```bash
   # 清理缓存重新安装
   cd app
   rm -rf node_modules package-lock.json
   npm install
   ```

### 调试模式

启用详细日志：

```bash
export BTC_LOG_LEVEL=DEBUG
python src/cli/main.py update
```

## 📚 API 文档

### 数据更新 API

```bash
# 获取最新数据
GET /api/latest

# 获取历史数据
GET /api/history?days=30

# 获取信号统计
GET /api/signals/stats
```

### 响应格式

```json
{
  "d": "2026-03-20",
  "btcPrice": 65000.00,
  "mvrvZscore": 1.2,
  "lthMvrv": 2.1,
  "puellMultiple": 0.8,
  "nupl": 0.3,
  "signal_count": 2,
  "signal_strength": "WEAK"
}
```

## 🤝 社区

- **GitHub Issues**: 报告 Bug 或提出功能请求
- **Discussions**: 技术讨论和经验分享
- **Wiki**: 详细教程和最佳实践

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## ⚠️ 免责声明

本项目仅供学习和研究使用，不构成任何投资建议。加密货币投资存在高风险，价格波动剧烈，请在充分了解风险的基础上谨慎投资。过往业绩不代表未来表现，投资决策请基于个人判断和风险承受能力。

---

**🌟 如果这个项目对你有帮助，请给个 Star 支持一下！**
