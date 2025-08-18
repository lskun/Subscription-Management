# 技术方案设计（Expense Reports SQL 聚合与性能优化）

## 概览
- 入口：保留 `supabase/functions/expense-reports/index.ts` 作为调用入口与参数解析。
- 计算：将金额口径统一为 `payment_history(status='success')` 的真实支付，并将 period 聚合（月/季/年）与分类聚合尽量下推到 SQL。
- 汇率：复用“最新汇率快照”口径（与 Dashboard 一致）。
- 兼容：保留“2023 年金额置 0”的硬编码规则（年度与分类）。
- 复用：保持现有前端请求/响应结构与调用链（`supabaseGateway.invokeFunction`）。

## 数据与索引
- 主数据表：`payment_history(user_id, subscription_id, amount_paid, currency, status, payment_date)`。
- 推荐索引：
  - `create index concurrently if not exists idx_payment_user_status_date on payment_history(user_id, status, payment_date);`
  - 可选：`create index concurrently if not exists idx_payment_user_sub_date on payment_history(user_id, subscription_id, payment_date);`
  - 大表时间列可用 BRIN：`create index concurrently if not exists brin_payment_date on payment_history using brin(payment_date);`

## 汇率获取（最新快照）
- CTE 取最新日期：`with latest_date as (select max(date) d from exchange_rates)`。
- 同日汇率：`rates as (select from_currency, to_currency, rate from exchange_rates where date=(select d from latest_date))`。
- 换算策略：
  - 若 `from_currency = target`：直接 sum(amount_paid)。
  - 否则：`sum(amount_paid * r1.rate * r2.rate)`，r1=`from→CNY`，r2=`CNY→target`（缺失时回退 amount_paid）。

## SQL 聚合要点（示意）
- 仅拉取所需字段，限定用户与时间窗：`where user_id=$1 and status='success' and payment_date between $2 and $3`。
- 月度/季度/年度：`date_trunc('month'/'quarter'/'year', payment_date)` 分组聚合；可以 generate_series 生成完整区间并 left join，补零。
- 分类：`payment_history p left join subscriptions s on p.subscription_id=s.id left join categories c on s.category_id=c.id`，按 `c.value,c.label` 聚合。
- 硬编码年份（保留）：
  - 年度与分类聚合结果上应用 `CASE WHEN year=2023 THEN 0 ELSE total END AS total`。

## Edge Function 改造点（不改接口）
- 修正支付状态过滤：`'succeeded'` → `'success'`。
- 使用单次或少量 SQL（CTE/多聚合）返回：
  - monthlyExpenses（月范围内每月的 total、paymentCount）
  - quarterlyExpenses（可选打开时）
  - yearlyExpenses（年范围内每年的 total、paymentCount，含 2023 置 0）
  - categoryExpenses（按分类 total、subscriptionCount，含 2023 置 0 规则）
  - expenseInfo（月/季/年，与上述聚合共享结果；change 基于上一期 total 计算）
- 移除 JS 端对订阅理论金额的 reduce 计算，仅保留参数解析与结果组装。

## 性能策略
- 减少往返：尽量将多种聚合合并为 1-2 个 SQL；必要时并行 Promise.all 两组查询。
- 内存开销：避免拉取全部明细到 Edge，仅返回聚合结果。
- 汇率：保留“最新汇率一次性获取”；可选在 Edge 内部增加 60s TTL 内存缓存，减少重复查询。

## 安全性
- 继续使用用户 JWT（`Authorization`）；RLS 保证 `payment_history.user_id = auth.uid()`。

## 测试策略
- 单测：构造小型数据集，验证 period 与分类金额与数据库聚合一致；验证 2023 年置 0；验证 change 计算。
- 集成：用真实数据对比 Dashboard；确认响应结构与 include* 开关行为不变。
- 回归：保证 `expenseReportsEdgeFunctionService` 无需改动即可工作。

## 运维与观察
- 监控 Edge 日志与 `pg_stat_statements`；观察 P95。
- 如大用户查询慢：评估物化视图（按天/按月）与 `pg_cron` 定时刷新，Edge 仅做读取。
