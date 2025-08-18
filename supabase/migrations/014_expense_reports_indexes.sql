-- 索引：优化报表查询（最大复用原则：先检测是否已存在，否则创建）
-- 注意：Supabase迁移通常不使用 CONCURRENTLY，建议在业务低峰执行

-- 复合索引：按用户/状态/日期检索支付
create index if not exists idx_payment_user_status_date
  on public.payment_history(user_id, status, payment_date);

-- 可选辅助索引：涉及订阅维度的聚合场景（如分类）
create index if not exists idx_payment_user_sub_date
  on public.payment_history(user_id, subscription_id, payment_date);

-- 大表时间列的 BRIN 索引（可选，按需启用）
-- create index if not exists brin_payment_date on public.payment_history using brin(payment_date);
