# BTC 监控系统 - 云端部署完全指南（最简单方案）

## 方案对比

| 方案 | 难度 | 费用 | 自动更新 | 推荐度 |
|------|------|------|----------|--------|
| GitHub Pages + Actions | ⭐ 最简单 | 免费 | ✅ 已配置 | ⭐⭐⭐ |
| Vercel | ⭐⭐ 简单 | 免费 | ✅ 支持 | ⭐⭐⭐ |
| Netlify Drop | ⭐ 最简单 | 免费 | ❌ 不支持 | ⭐⭐ |

---

## 推荐方案一：GitHub Pages + GitHub Actions（5分钟搞定）

### 为什么推荐这个方案？
- ✅ **零成本**：完全免费
- ✅ **已配置好**：GitHub Actions 已经设置每天自动更新数据
- ✅ **最稳定**：GitHub 服务器稳定可靠
- ✅ **自动部署**：数据更新后自动部署到网站

### 部署步骤

#### 第 1 步：创建 GitHub 仓库（1分钟）

1. 访问 https://github.com/new
2. 填写仓库信息：
   - **Repository name**: `btc-dca-monitor`（或其他名称）
   - **Description**: BTC 定投指标监控系统
   - **Visibility**: 选择 **Public**（公开）
3. 点击 **Create repository**

#### 第 2 步：上传代码（2分钟）

**方式 A - 直接上传（最简单）：**
1. 在仓库页面点击 **uploading an existing file**
2. 解压项目中的 `btc-monitor-deploy.zip`
3. 将所有文件拖到上传区域
4. 点击 **Commit changes**

**方式 B - 使用 Git（推荐）：**
```bash
# 在项目目录执行
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/btc-dca-monitor.git
git push -u origin main
```

#### 第 3 步：启用 GitHub Pages（1分钟）

1. 在仓库页面点击 **Settings** 标签
2. 左侧菜单点击 **Pages**
3. **Source** 选择 **Deploy from a branch**
4. **Branch** 选择 **main**，文件夹选择 **/(root)**
5. 点击 **Save**

#### 第 4 步：配置自动更新（已配置，无需操作）

仓库中的 `.github/workflows/update-data.yml` 已配置：
- ⏰ 每天北京时间 08:00 和 20:00 自动更新数据
- 🔄 数据更新后自动提交到仓库
- 🚀 GitHub Pages 会自动重新部署

#### 第 5 步：访问你的监控网站（1分钟）

等待 1-2 分钟后，访问：
```
https://你的用户名.github.io/btc-dca-monitor
```

例如：`https://zhangsan.github.io/btc-dca-monitor`

---

## 推荐方案二：Vercel（支持实时数据）

### 为什么选 Vercel？
- ✅ **全球 CDN**：访问速度快
- ✅ **Serverless Function**：可以实时获取 API 数据
- ✅ **自动部署**：Git 推送后自动部署
- ✅ **自定义域名**：支持绑定自己的域名

### 部署步骤

#### 第 1 步：准备代码
确保代码已推送到 GitHub（见方案一的第 1-2 步）

#### 第 2 步：登录 Vercel
1. 访问 https://vercel.com
2. 点击 **Sign Up**，选择 **Continue with GitHub**
3. 授权 Vercel 访问你的 GitHub 仓库

#### 第 3 步：导入项目
1. 点击 **Add New Project**
2. 选择你的 `btc-dca-monitor` 仓库
3. **Framework Preset**: 选择 **Other**
4. **Root Directory**: 输入 `app`
5. 点击 **Deploy**

#### 第 4 步：完成部署
等待 1-2 分钟，Vercel 会生成一个链接：
```
https://btc-dca-monitor-你的用户名.vercel.app
```

### Vercel 实时数据功能

Vercel 支持 Edge Function，可以实现：
- 浏览器直接获取实时数据（解决 CORS）
- API 路径：`https://你的域名.vercel.app/api/btc-data/latest`

**使用前需要修改配置：**
1. 打开 `app/src/services/dataService.ts`
2. 修改 API 地址：
```typescript
// 原代码
const API_BASE_URL = 'https://bitcoin-data.com';

// 修改为（Vercel 部署后）
const API_BASE_URL = '/api';
```

---

## 快速访问汇总

### 方案一：GitHub Pages
```
https://你的用户名.github.io/btc-dca-monitor
```

### 方案二：Vercel
```
https://btc-dca-monitor-你的用户名.vercel.app
```

### 方案三：Netlify Drop（仅展示，不支持自动更新）
```
https://随机名称.netlify.app
```

---

## 如何验证自动更新是否工作？

### 方法 1：查看 GitHub Actions 运行状态
1. 打开 GitHub 仓库
2. 点击 **Actions** 标签
3. 查看 **Update BTC Indicator Data** 工作流
4. 绿色 ✓ 表示成功

### 方法 2：查看数据文件更新时间
1. 打开仓库中的 `btc_indicators_latest.json`
2. 查看 `lastUpdated` 字段
3. 应该是最近的时间

### 方法 3：查看网站上的日期
打开监控网站，查看最新数据日期是否是今天。

---

## 常见问题

### Q: GitHub Pages 部署后显示 404？
A: 
1. 检查 Settings → Pages 中的分支设置是否正确
2. 确保上传了 `index.html` 文件
3. 等待 2-3 分钟后刷新

### Q: 数据没有自动更新？
A:
1. 检查 Actions 是否启用：Settings → Actions → General → Allow all actions
2. 查看 Actions 运行日志是否有错误
3. 手动触发一次：Actions → Update BTC Indicator Data → Run workflow

### Q: 如何修改自动更新频率？
A:
1. 编辑 `.github/workflows/update-data.yml`
2. 修改 cron 表达式：
```yaml
schedule:
  # 每天 UTC 00:00 (北京时间 08:00)
  - cron: '0 0 * * *'
  # 添加更多时间点
  - cron: '0 12 * * *'  # 北京时间 20:00
```

### Q: 可以使用自己的域名吗？
A:
- **GitHub Pages**: Settings → Pages → Custom domain
- **Vercel**: Project Settings → Domains

---

## 总结

| 需求 | 推荐方案 |
|------|----------|
| 最简单、零维护 | GitHub Pages + Actions |
| 需要实时数据 | Vercel |
| 最快部署体验 | Netlify Drop（但不支持自动更新）|

**强烈推荐 GitHub Pages + Actions 方案**，因为：
1. 已完全配置好，上传即可用
2. 完全免费且稳定
3. 每天自动更新两次数据
4. 无需额外操作
