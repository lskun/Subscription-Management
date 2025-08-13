## Dashboard-analytics 边缘函数优化说明（当前版本）

### 目标
- 以“实际支付流水”为口径统计 Dashboard：
  - monthlySpending：当年当月支付总额（按支付日汇率换算至目标货币）
  - yearlySpending：当年支付总额（按支付日汇率换算至目标货币）
  - Spending by Category：当年实际支付按订阅分类聚合

### 当前实现概览
- 统一只查询“当前自然年”的支付记录（status='success'）。
- 预取汇率历史（CNY → 目标币种）+ 最新汇率作为兜底。
- 在内存中构建一次 (currency|date) → factor（换算因子）映射，供月度/年度/分类统计复用。
- 订阅类展示（近期支付/即将续费/分类标签）仍基于 `subscriptions` 表（RLS 已满足用户维度）。

### 请求与查询次数（典型情况）
- 鉴权（1 次）：
  - `auth.getUser()` 通过 Authorization 头获取当前用户。
- 数据查询（PostgREST）：
  1) 查询活跃订阅（1 次）
     - 表：`subscriptions`
     - 过滤：user_id = 当前用户, status = 'active'
  2) 查询当年支付记录（1 次）
     - 表：`payment_history`
     - 过滤：user_id = 当前用户, status = 'success', payment_date ∈ [当年1月1日, 今天]
     - 字段：id, subscription_id, amount_paid, currency, payment_date
  3) 预取汇率历史（0-1 次）
     - 表：`exchange_rate_history`
     - 过滤：from_currency = 'CNY', to_currency ∈ {当年支付出现的币种}, date ∈ [当年1月1日, 今天]
     - 说明：若当年只有基准币 CNY，可能跳过
  4) 获取最新汇率（2 次）
     - 第一次：在构建历史缓存时获取最新日期与该日所有对的汇率
       - 表：`exchange_rates`（取最新 date 1 次 + 根据 date 取汇率 1 次）
     - 第二次：用于订阅展示（即将续费/最近支付）再次获取
       - 表：`exchange_rates`（取最新 date 1 次 + 根据 date 取汇率 1 次）
  5) 分类所需订阅信息（0-1 次）
     - 表：`subscriptions`
     - 过滤：id ∈ 当年支付出现的 subscription_id

- 合计（常见场景）：
  - 订阅(1) + 支付(1) + 历史汇率(≤1) + 最新汇率(2) + 订阅分类(≤1)
  - 总 PostgREST 查询 ≈ 5～6 次（若币种/分类为空集合则相应减少）
  - 注：`auth.getUser()` 不计入数据库查询

### 计算流程（向量化与复用）
1) 从 `payment_history` 获取当年所有成功支付记录。
2) 构建汇率缓存：
   - 历史：CNY→各币种在时间窗内的降序列表
   - 兜底：最新日期的 CNY↔X 映射
3) 预计算换算因子 factorMap：
   - key = `${currency}|${payment_date}`
   - factor = (1 / rate(CNY→currency)) * rate(CNY→targetCurrency)
   - 历史缺口时回退到最新汇率（仅兜底）
4) 聚合：
   - yearlySpending：遍历全年支付，金额×factor 累加
   - monthlySpending：同上，但仅当月日期范围内累加
   - Spending by Category：
     - 取出现过的 subscription_id → 查询分类（`categories(value,label)`）
     - 按分类聚合已换算的支付金额与支付次数

### 复杂度与性能特征
- 数据拉取：O(Q)（Q 为上述查询次数，约 5～6）
- 因子构建：O(Nunique(currency,date)) ≤ O(NyearlyPayments)
- 聚合：O(NyearlyPayments)
- 二分查找成本已通过“向量化 + 一次性构因子”降至常数（用哈希表查 factor）

### 正确性与边界
- 口径：严格按“当前自然年”，当月=当年当月。
- 汇率：优先使用支付日历史汇率，历史缺口回退当日最新汇率（兜底）。
- 分类：以当年实际支付聚合到订阅分类（而非订阅年化预测）。

### 进一步优化建议（不改变统计口径）
- 查询层面：
  - 复用“最新汇率”：
    - 当前构建历史缓存与订阅展示各调用一次最新汇率，可复用第1次结果，减少 2 次查询。
  - 减少列：确保所有查询仅取需要字段。
  - 索引确认：
    - `payment_history(user_id, status, payment_date)`
    - `exchange_rate_history(from_currency, to_currency, date DESC)`
    - `subscriptions(id)`（主键）
- 计算层面：
  - 先聚合后换算：先按 (currency,date) 汇总当年支付再换算，可进一步减少换算与 factorMap 的键数。
  - 短期缓存：为同一用户短时间内的多次调用缓存 factorMap/最新汇率（例如 60s）。
- 演进方向（可选）：
  - 新增 RPC 在数据库侧一次性聚合（LATERAL + 历史汇率），进一步降低网络往返与边缘函数 CPU。

### 端到端耗时拆解（参考）
- 网络 RTT：调用函数 + PostgREST 往返
- 数据库：支付/汇率/订阅查询执行时间
- 计算：构建 factorMap 与内存聚合（线性）
- 优先优化顺序：复用最新汇率 → 降低查询次数 → 先聚合后换算 → 加索引


