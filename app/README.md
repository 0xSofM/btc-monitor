# BTC Monitor Frontend

Vite + React 前端，用于展示 BTC 大周期底部识别监测系统。

## 主要页面

- 信号总览：展示 BTC 价格、综合评分、触发数量、数据新鲜度和信号确认状态。
- 核心指标：展示 8 个核心指标卡片和历史图表。
- 历史回顾：展示历史信号记录。
- 指标说明：说明当前指标体系、分层评分和 Strategy mNAV 辅助观测。

## 数据来源

前端默认读取 `public` 目录下的静态 JSON：

- `btc_indicators_latest.json`
- `btc_indicators_history_light.json`
- `btc_indicators_history_full_light.json`
- `btc_indicators_history.json`
- `btc_indicators_manifest.json`
- `strategy_mnav_latest.json`
- `strategy_mnav_history.json`

最新快照优先消费 `canonical` 当前模型字段；历史兼容字段仅用于回溯、兜底和诊断。

## 常用命令

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
node --check api/btc-data.js
```

## 开发注意事项

- 页面文案应保持专业、客观、简明，聚焦当前监测功能。
- 新功能优先读取 canonical 字段，不要继续扩大旧评分字段的使用范围。
- 核心展示指标固定为当前 8 指标；`Reserve Risk`、`Price / Realized Price` 等字段只作为兼容或诊断信息。
- 图表与指标卡的阈值、信号状态、分层评分应保持一致。
