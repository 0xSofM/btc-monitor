# BTC 监控系统 - 云端部署速查表

## 🚀 最简单的云端自动更新方案

### 推荐：GitHub Pages + GitHub Actions

**优势：**
- ✅ 完全免费
- ✅ 已配置好自动更新（每天8点和20点）
- ✅ 无需维护服务器
- ✅ 全球访问速度快

---

## 📋 三步完成部署

### 第 1 步：创建 GitHub 仓库
👉 https://github.com/new
- 名称：`btc-monitor`
- 权限：**Public**

### 第 2 步：上传文件
将项目所有文件上传到仓库（包括 `.github/workflows/`）

```bash
# 或使用命令行
git init
git add .
git commit -m "init"
git remote add origin https://github.com/你的用户名/btc-monitor.git
git push -u origin main
```

### 第 3 步：启用 GitHub Pages
1. 仓库页面 → **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: main / (root)
4. 点击 **Save**

### 🎉 完成！

**访问地址：**
```
https://你的用户名.github.io/btc-monitor
```

**数据自动更新：**
- 每天北京时间 08:00 和 20:00
- 自动从 BGeometrics API 获取最新数据

---

## 🔍 验证自动更新

### 方法 1：查看 Actions 运行状态
仓库页面 → **Actions** → 查看是否为绿色 ✓

### 方法 2：查看最新数据文件
仓库中的 `btc_indicators_latest.json` 应该显示今天日期

### 方法 3：访问网站查看
网站显示的最新日期应该是今天或昨天

---

## 🌐 快速访问汇总

部署完成后，你可以通过以下方式访问：

| 方式 | 地址 |
|------|------|
| GitHub Pages | `https://用户名.github.io/btc-monitor` |
| 手机访问 | 同一地址，自适应移动端 |

---

## ⚡ 更快但不自动更新的方案

### Netlify Drop（2分钟部署）

如果只是临时查看效果：

1. 访问 https://app.netlify.com/drop
2. 拖拽 `btc-monitor-deploy.zip` 解压后的文件夹
3. 立即获得公网链接

**缺点：** 数据不会自动更新

---

## 🆘 常见问题

### 网站显示 404？
- 检查 Settings → Pages 设置
- 确保上传了 `index.html`
- 等待 2-3 分钟再刷新

### 数据没有更新？
- 检查 Actions 是否启用
- 手动触发：Actions → Update BTC Indicator Data → Run workflow

### 如何修改更新频率？
编辑 `.github/workflows/update-data.yml` 中的 cron 表达式

---

## 📁 项目文件说明

```
├── .github/workflows/update-data.yml  # 自动更新配置（关键）
├── btc-monitor-deploy.zip             # 部署包
├── auto_update_service.py             # 本地自动更新服务
├── proxy-server.js                    # 本地代理服务器
├── CLOUD_DEPLOY_GUIDE.md              # 完整部署指南
├── ONE_CLICK_DEPLOY.md                # 一键部署指南
└── QUICK_START.md                     # 快速入门
```

---

## 💡 本地开发 vs 云端部署

| 场景 | 推荐方案 |
|------|---------|
| 本地开发 | `node proxy-server.js` + `npm run dev` |
| 云端展示 | GitHub Pages |
| 临时分享 | Netlify Drop |

---

## ✅ 检查清单

部署前确认：
- [ ] 已创建 GitHub 账号
- [ ] 已创建公开仓库
- [ ] 已上传所有文件（包括 .github 文件夹）
- [ ] 已启用 GitHub Pages
- [ ] 能访问网站链接
- [ ] 数据日期是最新的

---

## 📞 需要帮助？

1. 查看 `CLOUD_DEPLOY_GUIDE.md` 详细指南
2. 查看 `DATA_UPDATE_SOLUTION.md` 数据更新方案
3. 检查 GitHub Actions 日志中的错误信息

**现在就开始部署吧！** 🚀
