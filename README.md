# BTC Monitor - 比特币定投指标监控系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19+-blue.svg)](https://reactjs.org/)

> **🚧 项目重构中** - 当前仅保留前端代码，后端数据更新模块正在重新设计开发中。

一个比特币投资指标监控工具前端应用，基于 React + TypeScript + Tailwind CSS 构建。

## 🏗️ 技术栈

- **React 19**: 现代化前端框架
- **TypeScript**: 类型安全的 JavaScript
- **Tailwind CSS**: 实用优先的 CSS 框架
- **Vite**: 快速构建工具
- **shadcn/ui**: UI 组件库
- **next-themes**: 主题管理

## 🚀 快速开始

### 环境要求
- Node.js 22
- npm

### 安装依赖

```bash
cd app
npm install
```

### 开发模式

```bash
cd app
npm run dev
```

访问 http://localhost:5173

### 构建

```bash
cd app
npm run build
```

## � 项目结构

```
btc-monitor/
├── app/                        # React 前端
│   ├── src/                    # 前端源码
│   │   ├── components/         # React 组件
│   │   ├── hooks/             # 自定义 Hooks
│   │   └── lib/               # 工具库
│   ├── public/                 # 静态资源
│   └── package.json            # 前端依赖
├── vercel.json                 # Vercel 部署配置
└── README.md                   # 项目文档
```

## 🌐 部署

### Vercel 部署

项目已配置 `vercel.json`，支持一键部署：

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

## � 数据来源

前端数据目前从静态 JSON 文件加载。未来的自动数据更新模块正在开发中。

## 🤝 社区

- **GitHub Issues**: 报告 Bug 或提出功能请求

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## ⚠️ 免责声明

本项目仅供学习和研究使用，不构成任何投资建议。加密货币投资存在高风险，价格波动剧烈，请在充分了解风险的基础上谨慎投资。

---

**🌟 如果这个项目对你有帮助，请给个 Star 支持一下！**
