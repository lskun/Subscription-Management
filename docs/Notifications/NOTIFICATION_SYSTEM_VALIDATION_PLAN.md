# 统一通知系统完整验证方案

## 问题分析总结

### 原始问题
用户在测试notification-scheduler时遇到错误：
```
Error processing subscription_expiry_3_days: {
  code: "PGRST200",
  details: "Searched for a foreign key relationship between 'subscriptions' and 'users' in the schema 'public', but no matches were found.",
  hint: null,
  message: "Could not find a relationship between 'subscriptions' and 'users' in the schema cache"
}
```

### 根本原因
1. **字段名错误**: Edge Function中使用了不存在的`expires_at`和`cost`字段，实际应为`next_billing_date`和`amount`
2. **表关联错误**: 应该关联`user_profiles`表而不是`auth.users`表获取用户邮箱
3. **外键关系问题**: Supabase PostgREST无法识别跨schema的外键关系
4. **日期查询错误**: 使用了错误的时间戳格式比较date类型字段，导致查询结果为空
   - **具体问题**: 使用`.gte('next_billing_date', targetDateStr + ' 00:00:00')`和`.lt('next_billing_date', targetDateStr + ' 23:59:59')`查询date类型字段
   - **PostgreSQL兼容性**: date类型字段无法与带时间的timestamp格式字符串进行范围比较
   - **调试发现**: 查询结果为空集：`{ found: 0, error: null, subscriptions: [] }`

### 解决方案
- ✅ 修正字段名：`expires_at` → `next_billing_date`, `cost` → `amount`
- ✅ 修正表关联：`auth.users` → `user_profiles`
- ✅ 更新接口定义和数据处理逻辑
- ✅ **修正日期查询条件**: 从时间戳范围查询改为精确日期匹配
  ```typescript
  // 原有错误查询方式
  .gte('next_billing_date', targetDateStr + ' 00:00:00')
  .lt('next_billing_date', targetDateStr + ' 23:59:59')
  
  // 修正后的查询方式
  .eq('next_billing_date', targetDateStr)
  ```
- ✅ 更新邮件发送服务表名：`email_templates` → `unified_notification_templates`, `email_logs` → `notification_logs_v2`
- ✅ 统一参数格式兼容性处理
- ✅ **增加详细调试日志**: 关键处理步骤添加带emoji标识的debug日志，便于问题排查
- ✅ 重新部署Edge Function (版本21)

## 验证方案

### 1. 数据库表记录验证

#### 1.1 基础数据完整性检查
```sql
-- 验证订阅数据完整性
SELECT 
  s.id,
  s.user_id,
  s.name,
  s.amount,
  s.currency,
  s.next_billing_date,
  s.status,
  up.email,
  up.display_name,
  CASE 
    WHEN s.next_billing_date = CURRENT_DATE + INTERVAL '1 day' THEN '1天后到期'
    WHEN s.next_billing_date = CURRENT_DATE + INTERVAL '3 days' THEN '3天后到期' 
    WHEN s.next_billing_date = CURRENT_DATE + INTERVAL '7 days' THEN '7天后到期'
    WHEN s.next_billing_date < CURRENT_DATE THEN '已过期'
    ELSE '正常'
  END as expiry_status
FROM subscriptions s
JOIN user_profiles up ON s.user_id = up.id
WHERE s.status = 'active'
ORDER BY s.next_billing_date ASC;
```

#### 1.2 通知模板验证
```sql
-- 验证通知模板存在性和完整性
SELECT 
  template_key,
  channel_type,
  is_active,
  subject_template,
  LENGTH(text_template) as template_length
FROM unified_notification_templates
WHERE template_key IN ('subscription_expiry', 'subscription_expiry_notification')
ORDER BY template_key, channel_type;
```

#### 1.3 调度任务配置验证
```sql
-- 验证调度任务配置
SELECT 
  job_name,
  job_type,
  cron_spec,
  is_enabled,
  payload,
  last_run_at,
  last_status
FROM scheduler_jobs
WHERE job_name = 'notification-scheduler';
```

### 2. 通知流程验证

#### 2.1 订阅到期提醒测试
**测试目标**: 验证7天、3天、1天到期提醒功能

**测试步骤**:
1. 创建测试数据（设置不同到期时间的订阅）
2. 手动触发notification-scheduler
3. 验证通知生成和发送

