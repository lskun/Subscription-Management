# 实施计划

- [x] 1. 修复 RPC `process_subscription_renewal` 的支付状态值
  - 将 `payment_history.status` 写入值从 `succeeded` 改为 `success`
  - 在读取订阅时添加 `SELECT ... FOR UPDATE` 行级锁
  - 验证月/季/年周期计算与 `billing_period_end`
  - _需求: 1,2,3_

- [x] 2. 新增 Edge Function `auto-renew-subscriptions`
  - 查询 due 列表（service role），批处理 `LIMIT`+循环
  - 逐条调用 RPC；汇总 `{ processed, errors, skipped }`
  - 可选：写 `system_logs`/`system_stats`
  - _需求: 1,2,5,6_

- [x] 3. 调度与配置
  - 生产首选：DB 内批处理 + pg_cron
    - 新增 SQL：`util.process_due_auto_renewals(limit)`（并发加锁、失败不中断、统计汇总）
    - 调度：`select cron.schedule('auto-renew-daily','0 1 * * *','select util.process_due_auto_renewals(500);');`
    - 回滚：`cron.alter_job(..., active := false)`
  - 备选：pg_cron + pg_net.http_post 调用 Edge Function（已在设计文档提供 SQL）
  - _需求: 6_

- [x] 4. 前端与文档
  - 在 Admin 页面增加“手动触发”按钮（可选，管理员权限）
  - `docs/` 添加《自动续费技术方案》与操作说明
  - _需求: 4,6,7_

- [x] 5. 测试
  - 单元测试：日期/周期/到期判定
  - 集成测试：并发/重试/幂等
  - 回归：Dashboard/Reports 数据正确
  - _需求: 1,2,3_

- [ ] 6. 监控与回滚预案
  - 错误率、处理量指标；异常报警（可选）
  - 回滚策略：`cron.alter_job` 停用任务；或下调 `limit` 限流；保留手动触发入口
  - _需求: 5,6_
