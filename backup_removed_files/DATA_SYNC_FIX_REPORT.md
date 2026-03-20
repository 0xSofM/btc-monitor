# 数据同步修复报告

## 问题描述

前端展示的 BTC 指标数据与本地持久化数据存在不一致问题，主要体现在以下几个方面：

1. **数据格式不一致**：历史数据使用 snake_case 格式（如 `price_ma200w_ratio`），而前端期望 camelCase 格式（如 `priceMa200wRatio`）
2. **时间戳时区问题**：日期解析时未正确处理时区，可能导致日期偏移
3. **数据同步机制缺失**：本地存储的数据与前端展示数据更新时机不一致
4. **apiDataDate 字段处理不完整**：后端 Python 脚本和前端 TypeScript 代码对 `apiDataDate` 字段的处理存在差异

## 根本原因分析

### 1. 数据格式不一致

**问题位置**：
- `update_data.py` 生成的历史数据使用 snake_case 格式
- `dataService.ts` 的 `normalizeIndicatorData` 函数虽然尝试处理两种格式，但对 `apiDataDate` 字段的处理不完整

**影响**：
- 前端无法正确解析历史数据中的 `api_data_date` 字段
- 导致指标日期追踪功能失效

### 2. 时间戳时区处理

**问题位置**：
- `HistoryReview.tsx` 中使用 `new Date(itemDateStr + 'T00:00:00')` 解析日期
- 未指定时区，导致在 UTC+8 时区下日期可能偏移

**影响**：
- 历史数据筛选时日期范围计算错误
- 用户可能看到错误的历史数据

### 3. 数据同步机制

**问题位置**：
- `dataService.ts` 中 `saveLocalData` 和 `getLocalLatestData` 函数
- 保存和读取时未进行数据格式验证和标准化

**影响**：
- 本地存储的数据格式可能与前端展示数据不一致
- 缓存数据可能过期但仍被使用

### 4. apiDataDate 字段处理

**问题位置**：
- `update_data.py` 的 `find_indicator_dates` 函数
- `dataService.ts` 的 `normalizeLatestData` 函数

**影响**：
- 指标数据日期追踪信息丢失
- 前端无法正确判断哪些指标数据是最新的

## 修复方案

### 1. 修复数据格式转换

**文件**: `app/src/services/dataService.ts`

```typescript
function normalizeIndicatorData(item: any): IndicatorData {
  // 处理 apiDataDate 字段（支持 snake_case 和 camelCase）
  const apiDataDate = item.apiDataDate || item.api_data_date;
  const indicatorDates = apiDataDate ? {
    mvrvZ: apiDataDate.mvrvZ || apiDataDate.mvrv_z,
    lthMvrv: apiDataDate.lthMvrv || apiDataDate.lth_mvrv,
    puell: apiDataDate.puell,
    nupl: apiDataDate.nupl
  } : undefined;

  return {
    d: item.d,
    // ... 其他字段
    apiDataDate: indicatorDates,
  } as IndicatorData;
}
```

### 2. 修复时间戳时区处理

**文件**: `app/src/components/HistoryReview.tsx`

```typescript
// 使用 UTC 时间避免时区偏移
const itemDate = new Date(itemDateStr + 'T00:00:00Z');
```

### 3. 增强数据校验与同步

**文件**: `app/src/services/dataService.ts`

```typescript
// 数据版本标识
const DATA_VERSION = 'v1.0.0';

// 保存数据时添加版本和时间戳
export function saveLocalData(data: { history?: IndicatorData[]; latest?: LatestData }) {
  try {
    if (data.history) {
      const historyWithVersion = {
        version: DATA_VERSION,
        timestamp: Date.now(),
        data: data.history
      };
      localStorage.setItem('btc_indicators_history', JSON.stringify(historyWithVersion));
    }
    // ... 类似处理 latest
  } catch (e) {
    console.error('Error saving local data:', e);
  }
}
```

### 4. 修复 Python 脚本

**文件**: `update_data.py`

```python
def find_indicator_dates(history):
    # 支持 camelCase 和 snake_case 两种格式
    api_dates = latest.get("apiDataDate") or latest.get("api_data_date", {})
    # ...
```

## 数据校验工具

创建了 `validate_and_sync_data.py` 工具，用于：
1. 验证历史数据与最新数据的一致性
2. 检查 indicatorDates 和 apiDataDate 字段的完整性
3. 自动修复数据不一致问题

**使用方法**：
```bash
# 仅校验
python validate_and_sync_data.py

# 校验并自动修复
python validate_and_sync_data.py --fix
```

## 验证结果

运行数据校验工具后的结果：
```
============================================================
数据校验与自动对齐工具
============================================================

[1] 加载数据...
  历史数据记录数：6285
  最新数据日期：2026-03-20

[2] 验证 indicatorDates 字段...
  [OK] indicatorDates 字段验证通过

[3] 验证数据一致性...
  [OK] 数据一致性验证通过

[4] 检查 apiDataDate 字段...
  [OK] apiDataDate 字段验证通过

[5] 同步历史数据与最新数据...
  [OK] 数据已同步，无需修复

============================================================
校验完成：所有检查通过
```

## 防止问题复发机制

### 1. 数据版本控制
在本地存储中添加数据版本标识，当数据结构变更时自动检测并处理。

### 2. 定期校验
建议在 GitHub Actions 工作流中定期运行数据校验工具：

```yaml
- name: Validate data consistency
  run: python validate_and_sync_data.py
```

### 3. 数据格式标准化
所有新写入的数据都经过 `normalizeIndicatorData` 和 `normalizeLatestData` 函数处理，确保格式一致。

### 4. 类型定义更新
更新了 `IndicatorData` 类型定义，添加 `apiDataDate` 字段支持：

```typescript
export interface IndicatorData {
  // ... 原有字段
  apiDataDate?: {
    mvrvZ?: string;
    lthMvrv?: string;
    puell?: string;
    nupl?: string;
  };
}
```

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `app/src/services/dataService.ts` | 修复 `normalizeIndicatorData` 和 `normalizeLatestData` 函数，增强数据校验 |
| `app/src/components/HistoryReview.tsx` | 修复日期时区处理 |
| `app/src/types/index.ts` | 添加 `apiDataDate` 字段到 `IndicatorData` 类型 |
| `update_data.py` | 修复 `find_indicator_dates` 和 `build_latest_payload` 函数 |
| `validate_and_sync_data.py` | 新增数据校验工具 |

## 总结

通过本次修复，解决了以下问题：
1. ✅ 数据格式不一致问题（snake_case vs camelCase）
2. ✅ 时间戳时区处理问题
3. ✅ 数据同步机制缺失问题
4. ✅ apiDataDate 字段处理不完整问题

并建立了以下机制防止问题复发：
1. ✅ 数据版本控制
2. ✅ 自动化校验工具
3. ✅ 数据格式标准化处理
4. ✅ 类型定义完善
