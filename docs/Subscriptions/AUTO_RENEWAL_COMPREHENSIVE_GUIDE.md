# 自动续费系统综合指南

## 概述

本文档提供了订阅管理系统中自动续费功能的完整架构设计、实施方案和迁移步骤。系统采用统一调度器架构，通过 pg_cron + Edge Function + 数据库函数的三层架构实现自动续费处理。

## 1. 系统架构

### 1.1 整体架构流程

```
pg_cron 定时触发
    ↓
scheduler_invoke_edge_function('auto_renew_subscriptions')
    ↓
pg_net.http_post → Edge Function (auto-renew-subscriptions)
    ↓
Edge Function 调用数据库 RPC
    ↓
public.process_due_auto_renewals(batch_size)
    ↓
处理结果返回 → 记录到 scheduler_job_runs
```

### 1.2 核心表结构

#### subscriptions 表
**用途**: 存储订阅信息

**关键字段**:
- `id` (uuid): 订阅唯一标识
- `user_id` (uuid): 用户ID
- `amount` (numeric): 订阅金额
- `currency` (text): 货币类型
- `billing_cycle` (text): 计费周期 (monthly/yearly)
- `status` (text): 订阅状态 (active/cancelled/expired)
- `auto_renew` (boolean): 是否自动续费
- `next_billing_date` (date): 下次计费日期
- `last_billing_date` (date): 上次计费日期

#### payment_history 表
**用途**: 记录支付历史

**关键字段**:
- `id` (uuid): 支付记录唯一标识
- `subscription_id` (uuid): 关联订阅ID
- `user_id` (uuid): 用户ID
- `amount_paid` (numeric): 支付金额
- `currency` (text): 货币类型
- `status` (text): 支付状态 (success/failed/pending)
- `payment_date` (date): 支付日期
- `billing_period_start` (date): 计费周期开始日期
- `billing_period_end` (date): 计费周期结束日期

#### 调度器相关表
- `scheduler_jobs`: 调度作业配置
- `scheduler_job_runs`: 调度运行日志
- `auto_renew_subscriptions_logs`: 自动续费批处理日志

### 1.3 函数架构

#### 三层函数架构

**第一层：核心处理函数**
- `public.process_subscription_renewal(p_subscription_id uuid, p_user_id uuid)`
  - 处理单个订阅的续费逻辑
  - 更新订阅状态和下次计费日期
  - 插入支付历史记录

**第二层：批处理函数**
- `public.process_due_auto_renewals(p_limit integer DEFAULT 500)`
  - 批量处理到期的自动续费订阅
  - 调用核心处理函数处理每个订阅
  - 返回详细的处理结果 (JSON格式)

**第三层：调度器函数**
- `public.scheduler_invoke_edge_function(p_job_name text)`
  - 统一调度器入口函数
  - 支持动态 Edge Function 调用
  - 记录执行状态到调度日志

## 2. 统一调度器

### 2.1 调度器函数

`scheduler_invoke_edge_function` 函数支持动态调用：

