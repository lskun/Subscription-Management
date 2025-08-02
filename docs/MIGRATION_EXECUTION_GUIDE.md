# 数据库迁移执行指南

本文档说明如何在Supabase中执行数据库迁移文件。

## 迁移文件概览

当前项目包含以下迁移文件：

1. `001_initial_schema.sql` - 初始数据库架构
2. `002_user_triggers.sql` - 用户触发器配置
3. `003_insert_default_data.sql` - 插入默认数据
4. `004_fix_default_data_access.sql` - 修复默认数据访问权限
5. `005_cleanup_triggers.sql` - 清理有问题的触发器
6. `006_enhance_rls_policies.sql` - 增强RLS策略
7. `007_fix_rls_anonymous_access.sql` - 修复匿名访问限制

## 执行方法

### 方法1: 使用Supabase Dashboard（推荐）

1. **登录Supabase Dashboard**
   - 访问 [https://supabase.com](https://supabase.com)
   - 登录您的账户
   - 选择您的项目

2. **进入SQL编辑器**
   - 在左侧导航栏中点击 "SQL Editor"
   - 或者直接访问 `https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql`

3. **执行迁移文件**
   - 按照文件名的数字顺序执行（001, 002, 003...）
   - 复制迁移文件的内容到SQL编辑器
   - 点击 "Run" 按钮执行
   - 确认每个迁移都成功执行后再执行下一个

### 方法2: 使用Supabase CLI

如果您安装了Supabase CLI，可以使用以下命令：

```bash
# 安装Supabase CLI（如果还没有安装）
npm install -g supabase

# 登录Supabase
supabase login

# 链接到您的项目
supabase link --project-ref YOUR_PROJECT_ID

# 推送迁移到远程数据库
supabase db push
```

## 执行顺序和注意事项

### 1. 001_initial_schema.sql
- **作用**: 创建所有基础表结构、RLS策略、索引和触发器
- **注意**: 这是最重要的迁移，包含完整的数据库架构
- **执行时间**: 可能需要几秒钟

### 2. 002_user_triggers.sql
- **作用**: 配置用户注册触发器
- **注意**: 包含一些实验性的触发器配置
- **状态**: 部分功能可能不工作，后续会被清理

### 3. 003_insert_default_data.sql
- **作用**: 插入默认的订阅计划、分类和支付方式
- **注意**: 使用 `WHERE NOT EXISTS` 避免重复插入
- **验证**: 执行后应该有1个订阅计划、10个分类、8个支付方式

### 4. 004_fix_default_data_access.sql
- **作用**: 修复默认数据的访问权限
- **注意**: 允许匿名用户访问默认分类和支付方式
- **重要**: 这对前端正常工作很重要

### 5. 005_cleanup_triggers.sql
- **作用**: 清理有问题的触发器和函数
- **注意**: 删除002中创建的有问题的触发器
- **安全**: 可以安全执行，即使触发器不存在

### 6. 006_enhance_rls_policies.sql ⭐
- **作用**: 增强和完善RLS策略
- **重要**: 这是您当前需要执行的文件
- **功能**: 
  - 重新创建更严格的RLS策略
  - 添加性能优化索引
  - 创建RLS测试函数

### 7. 007_fix_rls_anonymous_access.sql ⭐
- **作用**: 修复匿名用户访问限制
- **重要**: 确保数据安全
- **功能**:
  - 确保匿名用户无法访问受保护的表
  - 只允许认证用户访问自己的数据

## 验证迁移结果

执行完所有迁移后，运行以下验证脚本：

```bash
# 验证数据库配置
node scripts/check-supabase-config.js

# 测试RLS策略
node scripts/test-rls-policies.js

# 验证默认数据
node scripts/validate-default-data.js

# 全面RLS测试
node scripts/comprehensive-rls-test.js
```

## 常见问题

### Q: 执行迁移时出现错误怎么办？
A: 
1. 检查错误信息，通常会指出具体问题
2. 确保按照正确的顺序执行
3. 如果是权限问题，确保您有数据库管理权限
4. 可以尝试分段执行，一次执行一小部分SQL

### Q: 可以重复执行迁移吗？
A: 
- 大部分迁移使用了 `IF NOT EXISTS` 或 `DROP IF EXISTS`，可以安全重复执行
- 但建议只在必要时重复执行

### Q: 如何回滚迁移？
A: 
- Supabase没有自动回滚功能
- 如果需要回滚，需要手动编写反向SQL语句
- 建议在执行前备份重要数据

## 执行检查清单

执行迁移前请确认：

- [ ] 已备份重要数据（如果有）
- [ ] 有Supabase项目的管理权限
- [ ] 环境变量配置正确
- [ ] 按照正确顺序执行迁移

执行迁移后请验证：

- [ ] 所有表都已创建
- [ ] RLS策略正常工作
- [ ] 默认数据已插入
- [ ] 验证脚本全部通过

## 下一步

完成数据库迁移后，您可以：

1. 配置Google OAuth认证
2. 设置用户注册流程
3. 开始前端开发
4. 测试完整的用户流程

如果在执行过程中遇到问题，请检查Supabase项目的日志或联系技术支持。