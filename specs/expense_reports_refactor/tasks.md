# 实施计划（Expense Reports 统一口径与性能优化）

- [x] 1. 调整支付状态过滤
- 将 Edge Function 中 `payment_history` 查询的 `status` 从 `'succeeded'` 改为 `'success'`
- 验证在同一时间窗内能返回支付记录
- _需求: 1, 4

- [x] 2. 索引优化（最大复用，避免重复已有索引）
- 检查是否已有：`(user_id, status, payment_date)` 复合索引；若无则创建（并发构建）
- 评估是否需要 `(user_id, subscription_id, payment_date)` 辅助索引与 BRIN(payment_date)
- _需求: 4

- [x] 3. SQL 聚合草拟与对账
- 月/季/年：按请求时间窗聚合真实支付金额与支付次数（date_trunc + rates join）；补零期用 generate_series 或前端感知
- 分类：`payment_history → subscriptions → categories` 聚合 total、count(distinct subscription_id)
- 汇率：最新日期快照；from→CNY→target；缺失回退原币
- 验证对照 SQL（控制台）与预期一致
- _需求: 1, 2, 3, 4, 6

- [x] 3.1 新增 SQL 聚合函数（monthly/yearly/category），含最新汇率快照与 2023 硬编码
- [ ] 3.2 控制台对账 SQL 与 Edge 结果，确认一致后切换 Edge 使用 SQL

- [x] 4. Edge Function 改造（不改前端接口与结构）
- 以 1-2 条 SQL（或 Promise.all 两组）获取所有聚合
- 组装为现有返回结构：`monthlyExpenses/yearlyExpenses/categoryExpenses/expenseInfo`
- expenseInfo 的 change 基于上期 total 计算
- _需求: 1, 2, 3, 4, 5
  
- [x] 4.1 将月/季/年金额与趋势改为基于“实际支付流水”的 period 汇总（保留 2023 年硬编码）
- [x] 4.2 分类统计改为基于支付流水 + `subscription_id → category` 映射，未命中归入 other

- [x] 6. 性能观测埋点
- 在 Edge 中为月/年/分类 SQL 聚合调用添加 console.time/console.timeEnd，用于 P95 观测

- [ ] 5. 保留硬编码年份逻辑
- 年度与分类聚合外层应用：`CASE WHEN year=2023 THEN 0 ELSE total END`
- 月度与季度不变（不引入额外硬编码）
- _需求: 6

- [ ] 6. 性能观测与微调
- 观测 P95（目标 < 300ms）与数据库往返次数（≤ 3）
- 若不足：并行化聚合或进一步合并 SQL；必要时评估物化视图与 pg_cron 刷新
- _需求: 4

- [ ] 7. 测试与回归
- 单测：小数据集覆盖 period 合计、分类合计、2023 置 0、change 计算
- 集成：与 Dashboard 同口径对账
- 回归：确认 `expenseReportsEdgeFunctionService` 与页面渲染保持兼容
- _需求: 1, 2, 3, 4, 5, 6
