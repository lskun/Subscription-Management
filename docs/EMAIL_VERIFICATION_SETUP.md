# 邮箱验证设置指南

## 问题描述

当前注册流程存在以下问题：
1. 邮箱验证链接失败 - verify链接无法正常工作
2. 注册后自动登录逻辑错误 - 应该提示用户去邮箱确认，而不是自动登录

## 解决方案

### 1. Supabase Dashboard 配置

#### 1.1 邮箱认证设置
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 导航到 **Authentication > Settings**
4. 在 **Email Auth** 部分配置：
   - ✅ **Enable email confirmations**: 启用
   - ✅ **Confirm email change**: 启用（推荐）
   - ✅ **Enable secure email change**: 启用（推荐）

#### 1.2 URL 配置
1. 在 **Authentication > URL Configuration** 中设置：
   - **Site URL**: `http://localhost:5173`
   - **Redirect URLs** 添加：
     - `http://localhost:5173/auth/callback`
     - `http://localhost:5173/auth/reset-password`

#### 1.3 邮件模板配置（可选）
1. 在 **Authentication > Email Templates** 中可以自定义：
   - **Confirm signup** 模板
   - **Magic Link** 模板
   - **Change Email Address** 模板
   - **Reset Password** 模板

### 2. 代码修改

#### 2.1 注册流程修改
- ✅ 修改 `LoginModal.tsx` 中的注册处理逻辑
- ✅ 更新 `AuthService.signUp()` 方法
- ✅ 调整 `AuthContext.signUp()` 返回值

#### 2.2 回调页面增强
- ✅ 修改 `AuthCallbackPage.tsx` 支持邮箱验证回调
- ✅ 区分 OAuth 回调和邮箱验证回调

### 3. 用户流程

#### 3.1 注册流程
1. 用户填写注册表单（邮箱、密码、确认密码）
2. 点击"注册"按钮
3. 系统显示：**"注册成功！我们已向 xxx@xxx.com 发送了确认邮件。请检查您的邮箱（包括垃圾邮件文件夹），点击确认链接完成注册。"**
4. 用户检查邮箱，点击确认链接
5. 链接跳转到 `/auth/callback?type=signup&token=...`
6. 系统验证邮箱，自动登录用户
7. 跳转到仪表板页面

#### 3.2 邮箱验证链接格式
```
https://your-project.supabase.co/auth/v1/verify?token=xxx&type=signup&redirect_to=http://localhost:5173/auth/callback
```

### 4. 测试步骤

#### 4.1 运行配置检查
```bash
npx tsx scripts/check-supabase-auth-config.ts
```

#### 4.2 手动测试
1. 打开 `http://localhost:5173`
2. 点击 "Sign In" 打开登录模态框
3. 切换到 "注册" 标签
4. 使用真实邮箱注册（如 QQ 邮箱）
5. 检查是否显示邮箱确认提示
6. 检查邮箱是否收到确认邮件
7. 点击邮件中的确认链接
8. 验证是否成功跳转到仪表板

### 5. 故障排除

#### 5.1 邮箱验证链接失败
- 检查 Supabase Dashboard 中的 Redirect URLs 配置
- 确认邮箱确认功能已启用
- 检查邮件是否在垃圾邮件文件夹

#### 5.2 注册后立即登录
- 检查 Supabase 的 "Enable email confirmations" 设置
- 如果禁用了邮箱确认，用户会立即登录

#### 5.3 回调页面错误
- 检查 `AuthCallbackPage.tsx` 的错误处理
- 查看浏览器控制台的错误信息
- 检查网络请求是否成功

### 6. 生产环境配置

在部署到生产环境时，需要更新：
1. **Site URL**: 改为生产域名
2. **Redirect URLs**: 添加生产环境的回调URL
3. **邮件模板**: 更新品牌信息和链接

### 7. 安全考虑

1. **邮箱验证是必需的**：防止恶意注册和垃圾邮件
2. **HTTPS**: 生产环境必须使用 HTTPS
3. **域名验证**: 确保重定向URL只包含可信域名
4. **令牌过期**: 邮箱验证链接应该有合理的过期时间

## 相关文件

- `src/components/auth/LoginModal.tsx` - 注册表单和逻辑
- `src/services/authService.ts` - 认证服务
- `src/contexts/AuthContext.tsx` - 认证上下文
- `src/pages/AuthCallbackPage.tsx` - 认证回调处理
- `scripts/check-supabase-auth-config.ts` - 配置检查脚本