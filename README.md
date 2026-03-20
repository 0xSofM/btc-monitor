# BTC Monitor - 比特币定投指标监控系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/React-19+-blue.svg)](https://reactjs.org/)

一个比特币投资指标监控工具，基于多个链上指标生成定投信号，为投资者提供市场分析参考。

## 🎯 项目背景

比特币价格波动剧烈，把握合适的定投时机是投资者面临的重要问题。BTC Monitor 通过监控多个核心指标，帮助用户了解市场状态，为投资决策提供数据支持。

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

### 🚀 信号系统
- **多级信号强度**: 根据触发指标数量分为不同等级
- **历史数据**: 查看历史指标变化
- **数据更新**: 支持手动和自动数据更新

### 🌐 部署支持
- **本地部署**: 支持本地开发和运行
- **云端部署**: 支持 Vercel 等平台部署

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
- **React 19**: 现代化前端框架
- **TypeScript**: 类型安全的 JavaScript
- **Tailwind CSS**: 实用优先的 CSS 框架
- **Vite**: 快速构建工具
- **shadcn/ui**: UI 组件库
- **next-themes**: 主题管理

### 数据源
- **主要数据源**: [BGeometrics API](https://bitcoin-data.com)
- **备用数据源**: Coinbase、CoinGecko
- **数据格式**: JSON，支持历史数据和实时数据

## 🚀 快速开始

### 方案一：本地部署（推荐）

#### 环境要求
- Python 3.11
- Node.js 22
- npm

#### 快速启动

```bash
# 克隆仓库
git clone https://github.com/0xSofM/btc-monitor.git
cd btc-monitor

# 使用开发启动器（自动安装依赖并启动服务）
python scripts/dev.py
```

#### 手动安装步骤

1. **安装 Python 依赖**
   ```bash
   pip install -r requirements.txt
   ```

2. **安装前端依赖**
   ```bash
   cd app
   npm install
   cd ..
   ```

3. **启动数据服务**
   ```bash
   # 单次更新
   python src/cli/main.py update
   ```

4. **启动前端服务**
   ```bash
   cd app
   npm run dev
   ```

5. **访问应用**
   ```
   http://localhost:5173
   ```

### 方案二：云端部署

#### Vercel 部署

项目已配置 `vercel.json`，支持一键部署：

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel --prod
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

| 信号强度 | 触发指标数 | 说明 |
|----------|------------|------|
| MAXIMUM | 5/5 | 所有指标触发 |
| STRONG | 4/5 | 大部分指标触发 |
| MODERATE | 3/5 | 中等数量指标触发 |
| WEAK | 2/5 | 少量指标触发 |
| MINIMAL | 1/5 | 单个指标触发 |
| NONE | 0/5 | 无指标触发 |

## 📊 数据说明

本项目提供比特币链上指标的监控功能，数据来源于公开的区块链分析 API。指标仅供参考，不构成投资建议。

## 🔧 开发指南

### 代码质量

项目配置了代码质量检查工具：

- **Python**: ruff（代码检查）、black（格式化）、mypy（类型检查）
- **TypeScript**: TypeScript 编译检查
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

### 本地部署

1. 克隆仓库并安装依赖
2. 运行开发服务器：`python scripts/dev.py`
3. 访问 http://localhost:5173

### Vercel 部署

项目已配置 `vercel.json`：

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
   node --version  # 需要 22
   python --version  # 需要 3.11
   ```

2. **API 连接问题**
   ```
   检查网络连接，或等待 API 限制重置
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
python src/cli/main.py update --verbose
```

## 📚 项目说明

### 数据接口

项目提供前端数据获取功能，支持从多个数据源获取比特币指标数据。

### 示例数据格式

```json
{
  "d": "2026-03-20",
  "btcPrice": 65000.00,
  "mvrvZscore": 1.2,
  "lthMvrv": 2.1,
  "puellMultiple": 0.8,
  "nupl": 0.3,
  "signal_count": 2
}
```

## 🤝 社区

- **GitHub Issues**: 报告 Bug 或提出功能请求
- **Discussions**: 技术讨论和经验分享

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## ⚠️ 免责声明

本项目仅供学习和研究使用，不构成任何投资建议。加密货币投资存在高风险，价格波动剧烈，请在充分了解风险的基础上谨慎投资。过往业绩不代表未来表现，投资决策请基于个人判断和风险承受能力。

---

**🌟 如果这个项目对你有帮助，请给个 Star 支持一下！**