```sql
-- 创建测试数据 (确保使用DATE类型格式)
UPDATE subscriptions 
SET next_billing_date = CURRENT_DATE + INTERVAL '3 days'
WHERE id = '916792b4-9d13-4cfe-8441-90e3c494c1f8';

-- 触发通知调度
SELECT public.scheduler_invoke_edge_function('notification-scheduler');

-- 验证通知记录
SELECT * FROM user_notifications WHERE created_at >= CURRENT_DATE;
SELECT * FROM notification_logs_v2 WHERE sent_at >= CURRENT_DATE ORDER BY sent_at DESC;

-- 验证日期查询修正效果
SELECT 
  s.id,
  s.name,
  s.next_billing_date,
  s.next_billing_date = CURRENT_DATE + INTERVAL '3 days' as matches_condition
FROM subscriptions s
WHERE s.status = 'active' 
  AND s.next_billing_date = CURRENT_DATE + INTERVAL '3 days';
```

#### 2.2 订阅过期通知测试
```sql
-- 创建过期订阅测试数据
UPDATE subscriptions 
SET next_billing_date = CURRENT_DATE - INTERVAL '1 days',
    status = 'expired'
WHERE id = 'test-subscription-id';
```

#### 2.3 用户偏好设置测试
```sql
-- 验证用户通知偏好
SELECT 
  user_id,
  setting_key,
  setting_value
FROM user_settings
WHERE setting_key = 'notifications';

-- 测试禁用通知的用户
INSERT INTO user_settings (user_id, setting_key, setting_value)
VALUES ('test-user-id', 'notifications', '{"subscription_expiry_reminders": false}');
```

### 3. 通知规则验证

#### 3.1 重复发送防护测试
```sql
-- 验证同一天不会重复发送相同通知
SELECT 
  user_id,
  notification_type,
  COUNT(*) as notification_count,
  DATE(sent_at) as sent_date
FROM notification_logs_v2
WHERE sent_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY user_id, notification_type, DATE(sent_at)
HAVING COUNT(*) > 1;
```

#### 3.2 通知类型映射验证
```sql
-- 验证通知类型正确映射到user_notifications.type
SELECT 
  type,
  COUNT(*) as count
FROM user_notifications
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY type;
```

### 4. 边界情况测试

#### 4.1 无效数据处理
```sql
-- 测试没有用户资料的订阅
SELECT s.* FROM subscriptions s
LEFT JOIN user_profiles up ON s.user_id = up.id
WHERE up.id IS NULL;

-- 测试没有邮箱的用户
SELECT * FROM user_profiles WHERE email IS NULL OR email = '';
```

#### 4.2 模板缺失处理
```sql
-- 临时禁用模板测试系统行为
UPDATE unified_notification_templates 
SET is_active = false 
WHERE template_key = 'subscription_expiry';

-- 恢复模板
UPDATE unified_notification_templates 
SET is_active = true 
WHERE template_key = 'subscription_expiry';
```

#### 4.3 大批量通知处理
```sql
-- 创建大量即将到期的订阅进行压力测试
UPDATE subscriptions 
SET next_billing_date = CURRENT_DATE + INTERVAL '3 days'
WHERE status = 'active'
LIMIT 50;
```

### 5. 性能验证

#### 5.1 执行时间监控
```sql
-- 监控Edge Function执行时间和调试日志
-- 重点关注：日期查询调试日志，订阅查询结果日志
SELECT 
  function_id,
  execution_time_ms,
  status_code,
  timestamp,
  CASE 
    WHEN log_message LIKE '%[DEBUG] 查询条件详情%' THEN '查询条件调试'
    WHEN log_message LIKE '%[DEBUG] 订阅查询结果%' THEN '查询结果调试'
    WHEN log_message LIKE '%Completed subscription_expiry_reminder%' THEN '处理完成摘要'
    ELSE '其他日志'
  END as log_type
FROM edge_function_logs
WHERE function_name = 'notification-scheduler'
ORDER BY timestamp DESC
LIMIT 20;

-- 专门查看调试日志内容
SELECT 
  timestamp,
  log_message
FROM edge_function_logs
WHERE function_name = 'notification-scheduler'
  AND (log_message LIKE '%[DEBUG]%' OR log_message LIKE '%Completed%')
ORDER BY timestamp DESC
LIMIT 10;
```

#### 5.2 通知发送效率
```sql
-- 统计通知发送成功率
SELECT 
  notification_type,
  channel_type,
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY notification_type, channel_type), 2) as percentage
FROM notification_logs_v2
WHERE sent_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY notification_type, channel_type, status
ORDER BY notification_type, channel_type, status;
```

### 6. 端到端验证脚本

