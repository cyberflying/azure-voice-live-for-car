# 快速开始 - Azure 部署 / Quick Start - Azure Deployment

## 🚀 最快部署方式 / Fastest Deployment Method

### 步骤 1: 创建 Azure Service Principal / Step 1: Create Azure Service Principal

使用 Azure CLI 创建 Service Principal 并获取凭证：

Use Azure CLI to create a Service Principal and get credentials:

```bash
# 登录 Azure / Login to Azure
az login

# 创建 Service Principal / Create Service Principal
az ad sp create-for-rbac \
  --name "hubcar-deployment" \
  --role contributor \
  --scopes /subscriptions/<your-subscription-id>/resourceGroups/<your-resource-group>/providers/Microsoft.Web/sites/hubcar \
  --sdk-auth
```

这将输出 JSON 格式的凭证，复制整个 JSON 输出。

This will output credentials in JSON format, copy the entire JSON output.

输出示例 / Output example:
```json
{
  "clientId": "<client-id>",
  "clientSecret": "<client-secret>",
  "subscriptionId": "<subscription-id>",
  "tenantId": "<tenant-id>",
  ...
}
```

### 步骤 2: 配置 GitHub Secret / Step 2: Configure GitHub Secret

1. 打开 GitHub 仓库设置 / Open repository settings:
   ```
   https://github.com/cyberflying/azure-voice-live-for-car/settings/secrets/actions
   ```

2. 点击 **"New repository secret"**

3. 填写信息 / Fill in:
   - **Name**: `AZURE_CREDENTIALS`
   - **Value**: 粘贴步骤 1 中的完整 JSON 输出 / Paste entire JSON output from Step 1

4. 点击 **"Add secret"**

### 步骤 3: 触发部署 / Step 3: Trigger Deployment

#### 选项 A: 自动部署 / Option A: Automatic Deployment
合并此 PR 到 `main` 分支，GitHub Actions 会自动开始部署。

Merge this PR to `main` branch, GitHub Actions will automatically start deployment.

#### 选项 B: 手动触发 / Option B: Manual Trigger
1. 进入 GitHub Actions 页面:
   ```
   https://github.com/cyberflying/azure-voice-live-for-car/actions
   ```

2. 选择 **"Deploy to Azure Web App"** 工作流

3. 点击 **"Run workflow"** → 选择分支 → **"Run workflow"**

### 步骤 4: 验证部署 / Step 4: Verify Deployment

部署完成后（约 2-3 分钟），访问:

After deployment completes (about 2-3 minutes), visit:

- **应用 / Application**: https://hubcar.azurewebsites.net
- **健康检查 / Health Check**: https://hubcar.azurewebsites.net/api/health

预期响应 / Expected response:
```json
{
  "status": "ok",
  "blobServiceInitialized": false,
  "timestamp": "2024-01-03T17:00:00.000Z"
}
```

## 📋 部署前检查清单 / Pre-deployment Checklist

- [ ] Azure Web App "hubcar" 已创建 / Azure Web App "hubcar" is created
- [ ] Web App 配置为 Node.js 20.x / Web App configured for Node.js 20.x
- [ ] 已创建 Service Principal / Service Principal created
- [ ] GitHub Secret `AZURE_CREDENTIALS` 已配置 / GitHub Secret configured
- [ ] 代码已推送到仓库 / Code pushed to repository

## 🔧 Azure Web App 配置 / Azure Web App Configuration

### 推荐设置 / Recommended Settings

在 Azure Portal → Web App (hubcar) → Configuration 中设置:

Set in Azure Portal → Web App (hubcar) → Configuration:

| 设置 / Setting | 值 / Value | 说明 / Description |
|---------------|-----------|-------------------|
| Stack | Node | Node.js 应用 |
| Node Version | 20 LTS | 推荐版本 |
| Startup Command | `node server/index.js` | 启动命令 |
| Always On | ✓ | 保持应用运行 |
| ARR Affinity | ✓ | 会话亲和性 |

### 环境变量（可选）/ Environment Variables (Optional)

| 名称 / Name | 值 / Value | 用途 / Purpose |
|------------|-----------|---------------|
| `NODE_ENV` | `production` | 生产环境标识 |
| `PORT` | `8080` | 端口（默认） |
| `WEBSITE_NODE_DEFAULT_VERSION` | `20-lts` | Node.js 版本 |

## 🎯 部署后任务 / Post-deployment Tasks

### 1. 测试应用功能 / Test Application Features
- [ ] 页面加载正常 / Page loads correctly
- [ ] API 端点响应 / API endpoints respond
- [ ] 静态资源加载 / Static assets load

### 2. 配置监控（推荐）/ Configure Monitoring (Recommended)
```bash
# 启用 Application Insights
az webapp config appsettings set \
  --name hubcar \
  --resource-group <your-resource-group> \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY="<your-key>"
```

### 3. 配置自定义域名（可选）/ Configure Custom Domain (Optional)
1. 在 Azure Portal 添加自定义域
2. 配置 DNS 记录
3. 绑定 SSL 证书

## 🐛 故障排查 / Troubleshooting

### 问题 1: 部署失败 / Issue 1: Deployment Failed

**检查 / Check:**
```bash
# 查看部署日志
az webapp log tail --name hubcar --resource-group <your-resource-group>
```

### 问题 2: 应用无法启动 / Issue 2: App Won't Start

**可能原因 / Possible Causes:**
- Node.js 版本不匹配
- 依赖安装失败
- 端口配置错误

**解决方案 / Solutions:**
```bash
# 重启应用
az webapp restart --name hubcar --resource-group <your-resource-group>

# 检查应用设置
az webapp config show --name hubcar --resource-group <your-resource-group>
```

### 问题 3: 404 错误 / Issue 3: 404 Errors

**检查 / Check:**
- web.config 是否正确部署
- dist 目录是否包含在部署包中
- URL 重写规则是否正确

## 📚 更多资源 / More Resources

- [详细部署指南 / Detailed Guide](./AZURE_DEPLOYMENT.md)
- [部署总结 / Deployment Summary](./DEPLOYMENT_SUMMARY.md)
- [项目 README](./README.md)
- [Azure 文档 / Azure Docs](https://docs.microsoft.com/azure/app-service/)

## 💡 提示 / Tips

1. **首次部署** 可能需要 5-10 分钟 / First deployment may take 5-10 minutes
2. **后续部署** 通常 2-3 分钟 / Subsequent deployments typically 2-3 minutes
3. **失败重试** GitHub Actions 会自动重试 / GitHub Actions auto-retries on failure
4. **查看日志** 在 Actions 标签页可以看到详细日志 / View detailed logs in Actions tab

## ✅ 成功指标 / Success Indicators

部署成功后，你应该能够:

After successful deployment, you should be able to:

- ✅ 访问 https://hubcar.azurewebsites.net
- ✅ 看到应用界面
- ✅ API 健康检查返回 200
- ✅ 在 Azure Portal 看到 "Running" 状态

---

**需要帮助? / Need Help?**
查看详细文档或在 Issues 中提问。

Check detailed documentation or ask in Issues.
