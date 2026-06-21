# BTC Cycle Bottom Monitor

基于链上指标的 BTC 大周期底部识别监测系统。项目包含数据抓取与校验管线、静态 JSON 数据产物、Vite + React 前端、Strategy 官方 mNAV 辅助观测，以及 GitHub Actions 自动更新流程。

## 当前监控指标

核心评分使用 8 个指标，分为三层：

- 估值层：`Price / 200W-MA`、`MVRV Z-Score`、`NUPL`、`Puell Multiple`
- 触发层：`STH-MVRV`、`STH-SOPR`
- 确认层：`LTH-MVRV`、`LTH-SOPR`

评分规则：

- 每个核心指标按 `0 / 1 / 2` 计分。
- 估值层为四个指标独立加总，满分 8。
- 触发层取 `STH-MVRV` 与 `STH-SOPR` 两者较高分，满分 2。
- 确认层为 `LTH-MVRV + LTH-SOPR`，满分 4。
- 总分上限为 14。
- `STH-SOPR` 与 `LTH-SOPR` 使用 3 日均值降低单日噪声。
- 部分阈值使用只基于历史数据的滚动分位数，避免未来函数。
- 系统使用 3 日确认信号降低单日波动影响。

辅助观测：

- `MSTR mNAV` 来自 Strategy 官方 API，按 Strategy 官方定义使用 `Enterprise Value / BTC Reserve`。该指标仅用于观察 BTC 代理资产溢价与风险偏好，不参与 BTC 底部评分。

兼容字段：

- 数据产物中仍保留 `Price / Realized Price`、`Reserve Risk`、旧版评分字段与相关诊断字段，用于历史兼容、回溯和数据质量诊断；它们不属于当前核心展示指标。

## 数据流

1. `fetch_btc_indicators_history_files.py` 从 BGeometrics 与补充来源拉取历史指标。
2. `pipeline/scoring.py` 计算指标分数、分层总分、数据新鲜度、确认信号和兼容字段。
3. 脚本写入：
   - `app/public/btc_indicators_history.json`
   - `app/public/btc_indicators_history_light.json`
   - `app/public/btc_indicators_latest.json`
   - `app/public/btc_indicators_manifest.json`
   - `app/public/btc_signal_events_v4.json`
4. `validate_btc_data_quality.py` 校验历史数据、最新快照、指标日期、信号数量和评分一致性。
5. `fetch_strategy_mnav.py` 独立更新 Strategy mNAV 数据。
6. GitHub Actions 定时更新数据并在质量门禁通过后提交。
7. Vercel 从仓库部署前端并提供静态 JSON 数据。

## 项目结构

- `pipeline/`：数据抓取、评分、归档与回滚逻辑
- `fetch_btc_indicators_history_files.py`：BTC 指标数据生成入口
- `validate_btc_data_quality.py`：BTC 数据质量校验
- `fetch_strategy_mnav.py`：Strategy mNAV 数据更新入口
- `validate_strategy_mnav.py`：Strategy mNAV 数据质量校验
- `app/`：Vite + React 前端
- `app/api/btc-data.js`：Vercel Edge runtime 最新数据代理
- `app/public/`：前端使用的静态 JSON 数据
- `tests/`：Python 单元测试
- `.github/workflows/`：CI 与定时数据更新工作流

## 本地运行

安装 Python 依赖：

```bash
pip install -r requirements.txt
```

生成前端 BTC 数据：

```bash
python fetch_btc_indicators_history_files.py --skip-tabular
```

刷新 Strategy mNAV：

```bash
python fetch_strategy_mnav.py
```

运行数据质量校验：

```bash
python validate_btc_data_quality.py \
  --current-history app/public/btc_indicators_history.json \
  --current-history-light app/public/btc_indicators_history_light.json \
  --current-latest app/public/btc_indicators_latest.json \
  --lookback-rows 30 \
  --max-indicator-lag-days 30
```

运行 Strategy mNAV 校验：

```bash
python validate_strategy_mnav.py \
  --current-latest app/public/strategy_mnav_latest.json \
  --current-history app/public/strategy_mnav_history.json
```

运行前端：

```bash
cd app
npm install
npm run dev
```

Vercel 部署：

- Vercel 项目的 Root Directory 应设置为 `app`。
- 部署配置位于 `app/vercel.json`，不要在仓库根目录维护第二份 Vercel 配置。
- 构建命令使用 `npm run build`，输出目录为 `dist`。

运行测试与构建：

```bash
python -m unittest discover -s tests -v

cd app
npm run lint
npm run test
npm run build
node --check api/btc-data.js
```

## 自动更新

`.github/workflows/update-btc-data.yml` 每 6 小时运行一次，也支持手动触发。工作流会：

1. 安装依赖
2. 生成 BTC 指标 JSON
3. 更新 Strategy mNAV JSON
4. 执行数据质量校验
5. 在数据发生变化时自动提交并推送
6. 失败时创建或更新 GitHub issue，恢复后自动关闭

## 数据契约

最新快照优先使用 `canonical` 字段表达当前模型。旧字段保留用于兼容和回溯，不应作为新功能的首选读取路径。

当前模型的核心数据应以 `canonical.score`、`canonical.signals`、`canonical.signalCount`、`canonical.activeIndicatorCount` 为准。前端需要展示旧字段时，应明确标注为兼容或诊断数据。