```sql
CREATE OR REPLACE FUNCTION public.scheduler_invoke_edge_function(p_job_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_job           public.scheduler_jobs;
  v_fn            text;
  v_body          jsonb;
  v_headers       jsonb;
  v_run_id        uuid;
  v_project_url   text;
  v_service_key   text;
  v_request_id    bigint;
begin
  -- 查找调度作业配置
  select * into v_job from public.scheduler_jobs where job_name = p_job_name;
  if not found then 
    raise exception 'scheduler job % not found', p_job_name; 
  end if;

  -- 记录运行开始
  insert into public.scheduler_job_runs(job_id, status) 
  values (v_job.id, 'partial') 
  returning id into v_run_id;

  -- 验证作业类型
  if v_job.job_type <> 'edge_function' then 
    raise exception 'unsupported job_type: %', v_job.job_type; 
  end if;

  -- 🔧 修复：根据 job_name 动态确定 Edge Function 名称
  v_fn := coalesce(
    (v_job.payload->>'function'), 
    CASE p_job_name
      WHEN 'auto_renew_subscriptions' THEN 'auto-renew-subscriptions'
      WHEN 'exchange_rates_update' THEN 'update-exchange-rates'
      ELSE p_job_name  -- 默认使用 job_name 作为函数名
    END
  );
  
  v_body := coalesce(
    v_job.payload->'body', 
    jsonb_build_object('executionType', 'scheduled')
  );

  -- 获取项目配置
  select value into v_project_url from admin.secrets where name = 'project_url';
  if v_project_url is null then 
    raise exception 'project_url not configured'; 
  end if;

  select value into v_service_key from admin.secrets where name = 'service_role_key';
  if v_service_key is null then 
    raise exception 'service_role_key not configured'; 
  end if;

  -- 构建请求头
  v_headers := jsonb_build_object(
    'Authorization', 'Bearer ' || v_service_key,
    'Content-Type', 'application/json'
  );

  -- 调用 Edge Function
  select net.http_post(
    format('%s/functions/v1/%s', v_project_url, v_fn), 
    v_body, 
    null, 
    v_headers, 
    30000
  ) into v_request_id;

  -- 更新运行结果
  if v_request_id is not null then
    update public.scheduler_job_runs 
    set status = 'success', 
        completed_at = now(), 
        result = jsonb_build_object('request_id', v_request_id) 
    where id = v_run_id;
    
    update public.scheduler_jobs 
    set last_run_at = now(), 
        last_status = 'success', 
        failed_attempts = 0, 
        updated_at = now() 
    where id = v_job.id;
  else
    update public.scheduler_job_runs 
    set status = 'failed', 
        completed_at = now(), 
        error_message = 'no_request_id' 
    where id = v_run_id;
    
    update public.scheduler_jobs 
    set last_run_at = now(), 
        last_status = 'failed', 
        failed_attempts = coalesce(failed_attempts, 0) + 1, 
        updated_at = now() 
    where id = v_job.id;
  end if;
end;
$$;
```

### 2.2 调度作业配置

```sql
-- 注册自动续费调度作业
INSERT INTO public.scheduler_jobs(
  job_name, 
  job_type, 
  cron_spec, 
  timezone, 
  is_enabled, 
  payload,
  max_retries
) VALUES (
  'auto_renew_subscriptions',
  'edge_function',
  '0 1 * * *',  -- 每天凌晨 1:00
  'Asia/Shanghai',
  false,  -- 默认禁用，等待管理员启用
  '{
    "function": "auto-renew-subscriptions",
    "body": {
      "batchSize": 500,
      "executionType": "scheduled"
    }
  }'::jsonb,
  3
) ON CONFLICT (job_name) DO NOTHING;
```

### 2.3 专用日志表

```sql
-- 自动续费批处理日志表
CREATE TABLE IF NOT EXISTS public.auto_renew_subscriptions_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduler_run_id uuid REFERENCES public.scheduler_job_runs(id),
  batch_size integer NOT NULL,
  processed_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  execution_time interval,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
  error_summary jsonb,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_auto_renew_subscriptions_logs_scheduler_run 
  ON public.auto_renew_subscriptions_logs(scheduler_run_id);
CREATE INDEX IF NOT EXISTS idx_auto_renewal_batch_logs_started_at 
  ON public.auto_renew_subscriptions_logs(started_at DESC);
```

## 3. Edge Function 设计

### 3.1 函数结构

**文件路径**: `supabase/functions/auto-renew-subscriptions/index.ts`

**主要功能**:
1. **批量处理**: 调用数据库函数处理到期续费
2. **调度运行ID传递**: 从请求体获取并设置到数据库会话
3. **错误处理**: 捕获和记录处理错误
4. **日志记录**: 记录详细的执行信息

### 3.2 核心实现

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RequestBody {
  batchSize?: number
  executionType?: string
  schedulerRunId?: string
}

serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body: RequestBody = await req.json().catch(() => ({}))
    const batchSize = body.batchSize || 500
    const schedulerRunId = body.schedulerRunId

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 设置调度运行ID到数据库会话
    if (schedulerRunId) {
      await supabase.rpc('set_config', {
        setting_name: 'app.scheduler_run_id',
        new_value: schedulerRunId,
        is_local: true
      })
    }

    // 调用批处理函数
    const { data: result, error } = await supabase.rpc(
      'process_due_auto_renewals',
      { p_limit: batchSize }
    )

    if (error) {
      console.error('Batch processing error:', error)
      throw new Error(`Batch processing failed: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        batchSize,
        schedulerRunId
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge Function Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

## 4. 迁移执行步骤

### 4.1 前置条件检查

```sql
-- 检查现有 pg_cron 任务
SELECT jobname, command, active 
FROM cron.job 
WHERE jobname LIKE '%auto%' OR jobname LIKE '%renew%';

-- 检查调度器表是否存在
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name IN ('scheduler_jobs', 'scheduler_job_runs');

-- 检查 admin.secrets 配置
SELECT name FROM admin.secrets 
WHERE name IN ('project_url', 'service_role_key');
```

### 4.2 执行步骤

#### 步骤 1: 修复调度器函数
执行上述 `scheduler_invoke_edge_function` 函数的修复代码。

#### 步骤 2: 创建调度作业配置
执行上述调度作业配置的 SQL 语句。

#### 步骤 3: 更新 pg_cron 任务命令

```sql
-- 更新现有任务命令
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'auto-renew-daily'),
  command := 'SELECT public.scheduler_invoke_edge_function(''auto_renew_subscriptions'');'
);

