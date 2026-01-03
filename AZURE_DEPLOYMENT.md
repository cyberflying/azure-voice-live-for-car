# Azure Web App 部署指南

本文档说明如何将此应用部署到 Azure Web App (hubcar)。

## 前置要求

1. Azure 订阅
2. Azure Web App 已创建（名称：hubcar）
3. Node.js 运行时（推荐 20.x）

## 部署方式

### 方式一：GitHub Actions 自动部署（推荐）

1. **获取 Azure Web App 发布配置文件**
   - 登录 [Azure Portal](https://portal.azure.com)
   - 导航到您的 Web App（hubcar）
   - 点击 "Get publish profile" 下载发布配置文件
   - 或使用 Azure CLI：
     ```bash
     az webapp deployment list-publishing-profiles --name hubcar --resource-group <your-resource-group> --xml
     ```

2. **配置 GitHub Secrets**
   - 进入 GitHub 仓库的 Settings > Secrets and variables > Actions
   - 添加新的 secret：
     - Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
     - Value: 粘贴发布配置文件的全部内容

3. **触发部署**
   - 推送代码到 `main` 分支会自动触发部署
   - 或在 Actions 标签页手动触发 "Deploy to Azure Web App" workflow

### 方式二：Azure CLI 部署

```bash
# 登录 Azure
az login

# 设置默认订阅（如果有多个）
az account set --subscription <subscription-id>

# 构建应用
npm install
npm run build

# 部署到 Azure Web App
az webapp up --name hubcar --resource-group <your-resource-group> --runtime "NODE:20-lts"
```

### 方式三：VS Code Azure 扩展部署

1. 安装 "Azure App Service" 扩展
2. 登录 Azure 账户
3. 右键点击 Web App (hubcar)
4. 选择 "Deploy to Web App"
5. 选择构建输出目录

### 方式四：Git 部署

```bash
# 添加 Azure remote
az webapp deployment source config-local-git --name hubcar --resource-group <your-resource-group>

# 获取部署 URL 并添加为 remote
git remote add azure <deployment-url>

# 推送到 Azure
git push azure main
```

## 应用配置

### 环境变量

在 Azure Portal 中配置以下应用设置（如需要）：

- `NODE_ENV`: production
- `PORT`: 8080（默认）
- 其他自定义环境变量

### 启动命令

Azure Web App 会自动使用 `package.json` 中的 `start` 脚本：
```json
"start": "node server/index.js"
```

## 验证部署

部署完成后，访问：
- https://hubcar.azurewebsites.net

检查健康状态：
- https://hubcar.azurewebsites.net/api/health

## 故障排查

### 查看日志

1. 在 Azure Portal 中启用应用程序日志
2. 使用 Azure CLI 查看实时日志：
   ```bash
   az webapp log tail --name hubcar --resource-group <your-resource-group>
   ```

### 常见问题

1. **应用无法启动**
   - 检查 Node.js 版本是否匹配
   - 查看应用日志中的错误信息
   - 确认所有依赖都已正确安装

2. **静态资源 404**
   - 确认 `dist` 目录已正确构建
   - 检查 `web.config` 配置
   - 验证 `vite.config.js` 中的 `base` 设置为 `/`

3. **API 路由不工作**
   - 检查 Express 服务器是否正常运行
   - 验证 `web.config` 中的 URL 重写规则

## 技术栈

- **前端**: React + Vite
- **后端**: Express.js
- **部署**: Azure Web App (Node.js)
- **CI/CD**: GitHub Actions

## 文件说明

- `web.config`: IIS 配置文件，用于 Azure Web App 的 URL 重写和 Node.js 托管
- `.deployment`: 指定自定义部署脚本
- `deploy.sh`: Kudu 部署脚本
- `.github/workflows/azure-deploy.yml`: GitHub Actions 工作流

## 注意事项

1. 确保 `dist` 目录不在 `.gitignore` 中（如果使用 Git 部署）
2. 生产环境中，建议使用 Azure Application Insights 进行监控
3. 考虑配置自定义域名和 SSL 证书
4. 对于高可用性，可以配置多个部署槽位
