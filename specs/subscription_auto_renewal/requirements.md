# 需求文档（Subscription Automatic Renewal）

## 介绍
为 `renewal_type = 'auto'` 的订阅在到期日或逾期时自动创建支付并顺延账期，保证数据一致性、幂等性与安全性，并提供监控与可观测性。

## 需求

### 需求 1 - 自动续费触发与处理
**用户故事：** 作为用户，我的自动续费订阅应在到期当天自动扣款并顺延下次计费日，避免服务中断。

#### 验收标准（ERAS）
1. When `renewal_type='auto'` and `status='active'` and `next_billing_date <= today`, the system shall create a payment record and update `last_billing_date=today`, `next_billing_date=按账单周期顺延`.
2. While the subscription is not due (next_billing_date > today), when auto-renew runs, the system shall not create a payment nor update dates.
3. While the subscription is `status!='active'` or `renewal_type!='auto'`, when auto-renew runs, the system shall skip it.
4. When concurrent auto-renew attempts occur, the system shall ensure at most one successful renewal per subscription per day.

### 需求 2 - 幂等与防重复
**用户故事：** 作为系统维护者，我希望任何重试或并发都不会造成重复扣款。

#### 验收标准（ERAS）
1. When the same subscription is processed multiple times in the same day, the system shall perform at most one renewal.
2. When `next_billing_date > today`, the system shall reject renewal with a clear error and no side effects.

### 需求 3 - 支付记录一致性
**用户故事：** 作为财务，我希望支付历史状态/金额/区间统一。

#### 验收标准（ERAS）
1. When a renewal succeeds, the system shall insert into `payment_history` with `status='success'`, `amount=sub.amount`, `currency=sub.currency`, `billing_period_start=today`, `billing_period_end=按周期末日`.
2. When a renewal fails, the system shall not insert payment history and shall not update subscription dates.

### 需求 4 - 权限与安全
**用户故事：** 作为安全负责人，我希望批处理仅由服务角色执行，且按用户边界严格更新。

#### 验收标准（ERAS）
1. When auto-renew job runs, the system shall use service role to查询 due 列表；具体更新通过 SECURITY DEFINER 的 RPC 函数按 `subscription_id + user_id` 精确匹配。
2. When a client user invokes manual renewal, the system shall only allow renewing his own subscription.

### 需求 5 - 错误处理与重试策略
**用户故事：** 作为运维，我希望失败可观测、可重试且不影响其他记录。

#### 验收标准（ERAS）
1. When a record fails, the system shall continue processing the batch and return aggregated `processed/errors`.
2. When transient errors occur, the system shall allow safe re-run without double charges.
3. When errors occur, the system shall log details into `system_logs` 或 `admin_operation_logs`。

### 需求 6 - 调度与可观测性
**用户故事：** 作为管理员，我希望有任务结果摘要与基础指标。

#### 验收标准（ERAS）
1. When the daily job completes, the system shall return summary: processed count, error count, skipped count.
2. When enabled, the system shall record daily counters into `system_stats`（可选）。

### 需求 7 - 通知（可选）
**用户故事：** 作为用户，我希望在自动续费后获得提醒（邮件或站内）。

#### 验收标准（ERAS）
1. While the user has enabled `renewal_reminders` and notification preference permits, when a renewal succeeds, the system shall create a `user_notifications` 记录并可选发送邮件。

## 边界情况与约束
- 计费周期：月/季/年，月底问题（2月/闰年）按 SQL interval 计算，确保 `billing_period_end` 为周期末日。
- 金额与币种：使用订阅当前的 `amount/currency`；跨币种资金流不在本功能范围内，仅记录。
- 订阅状态：`trial`/`cancelled` 不参与自动续费。
- 并发：同订阅在同一批次或多实例重复处理时，需行级锁或基于 `next_billing_date` 的幂等校验避免重复。
- 数据校验：`payment_history.status` 必须使用现有表约束中的 'success'（非 'succeeded'）。
- 权限：查询列表使用 service role；逐条更新仍通过 RPC 严格校验 `user_id`。
- 重跑：同日可安全重跑，不产生重复支付记录或日期跳跃。
