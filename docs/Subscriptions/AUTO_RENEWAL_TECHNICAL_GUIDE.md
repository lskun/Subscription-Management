# 自动续费技术方案与操作说明

## 概述
本系统的订阅自动续费采用“DB 内部批处理 + pg_cron”作为生产方案，提供 Edge Function 作为手动/备用通道。

## 关键组件
- 数据库函数（单条续费）：`public.process_subscription_renewal(p_subscription_id uuid, p_user_id uuid) returns jsonb`
  - 行级锁：`SELECT ... FOR UPDATE`
  - 正确写入 `payment_history.status = 'success'`
- 批处理函数（生产）：`util.process_due_auto_renewals(p_limit int default 500) returns jsonb`
  - 选择到期行并 `FOR UPDATE SKIP LOCKED` 并发安全处理
  - 失败不中断，累计统计并写入 `system_logs`/`system_stats`
- RPC 包装（供前端调用）：`public.process_due_auto_renewals(p_limit int default 500) returns jsonb`
  - 授权：`authenticated`, `service_role`
- 定时任务：`pg_cron`
  - 例：`select cron.schedule('auto-renew-daily','0 1 * * *','select util.process_due_auto_renewals(500);');`
- Edge Function（备用/手动触发）：`auto-renew-subscriptions`
  - 查询到期订阅并逐条调用 `process_subscription_renewal`

## 前端操作（管理员）
- 路径：`Admin Dashboard -> 系统设置 -> 系统运行选项`
- 按钮：`手动触发自动续费`
  - 优先调用：`supabase.rpc('process_due_auto_renewals', { p_limit: 200 })`
  - 失败回退：`supabase.functions.invoke('auto-renew-subscriptions')`
  - 结果：Toast 提示处理数量；管理员操作日志记录 `auto_renewal_manual_trigger` / `auto_renewal_manual_trigger_error`

## 运维与排查
- 会话要求：前端调用要求管理员登录（Edge Function `verify_jwt=true`；RPC 需要 `authenticated`）
- 常见错误
  - 无会话：浏览器本地 token 过期 → 重新登录
  - RPC 无权限：检查 `public.process_due_auto_renewals` 授权
  - Edge Function 404：确认已部署 `auto-renew-subscriptions`
  - pg_cron 不存在：`create extension if not exists pg_cron;`

## 回滚与限流
- 停用定时任务：`select cron.alter_job(job_id, active := false);`
- 下调批量：改 `p_limit` 或定时语句中的参数
- 仍保留“手动触发”作为补救手段

## 验收要点
- 到期 `auto` 订阅点击后应更新 `subscriptions.last_billing_date/next_billing_date`
- `payment_history` 产生一条 `status='success'`、周期覆盖准确的记录
- 并发触发不产生双支付（行锁+skip locked）


