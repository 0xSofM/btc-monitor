# BTC Monitor 数据更新问题分析与解决方案

## 问题现象

在 https://btc-monitor-five.vercel.app/ 监控系统中，除了 BTC Price / 200W-MA 指标外，其他四个链上指标（MVRV Z-Score、LTH MVRV、Puell Multiple、NUPL）的最新数据只更新到 2026年3月15日。

## 问题原因

### 根本原因：bitcoin-data.com API 速率限制

经过分析，发现问题的根本原因是 **bitcoin-data.com API 的速率限制**：

1. **API 限制**：bitcoin-data.com 免费套餐的速率限制为 **每小时 8 次请求**
2. **请求消耗**：每次数据更新需要调用 5 个 API 端点：
   - `btc-price/{days}` - BTC 价格
   - `mvrv-zscore/{days}` - MVRV Z-Score
   - `lth-mvrv/{days}` - 长期持有者 MVRV
   - `puell-multiple/{days}` - Puell 倍数
   - `nupl/{days}` - NUPL

3. **问题触发**：
   - GitHub Actions 工作流每天运行 2 次（UTC 00:00 和 12:00）
   - 每次运行时，如果 `fetch_days=30`，会尝试获取 30 天的数据
   - 如果在短时间内多次触发（如手动触发、push 触发等），很容易耗尽速率限制
   - 当 API 返回 429 错误时，链上指标数据无法更新，只能使用历史数据中的最后已知值

4. **为什么 BTC Price / 200W-MA 能更新**：
   - BTC 价格有备用数据源（Coinbase、CoinGecko）
   - 200W-MA 是基于历史价格计算的，不依赖外部 API

## 已实施的解决方案

### 1. 减少 API 请求天数

修改 [`update_data.py`](update_data.py:294)：

```python
# 之前：fetch_days = 30 if existing else 5000
# 之后：fetch_days = 1 if existing else 5000
```

这样每次运行只获取最新一天的数据，减少 API 调用负担。

### 2. 添加并发控制

修改 [`.github/workflows/update-data.yml`](.github/workflows/update-data.yml:19)：

```yaml
concurrency:
  group: btc-data-update
  cancel-in-progress: false
```

确保同一时间只有一个工作流在运行，避免并发请求耗尽速率限制。

### 3. 改进 API 响应处理

修改 [`fetch_json()`](update_data.py:44) 函数，正确处理单条记录响应：

```python
if isinstance(payload, dict):
    # Handle single record response (e.g., {"d":"2026-03-17","mvrvZscore":"0.701"})
    if "d" in payload:
        return [payload]
```

## 长期解决方案建议

### 方案 A：升级 bitcoin-data.com 套餐

- 访问 https://bitcoin-data.com/bguser/pricing
- 付费套餐提供更高的速率限制
- 最简单直接的解决方案

### 方案 B：添加更多备用数据源

目前只有 BTC 价格有备用源，可以考虑为链上指标添加备用源：

1. **Glassnode API**（需要 API Key）
   - 提供 MVRV、NUPL 等指标
   - 免费套餐有限制，但可作为备用

2. **Blockchain.com API**
   - 免费提供部分链上数据
   - 可用于验证和补充

### 方案 C：本地缓存策略

1. 在 GitHub Actions 中缓存 API 响应
2. 只在数据过期时才请求新数据
3. 减少不必要的 API 调用

### 方案 D：调整更新频率

1. 减少自动更新频率（如每天只更新一次）
2. 移除 push 触发，只保留定时触发
3. 避免手动触发耗尽速率限制

## 验证修复

等待 API 速率限制重置后（约 30 分钟），可以手动运行：

```bash
python update_data.py
```

检查输出是否显示成功获取了链上指标数据：

```
 btc-price: 1 records
 mvrv-zscore: 1 records
 lth-mvrv: 1 records
 puell-multiple: 1 records
 nupl: 1 records
```

## 当前状态

- API 速率限制：已耗尽（需等待重置）
- 重置时间：约 UTC 07:29:30
- 代码修改：已完成
- 待验证：API 重置后测试
