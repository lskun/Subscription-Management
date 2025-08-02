# 迁移文件语法错误修复指南

## 问题描述

执行 `006_enhance_rls_policies.sql` 时出现语法错误：
```
ERROR: 42601: syntax error at or near "$"
LINE 262: ) AS $^
```

## 问题原因

PostgreSQL函数定义中的美元符号标记（dollar quoting）不完整。PostgreSQL要求函数体使用匹配的美元符号标记，如 `$$` 或 `$function$`。

## 解决方案

### 选项1: 使用修复后的文件（推荐）

我已经创建了修复后的文件：`supabase/migrations/006_enhance_rls_policies_fixed.sql`

**执行步骤**：
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入您的项目
3. 点击 "SQL Editor"
4. 复制 `006_enhance_rls_policies_fixed.sql` 的内容
5. 粘贴到编辑器并点击 "Run"

### 选项2: 手动修复原文件

如果您想修复原文件，需要将以下内容：

**错误的语法**：
```sql
) AS $
BEGIN
...
END;
$ LANGUAGE plpgsql;
```

**修复为**：
```sql
) AS $$
BEGIN
...
END;
$$ LANGUAGE plpgsql;
```

## 修复后的功能

修复后的文件包含以下功能：

1. **增强的RLS策略** - 更严格的数据访问控制
2. **性能优化索引** - 提高查询性能
3. **测试函数** - 验证RLS策略有效性
4. **监控视图** - 监控RLS策略状态

## 验证修复结果

执行修复后的迁移文件后，运行以下命令验证：

```bash
# 测试RLS策略
node scripts/test-rls-policies.js

# 全面测试
node scripts/comprehensive-rls-test.js
```

## 预期结果

成功执行后，您应该看到：

```
🎉 RLS策略基本测试完成！
📋 测试总结:
   ✅ 匿名用户访问限制正常
   ✅ 默认数据访问正常
   ✅ RLS策略配置正确
```

## 如果仍有问题

如果修复后的文件仍有问题，您可以：

1. **跳过这个迁移** - 当前的数据库状态已经可以正常工作
2. **分段执行** - 将文件分成几个部分分别执行
3. **使用简化版本** - 我可以为您创建一个更简单的版本

## 简化版本（备选方案）

如果您只想要基本的RLS增强，可以执行以下简化的SQL：

```sql
-- 基本RLS策略增强
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 性能优化索引
CREATE INDEX IF NOT EXISTS idx_categories_user_id_default ON categories(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id_default ON payment_methods(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id_status ON subscriptions(user_id, status);
```

这个简化版本不包含函数定义，避免了语法错误问题。