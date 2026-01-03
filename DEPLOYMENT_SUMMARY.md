# 部署总结 / Deployment Summary

## 概述 / Overview

此 PR 配置了将应用部署到 Azure Web App (hubcar) 所需的所有文件和设置。

This PR configures all necessary files and settings to deploy the application to Azure Web App (hubcar).

## 应用架构 / Application Architecture

```
Azure Web App (Node.js)
│
├── Express (server/index.js)
│   ├── /api/*              - API 端点
│   └── static(dist/)       - 静态文件服务
│
└── React (Vite)
    └── dist/               - 构建输出
```

此应用直接运行在 Node.js 环境中，不使用 IIS。

This application runs directly on Node.js environment, without IIS.

## 已完成的更改 / Changes Made

### 1. GitHub Actions 工作流 / GitHub Actions Workflow

- **.github/workflows/azure-deploy.yml**: 自动化部署到 Azure Web App
  - 在推送到 main 分支时触发
  - 使用 Azure Login action 进行身份验证（Service Principal）
  - 构建应用（npm ci + npm run build）
  - 直接部署整个项目到 Azure Web App

### 2. 应用配置更新 / Application Configuration Updates

- **vite.config.js**: 
  - 将 base 路径从 `/azure-voice-live-for-car/` 改为 `/` 以适配 Azure Web App
  
- **package.json**:
  - 移除 homepage 字段
  - 将 deploy 脚本重命名为 deploy:github

### 3. 文档 / Documentation

- **AZURE_DEPLOYMENT.md**: 详细的 Azure 部署指南（中文）
  - 包含应用架构说明
  - Service Principal 创建步骤
  - 多种部署方式说明
  - 故障排查指南
  
- **QUICKSTART.md**: 快速开始指南（中英文）
  - Service Principal 配置步骤
  - GitHub Secret 配置说明
  
- **README.md**: 添加了 Azure 部署部分

## 如何部署 / How to Deploy

### 方法 1: GitHub Actions（推荐）

1. **创建 Service Principal**：
   ```bash
   az ad sp create-for-rbac \
     --name "hubcar-deployment" \
     --role contributor \
     --scopes /subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Web/sites/hubcar \
     --sdk-auth
   ```

2. **配置 GitHub Secret**：
   - 在仓库设置中添加 secret: `AZURE_CREDENTIALS`
   - 粘贴 Service Principal 的 JSON 输出

3. **部署**：
   - 推送到 main 分支自动部署
   - 或在 Actions 页面手动触发工作流

### 方法 2: Azure CLI

```bash
# 登录
az login

# 构建
npm install
npm run build

# 部署
az webapp up --name hubcar --resource-group <resource-group> --runtime "NODE:20-lts"
```

### 方法 3: Git 部署

```bash
# 配置 Azure Git remote
az webapp deployment source config-local-git --name hubcar --resource-group <resource-group>

# 添加 remote 并推送
git remote add azure <deployment-url>
git push azure main
```

## 验证 / Verification

部署后访问：
- 应用: https://hubcar.azurewebsites.net
- 健康检查: https://hubcar.azurewebsites.net/api/health

## 技术细节 / Technical Details

### 应用架构 / Application Architecture

```
┌─────────────────────────────────────┐
│      Azure Web App (hubcar)         │
│                                     │
│  ┌───────────────────────────────┐ │
│  │        IIS + iisnode          │ │
│  │                               │ │
│  │  ┌─────────────────────────┐ │ │
│  │  │   Express Server        │ │ │
│  │  │   (server/index.js)     │ │ │
│  │  │                         │ │ │
│  │  │  - Serve static files   │ │ │
│  │  │  - API endpoints        │ │ │
│  │  │  - SPA fallback         │ │ │
│  │  └─────────────────────────┘ │ │
│  │                               │ │
│  │  Static Files (dist/)         │ │
│  │  - React App                  │ │
│  │  - Assets                     │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### URL 路由 / URL Routing

- `/` → 提供 React SPA
- `/api/*` → Express API 端点
- 所有其他路由 → SPA 回退到 index.html

### 环境变量 / Environment Variables

可在 Azure Portal 配置：
- `NODE_ENV`: production
- `PORT`: 8080（默认）
- 自定义环境变量（如 Azure 密钥等）

## 注意事项 / Notes

1. ✅ 构建成功测试通过
2. ✅ 服务器启动成功
3. ✅ 静态文件正确生成
4. ✅ 配置文件格式正确
5. ⚠️ 需要在 GitHub 配置 Azure 发布配置文件 secret
6. ⚠️ 确保 Azure Web App 已创建并配置为 Node.js 20.x

## 下一步 / Next Steps

1. 配置 GitHub Secret: `AZURE_WEBAPP_PUBLISH_PROFILE`
2. 合并此 PR 到 main 分支
3. 等待 GitHub Actions 自动部署
4. 验证部署成功

## 相关链接 / Related Links

- [Azure Web Apps 文档](https://docs.microsoft.com/azure/app-service/)
- [Node.js 部署指南](https://docs.microsoft.com/azure/app-service/quickstart-nodejs)
- [GitHub Actions for Azure](https://github.com/Azure/actions)
