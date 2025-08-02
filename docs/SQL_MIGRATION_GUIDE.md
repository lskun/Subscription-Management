# SQL迁移执行指南

## 概述
本指南详细说明如何在Supabase中正确执行数据库迁移脚本。

## 迁移文件
- `supabase/migrations/001_initial_schema.sql` - 初始数据库架构
- `supabase/migrations/002_user_triggers.sql` - 用户触发器配置

## 执行步骤

### 1. 准备工作
1. 确保已创建Supabase项目
2. 确保有项目的数据库访问权限
3. 备份现有数据（如果有）

### 2. 执行001_initial_schema.sql

#### 方法一：通过Supabase Dashboard（推荐）
1. 登录Supabase Dashboard
2. 选择你的项目
3. 进入 **SQL Editor**
4. 点击 **New query**
5. 复制 `supabase/migrations/001_initial_schema.sql` 的完整内容
6. 粘贴到SQL编辑器中
7. 点击 **Run** 执行

#### 方法二：通过Supabase CLI
```bash
# 安装Supabase CLI（如果未安装）
npm install -g supabase

# 登录Supabase
supabase login

# 链接到你的项目
supabase link --project-ref your-project-id

# 执行迁移
supabase db push
```

### 3. 验证执行结果

执行成功后，应该看到以下表被创建：

#### 核心表
- ✅ `user_profiles` - 用户配置表
- ✅ `subscription_plans` - 订阅计划表
- ✅ `user_subscriptions` - 用户订阅关系表
- ✅ `categories` - 分类表
- ✅ `payment_methods` - 支付方式表
- ✅ `subscriptions` - 订阅管理表
- ✅ `payment_history` - 支付历史表
- ✅ `exchange_rates` - 汇率数据表
- ✅ `user_settings` - 用户设置表

#### 默认数据
- ✅ 默认订阅计划（免费版）
- ✅ 默认分类（10个）
- ✅ 默认支付方式（8个）

#### RLS策略
每个表都应该有相应的Row Level Security策略：
- ✅ SELECT策略
- ✅ INSERT策略
- ✅ UPDATE策略
- ✅ DELETE策略

### 4. 执行002_user_triggers.sql

在成功执行第一个迁移后，执行第二个迁移文件：
1. 在SQL Editor中打开新查询
2. 复制 `supabase/migrations/002_user_triggers.sql` 内容
3. 执行脚本

### 5. 配置Webhook（重要）

由于Supabase的限制，我们需要手动配置Webhook来处理新用户注册：

1. 进入 **Database** > **Webhooks**
2. 点击 **Create a new hook**
3. 配置以下参数：
   - **Name**: `handle-new-user`
   - **Table**: `auth.users`
   - **Events**: `INSERT`
   - **Type**: `HTTP Request`
   - **HTTP Request URL**: `https://your-project-id.supabase.co/functions/v1/handle-new-user`
   - **HTTP Headers**:
     ```
     Content-Type: application/json
     Authorization: Bearer YOUR_SERVICE_ROLE_KEY
     ```

### 6. 部署Edge Function

1. 在Supabase Dashboard中进入 **Edge Functions**
2. 点击 **Create function**
3. 函数名称: `handle-new-user`
4. 复制 `supabase/functions/handle-new-user/index.ts` 的内容
5. 部署函数

## 常见问题和解决方案

### 问题1: 语法错误 "syntax error at or near ','"
**原因**: PostgreSQL不支持在RLS策略中使用逗号分隔多个操作

**解决方案**: 已修复，现在每个操作都有单独的策略

### 问题2: 权限错误
**原因**: 没有足够的数据库权限

**解决方案**: 
- 确保使用项目所有者账户
- 或者使用service_role密钥

### 问题3: 表已存在错误
**原因**: 之前执行过部分迁移

**解决方案**:
```sql
-- 清理现有表（谨慎使用）
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;
DROP TABLE IF EXISTS payment_history CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- 然后重新执行迁移
```

### 问题4: RLS策略冲突
**原因**: 策略名称重复

**解决方案**:
```sql
-- 删除现有策略
DROP POLICY IF EXISTS "策略名称" ON 表名;

-- 然后重新执行迁移
```

## 验证迁移成功

### 1. 检查表结构
```sql
-- 查看所有表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- 检查RLS是否启用
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 2. 检查默认数据
```sql
-- 检查默认订阅计划
SELECT * FROM subscription_plans WHERE is_default = true;

-- 检查默认分类
SELECT * FROM categories WHERE is_default = true;

-- 检查默认支付方式
SELECT * FROM payment_methods WHERE is_default = true;
```

### 3. 测试RLS策略
```sql
-- 这些查询应该返回空结果（因为没有认证用户）
SELECT * FROM user_profiles;
SELECT * FROM subscriptions;
SELECT * FROM payment_history;
```

## 回滚迁移

如果需要回滚迁移：

```sql
-- 删除所有触发器
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;

-- 删除函数
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS handle_new_user();

-- 删除所有表
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;
DROP TABLE IF EXISTS payment_history CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- 删除扩展（可选）
DROP EXTENSION IF EXISTS "uuid-ossp";
```

## 下一步

迁移成功后：
1. 配置Google OAuth认证
2. 设置环境变量
3. 运行 `npm run check-supabase` 验证配置
4. 测试应用功能

## 获取帮助

如果遇到问题：
1. 检查Supabase项目日志
2. 查看SQL Editor的错误信息
3. 参考 `docs/SUPABASE_SETUP.md`
4. 运行 `node scripts/validate-sql.js` 验证SQL语法