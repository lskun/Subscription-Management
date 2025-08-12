# Supabase项目设置指南

本文档详细说明如何设置Supabase项目以支持订阅管理SaaS平台。

## 1. 创建Supabase项目

### 1.1 注册Supabase账户
1. 访问 [https://supabase.com](https://supabase.com)
2. 点击"Start your project"注册账户
3. 使用GitHub账户登录（推荐）

### 1.2 创建新项目
1. 在Supabase仪表板中点击"New project"
2. 选择组织（如果是第一次使用，会自动创建）
3. 填写项目信息：
   - **Name**: `subscription-manager-saas`
   - **Database Password**: 生成强密码并保存
   - **Region**: 选择离用户最近的区域（推荐：Singapore for Asia）
4. 点击"Create new project"

### 1.3 获取项目配置信息
项目创建完成后，在项目设置页面获取以下信息：
1. 进入 **Settings** > **API**
2. 复制以下信息：
   - **Project URL**: `https://your-project-id.supabase.co`
   - **anon public key**: 用于客户端访问
   - **service_role secret**: 用于服务端访问（保密）

## 2. 配置Google OAuth认证

### 2.1 创建Google OAuth应用
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用Google+ API：
   - 进入 **APIs & Services** > **Library**
   - 搜索"Google+ API"并启用
4. 创建OAuth 2.0凭据：
   - 进入 **APIs & Services** > **Credentials**
   - 点击"Create Credentials" > "OAuth 2.0 Client IDs"
   - 选择"Web application"
   - 配置授权重定向URI：
     ```
     https://your-project-id.supabase.co/auth/v1/callback
     ```
   - 保存Client ID和Client Secret

### 2.2 在Supabase中配置Google OAuth
1. 在Supabase项目中进入 **Authentication** > **Providers**
2. 找到Google提供商并点击配置
3. 启用Google提供商
4. 填入Google OAuth凭据：
   - **Client ID**: 从Google Cloud Console获取
   - **Client Secret**: 从Google Cloud Console获取
5. 保存配置

## 3. 环境变量配置

### 3.1 开发环境配置
复制 `.env.development.example` 为 `.env` 并填入以下信息：

```bash
# Supabase配置
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 其他配置保持不变...
```

### 3.2 生产环境配置
在生产环境中设置以下环境变量：

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 4. 数据库安全配置

### 4.1 启用Row Level Security (RLS)
Supabase默认启用RLS，确保以下设置：

1. 进入 **Database** > **Tables**
2. 对于每个业务表，确保RLS已启用
3. 配置适当的RLS策略（将在后续任务中详细配置）

### 4.2 配置数据库权限
1. 进入 **Settings** > **Database**
2. 检查连接池设置：
   - **Pool Size**: 15（默认）
   - **Pool Timeout**: 10s（默认）
3. 确保SSL连接已启用

## 5. 安全配置

### 5.1 配置CORS设置
1. 进入 **Settings** > **API**
2. 在CORS设置中添加允许的域名：
   - 开发环境: `http://localhost:5173`
   - 生产环境: `https://your-domain.com`

### 5.2 配置JWT设置
1. 检查JWT过期时间设置：
   - **JWT expiry**: 3600 seconds（1小时）
   - **Refresh token expiry**: 604800 seconds（7天）
2. 确保JWT密钥安全存储

## 6. 邮件配置

### 6.1 配置SMTP设置
1. 进入 **Settings** > **Auth**
2. 配置SMTP设置：
   - **SMTP Host**: 使用第三方邮件服务（如SendGrid、Mailgun）
   - **SMTP Port**: 587（TLS）或465（SSL）
   - **SMTP User**: 邮件服务用户名
   - **SMTP Pass**: 邮件服务密码

### 6.2 自定义邮件模板
1. 在 **Authentication** > **Email Templates** 中自定义：
   - 确认邮件模板
   - 密码重置邮件模板
   - 邀请邮件模板

## 7. 监控和日志

### 7.1 启用日志记录
1. 进入 **Settings** > **Logs**
2. 启用以下日志类型：
   - **API**: 记录API请求
   - **Auth**: 记录认证事件
   - **Database**: 记录数据库查询

### 7.2 配置告警
1. 进入 **Settings** > **Billing**
2. 设置使用量告警：
   - **Database size**: 80% of limit
   - **API requests**: 80% of limit
   - **Auth users**: 80% of limit

## 8. 测试配置

### 8.1 测试认证流程
1. 启动开发服务器：`npm run dev`
2. 访问 `http://localhost:5173/login`
3. 测试Google OAuth登录
4. 测试邮箱密码登录
5. 测试密码重置功能

### 8.2 验证数据库连接
1. 在浏览器开发者工具中检查网络请求
2. 确认Supabase API调用成功
3. 验证RLS策略生效

## 9. 故障排除

### 9.1 常见问题
1. **OAuth重定向错误**：
   - 检查Google Cloud Console中的重定向URI配置
   - 确认Supabase项目URL正确

2. **CORS错误**：
   - 检查Supabase CORS设置
   - 确认开发服务器端口正确

3. **环境变量未加载**：
   - 确认.env文件位于项目根目录
   - 重启开发服务器

### 9.2 调试技巧
1. 使用浏览器开发者工具查看网络请求
2. 检查Supabase项目日志
3. 使用console.log调试认证状态

## 10. 安全最佳实践

### 10.1 密钥管理
- 永远不要在客户端代码中暴露service_role密钥
- 使用环境变量存储敏感信息
- 定期轮换API密钥

### 10.2 访问控制
- 为所有表启用RLS
- 使用最小权限原则
- 定期审查用户权限

### 10.3 监控
- 监控异常登录活动
- 设置API使用量告警
- 定期备份数据库

## 完成检查清单

- [ ] Supabase项目已创建
- [ ] Google OAuth已配置
- [ ] 环境变量已设置
- [ ] RLS已启用
- [ ] CORS已配置
- [ ] 邮件服务已配置
- [ ] 认证流程测试通过
- [ ] 数据库连接正常
- [ ] 日志和监控已启用
- [ ] 安全配置已完成

完成以上所有步骤后，Supabase项目就已经准备好支持订阅管理SaaS平台了。