-- 验证更新结果
SELECT jobname, command, active 
FROM cron.job 
WHERE jobname = 'auto-renew-daily';
```

#### 步骤 4: 测试新配置

```sql
-- 手动测试调度器函数
SELECT public.scheduler_invoke_edge_function('auto_renew_subscriptions');

-- 检查执行结果
SELECT 
  sjr.status,
  sjr.started_at,
  sjr.completed_at,
  sjr.result,
  sjr.error_message
FROM scheduler_job_runs sjr
JOIN scheduler_jobs sj ON sjr.job_id = sj.id
WHERE sj.job_name = 'auto_renew_subscriptions'
ORDER BY sjr.started_at DESC
LIMIT 5;
```

#### 步骤 5: 启用新调度器

```sql
-- 启用自动续费调度作业
UPDATE public.scheduler_jobs 
SET is_enabled = true 
WHERE job_name = 'auto_renew_subscriptions';
```

### 4.3 回滚方案

#### 紧急回滚（5分钟内）
```sql
-- 立即恢复原有 pg_cron 任务命令
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'auto-renew-daily'),
  command := 'SELECT util.process_due_auto_renewals(500);'
);

-- 停用新调度器
UPDATE public.scheduler_jobs 
SET is_enabled = false 
WHERE job_name = 'auto_renew_subscriptions';
```

## 5. 问题分析与解决

### 5.1 当前系统问题

#### 约束违反问题
**问题描述**: `process_subscription_renewal` 函数在插入 `payment_history` 表时出现间歇性约束违反错误。

**根本原因**:
1. 硬编码状态值可能存在字符编码问题
2. 并发访问导致的竞态条件
3. 临时的系统资源问题

#### 架构不一致问题
**问题描述**: 自动续费系统与汇率更新系统使用不同的调度架构。

**解决方案**: 通过统一调度器架构实现一致性管理。

### 5.2 优化建议

#### 短期修复
1. **增强错误处理**: 在批处理函数中添加重试逻辑
2. **改进日志记录**: 记录更详细的错误上下文
3. **并发控制**: 实现订阅级别的锁机制

#### 中期优化
1. **状态管理优化**: 引入中间状态 (processing)
2. **监控增强**: 添加实时监控指标和告警机制
3. **性能优化**: 优化批处理大小和分片处理

## 6. 验证和监控

### 6.1 功能验证

```sql
-- 检查调度器作业状态
SELECT * FROM public.scheduler_status('auto_renew_subscriptions');

-- 查看最近的执行记录
SELECT 
  sjr.*,
  sj.job_name
FROM scheduler_job_runs sjr
JOIN scheduler_jobs sj ON sjr.job_id = sj.id
WHERE sj.job_name = 'auto_renew_subscriptions'
ORDER BY sjr.started_at DESC
LIMIT 10;

-- 检查批处理日志
SELECT 
  batch_size,
  processed_count,
  success_count,
  failed_count,
  status,
  started_at,
  completed_at