#### 6.1 完整流程测试
```sql
-- 完整的端到端测试脚本
DO $$
DECLARE
  test_subscription_id uuid;
  test_user_id uuid;
  notification_count_before int;
  notification_count_after int;
BEGIN
  -- 1. 获取测试订阅
  SELECT id, user_id INTO test_subscription_id, test_user_id
  FROM subscriptions 
  WHERE status = 'active' 
  LIMIT 1;
  
  -- 2. 记录测试前通知数量
  SELECT COUNT(*) INTO notification_count_before
  FROM user_notifications
  WHERE user_id = test_user_id;
  
  -- 3. 设置订阅为3天后到期
  UPDATE subscriptions 
  SET next_billing_date = CURRENT_DATE + INTERVAL '3 days'
  WHERE id = test_subscription_id;
  
  -- 4. 触发通知调度
  PERFORM public.scheduler_invoke_edge_function('notification-scheduler');
  
  -- 5. 等待处理完成（实际应用中可能需要延迟）
  PERFORM pg_sleep(2);
  
  -- 6. 验证通知生成
  SELECT COUNT(*) INTO notification_count_after
  FROM user_notifications
  WHERE user_id = test_user_id;
  
  -- 7. 输出测试结果
  RAISE NOTICE '测试结果: 通知数量从 % 增加到 %', notification_count_before, notification_count_after;
  
  IF notification_count_after > notification_count_before THEN
    RAISE NOTICE '✅ 通知系统测试成功';
  ELSE
    RAISE NOTICE '❌ 通知系统测试失败';
  END IF;
  
END $$;
```

### 7. 监控和告警验证

#### 7.1 失败通知监控
```sql
-- 监控失败的通知
SELECT 
  notification_type,
  channel_type,
  error_message,
  COUNT(*) as failure_count,
  DATE(sent_at) as failure_date
FROM notification_logs_v2
WHERE status = 'failed'
  AND sent_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY notification_type, channel_type, error_message, DATE(sent_at)
ORDER BY failure_count DESC;
```

#### 7.2 调度任务状态监控
```sql
-- 监控调度任务执行状态
SELECT 
  job_name,
  last_run_at,
  next_run_at,
  last_status,
  failed_attempts
FROM scheduler_jobs
WHERE job_name = 'notification-scheduler';
```

## 预期验证结果

### 成功标准
1. **数据完整性**: 所有必要的表和字段存在且数据有效
2. **模板可用性**: 通知模板正确加载和渲染
3. **调度正常**: 定时任务按计划执行
4. **通知发送**: 满足条件的订阅生成相应通知
5. **重复防护**: 同一通知不会在同一天重复发送
6. **错误处理**: 异常情况得到妥善处理
7. **性能达标**: 大批量通知处理时间在可接受范围内
8. **日期查询正确性**: PostgreSQL date字段查询返回预期结果，不再出现空结果集
9. **调试日志完整**: 关键处理步骤有详细的debug日志输出，便于问题排查

### 失败处理
如果验证失败，应检查：
- **Edge Function日志**: 特别关注带有`[DEBUG]`标识的调试日志
- **数据库表结构和数据**: 验证字段类型和数据格式匹配
- **日期查询兼容性**: 确保date类型字段使用精确匹配而非时间戳范围查询
- **网络连接和权限配置**: 检查Resend API密钥和网络访问
- **模板语法和数据格式**: 验证unified_notification_templates表数据完整性
- **调试日志分析**: 通过emoji标识快速定位问题环节
  - 🔍 查询条件调试
  - 📊 查询结果统计
  - ✉️ 邮件发送状态
  - ⚠️ 错误和警告信息

## 总结

该验证方案提供了全面的测试覆盖，包括：
- ✅ 基础功能验证
- ✅ 边界情况测试  
- ✅ 性能压力测试
- ✅ 端到端集成测试
- ✅ 监控和告警验证
- ✅ **日期查询兼容性验证**: 专门针对PostgreSQL date字段的查询修正
- ✅ **调试日志验证**: 完善的问题排查和故障定位机制

通过系统性的验证，确保统一通知系统的稳定性和可靠性。

## 修复历史记录

**最新修复 (2025-08-24)**:
- ✅ **核心问题**: 解决了日期查询兼容性问题，从时间戳范围查询改为精确日期匹配
- ✅ **调试增强**: 添加了emoji标识的详细调试日志，大幅提升问题排查效率
- ✅ **版本部署**: Edge Function成功部署为版本21，现已正常处理订阅到期通知
- ✅ **测试验证**: notification_logs_v2表确认邮件发送成功，状态为"sent"，收件人191682304@qq.com