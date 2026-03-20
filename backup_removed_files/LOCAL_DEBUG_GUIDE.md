# BTC 监控系统 - 本地调试完全指南

## 环境要求

- **Node.js** 18+ (推荐 20 LTS)
- **Python** 3.8+
- **Git** (可选，用于版本控制)

---

## 方式一：完整本地开发（推荐）

### 步骤 1：安装依赖

#### 安装 Node.js 依赖
```bash
cd app
npm install
```

#### 安装 Python 依赖
```bash
pip install requests
```

---

### 步骤 2：启动数据服务

**方式 A - 单次更新（适合调试）**
```bash
python auto_update_service.py
```

**方式 B - 守护进程（数据自动更新）**
```bash
python auto_update_service.py --daemon
```

**方式 C - 使用交互式菜单**
```bash
# PowerShell
.\start-data-service.ps1

# 或 Windows CMD
start-data-service.bat
```

> 看到 `[OK] 数据更新完成` 表示成功

---

### 步骤 3：启动前端开发服务器

```bash
cd app
npm run dev
```

启动成功后显示：
```
VITE v7.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h + enter to show help
```

**浏览器访问**：http://localhost:5173

---

### 步骤 4：检查数据是否正确加载

打开浏览器开发者工具 (F12) → Console：
- 应该看到 `[DataService] Using cached data` 或成功获取数据的日志
- 如果没有数据，检查 `app/public/btc_indicators_history.json` 是否存在

---

## 方式二：使用代理服务器（解决 CORS）

如果前端无法直接获取 API 数据（CORS 错误），使用代理模式：

### 步骤 1：启动代理服务器

```bash
# 在项目根目录
node proxy-server.js
```

输出：
```
=================================================
  BTC 指标数据代理服务器已启动
=================================================
  代理地址: http://localhost:3001/api
  静态文件: app/dist
  API 目标: https://bitcoin-data.com
=================================================
```

### 步骤 2：配置前端使用代理

创建 `app/.env.local` 文件：
```env
VITE_API_PROXY_URL=http://localhost:3001/api
```

### 步骤 3：重启前端

```bash
cd app
npm run dev
```

现在前端会通过代理获取数据，解决 CORS 问题。

---

## 方式三：快速预览（不启动开发服务器）

如果只是查看效果，不需要调试代码：

### 步骤 1：确保有构建好的文件

```bash
cd app
npm run build
```

### 步骤 2：启动代理服务器（提供静态文件服务）

```bash
node proxy-server.js
```

### 步骤 3：浏览器访问

http://localhost:3001

> 注意：这种方式使用的是构建后的文件，修改代码后需要重新 `npm run build`

---

## 常见问题排查

### 问题 1：前端提示 "无法加载数据"

**检查清单：**
```bash
# 1. 检查数据文件是否存在
cat app/public/btc_indicators_history.json | head -20

# 2. 检查文件大小（应该 > 1MB）
ls -lh app/public/btc_indicators_history.json

# 3. 手动更新数据
python auto_update_service.py
```

### 问题 2：CORS 跨域错误

**错误信息：**
```
Access to fetch at 'https://bitcoin-data.com/...' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**解决方案：**
1. 启动代理服务器：`node proxy-server.js`
2. 配置 `.env.local`：`VITE_API_PROXY_URL=http://localhost:3001/api`
3. 重启前端

### 问题 3：Python 报错 "No module named 'requests'"

```bash
pip install requests
```

### 问题 4：端口被占用

**检查端口占用：**
```bash
# Windows
netstat -ano | findstr :5173
netstat -ano | findstr :3001

# 或使用 PowerShell
Get-NetTCPConnection -LocalPort 5173
```

**更换端口：**
```bash
cd app
npm run dev -- --port 3000
```

### 问题 5：数据更新但前端不刷新

**原因：** 前端有缓存机制

**解决：**
1. 按 `Ctrl+F5` 强制刷新
2. 或清除浏览器缓存
3. 检查控制台是否有 `[DataService] Cache invalidated` 日志

---

## 调试技巧

### 1. 查看数据服务日志

```bash
# 查看实时日志
tail -f btc_update.log

# Windows
type btc_update.log
```

### 2. 手动检查 API 连接

```bash
python auto_update_service.py --check
```

### 3. 浏览器开发者工具

**Console 面板：**
- 查看 `[DataService]` 开头的日志
- 检查数据获取状态

**Network 面板：**
- 查看 `btc_indicators_history.json` 是否成功加载
- 检查 API 请求状态

**Application 面板 → Local Storage：**
- 查看 `btc_indicators_history` 和 `btc_indicators_latest`
- 可以手动清除缓存

### 4. 使用代理服务器的调试模式

```bash
# 代理服务器会输出详细的请求日志
node proxy-server.js
```

看到 `Proxying: /api/v1/xxx -> https://bitcoin-data.com/v1/xxx` 表示代理正常工作

---

## 推荐的工作流程

```
┌─────────────────────────────────────────────────────────┐
│  终端 1: 数据服务                                          │
│  $ python auto_update_service.py --daemon               │
│  (保持运行，每10分钟自动更新数据)                          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  终端 2: 前端开发                                          │
│  $ cd app                                               │
│  $ npm run dev                                          │
│  (保持运行，支持热更新)                                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  浏览器: http://localhost:5173                          │
│  F12 打开开发者工具进行调试                               │
└─────────────────────────────────────────────────────────┘
```

---

## 高级配置

### 修改自动刷新间隔

编辑 `app/src/services/dataService.ts`：
```typescript
const REFRESH_INTERVAL = 5 * 60 * 1000; // 改为 1 * 60 * 1000 = 1分钟
```

### 禁用缓存（调试模式）

编辑 `app/src/services/dataService.ts`：
```typescript
export async function fetchAllLatestIndicators(useCache = false) { // 改为 false
```

### 使用本地 JSON 数据（离线调试）

确保 `app/public/btc_indicators_history.json` 存在，系统会自动回退到本地数据

---

## 验证安装成功

运行以下命令验证环境：

```bash
# 检查 Node.js
node --version  # 应该显示 v18+ 或 v20+

# 检查 Python
python --version  # 应该显示 3.8+

# 检查 Python 依赖
python -c "import requests; print('requests OK')"

# 检查数据服务
python auto_update_service.py --check
```

全部通过表示环境配置正确！

---

## 下一步

- 📖 阅读 [QUICK_START.md](QUICK_START.md) 了解更多功能
- ☁️ 参考 [CLOUD_DEPLOY_GUIDE.md](CLOUD_DEPLOY_GUIDE.md) 部署到云端
- 🔧 查看 [DATA_UPDATE_SOLUTION.md](DATA_UPDATE_SOLUTION.md) 了解数据更新方案