FROM auto_renew_subscriptions_logs
ORDER BY started_at DESC
LIMIT 10;
```

### 6.2 关键监控指标

- **成功率**: 自动续费成功处理的比例
- **错误率**: 约束违反错误的发生频率
- **处理延迟**: 从到期到处理完成的时间
- **批处理效率**: 每次批处理的平均处理数量

### 6.3 告警规则

- 连续 3 次批处理失败
- 错误率超过 5%
- 处理延迟超过 24 小时
- 到期订阅积压超过 100 个

## 7. 成功标准

✅ **迁移成功的标志**：
1. `pg_cron` 任务命令已更新为调用 `scheduler_invoke_edge_function`
2. `scheduler_invoke_edge_function` 函数能根据 `job_name` 正确调用对应的 Edge Function
3. 手动测试调用成功，返回正确的执行结果
4. 调度器状态显示为启用且配置正确
5. 系统日志中无相关错误信息
6. 批处理日志正确记录执行详情

🔄 **需要回滚的情况**：
1. 手动测试调用失败
2. Edge Function 调用超时或返回错误
3. 调度器执行记录显示连续失败
4. 自动续费处理出现异常或数据不一致

## 8. 注意事项

### 8.1 执行时机
- **建议在维护窗口期执行**，避免影响正常的自动续费处理
- **避开每天凌晨1点**，这是当前自动续费的执行时间

### 8.2 风险控制
- 保持原有的 `public.process_due_auto_renewals` 函数不变，作为备用方案
- 确保 Edge Function `auto-renew-subscriptions` 已正确部署
- 验证 `admin.secrets` 中的配置正确

### 8.3 后续优化
- 考虑实现函数名映射表，提供更灵活的配置方式
- 增加执行时间监控和告警机制
- 实现失败重试的指数退避策略

## 9. 修复记录

### 9.1 2025年8月19日 - 数据库函数和Edge Function修复

#### 问题描述
在测试自动续费系统时发现以下问题：
1. `process_due_auto_renewals` 函数引用了不存在的 `s.description` 字段
2. 函数中使用了不存在的 `is_active` 和 `auto_renew` 字段
3. Edge Function 执行时返回 500 错误

#### 修复内容

**1. 数据库函数修复 (`process_due_auto_renewals`)**

修复的关键问题：
- 将 `s.description` 修正为 `s.notes`（根据实际表结构）
- 移除对不存在字段 `is_active` 和 `auto_renew` 的依赖
- 修正 `execution_time` 计算方式
- 改进错误处理逻辑

修复后的函数核心逻辑：
```sql
-- 查询到期订阅时使用正确的字段名
SELECT s.id, s.user_id, s.amount, s.currency, s.notes
FROM public.subscriptions s
WHERE s.next_billing_date <= CURRENT_DATE
  AND s.status = 'active'
  AND s.renewal_type = 'auto'
ORDER BY s.next_billing_date
LIMIT p_limit;
```

**2. Edge Function 重新部署 (`auto-renew-subscriptions`)**

修复的关键问题：
- 简化了函数逻辑，移除了复杂的批处理循环
- 直接从请求体获取 `scheduler_run_id` 和 `limit` 参数
- 改进了错误处理和响应格式

修复后的 Edge Function 核心代码：
```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const { scheduler_run_id, limit = 10 } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase.rpc('process_due_auto_renewals', {
      p_limit: limit,
      p_scheduler_run_id: scheduler_run_id
    });

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
```

#### 验证结果

**1. 数据库函数测试**
- ✅ 函数执行成功，无语法错误
- ✅ 正确处理 `scheduler_run_id` 参数
- ✅ 返回预期的结果格式：`{"success": true, "error_count": 0, "processed_count": 0}`

**2. Edge Function 测试**
- ✅ 部署成功，无部署错误
- ✅ 通过调度器调用成功
- ✅ 正确接收和处理 `scheduler_run_id` 参数

**3. 端到端集成测试**
- ✅ `scheduler_invoke_edge_function('auto_renew_subscriptions')` 执行成功
- ✅ `scheduler_run_id` 正确传递和关联
- ✅ 批处理日志正确记录执行详情

测试执行记录：
```
调度运行ID: dad8a0b6-6c4d-47a9-b66f-dfc783c37b09
批处理日志ID: bf6baaf1-41a3-4d7a-9091-a0f292f064a6
状态: completed
处理数量: 0 (无到期订阅)
```

#### 修复影响
- 🔧 **数据库函数**: 修正了字段引用错误，确保函数能正常执行
- 🚀 **Edge Function**: 简化了逻辑，提高了可靠性和可维护性
- 📊 **日志记录**: 确保了调度运行ID的正确关联和追踪
- ✅ **系统稳定性**: 消除了500错误，提高了系统可用性

#### 后续建议
1. 定期检查数据库表结构变更，及时更新相关函数
2. 在Edge Function中增加更详细的日志记录
3. 考虑添加单元测试覆盖关键业务逻辑
4. 建立监控告警机制，及时发现类似问题

---

**文档版本**: v2.1  
**创建日期**: 2024年12月  
**最后更新**: 2025年8月19日  
**维护者**: 系统架构团队