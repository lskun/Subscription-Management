- docs(dashboard): 新增 `docs/Dashboard/DASHBOARD_ANALYTICS_OPTIMIZATION_DETAILS.md`
  - 记录当前 `dashboard-analytics` 优化实现细节：查询次数、向量化换算、分类聚合、索引建议与进一步优化方向。
## 2025-08-12

- feat(settings): 将 `Settings` → `ExchangeRateManager` 的“Update Exchange Rates”按钮改为调用 Edge Function
  - 文件：`src/components/ExchangeRateManager.tsx`
  - 变更：`handleUpdateRates` 不再走前端 `exchangeRateScheduler` → `supabaseExchangeRateService.batchUpdateRates`（会直写 `exchange_rate_update_logs` 触发 RLS），改为 `supabaseExchangeRateService.triggerExchangeRateUpdate('manual')`，通过 `supabaseGateway` 调用 `update-exchange-rates` Edge Function，由服务端使用 `service_role` 写日志。
  - 影响：解决 42501 RLS 报错（new row violates row-level security policy for table "exchange_rate_update_logs"）。

- chore(auth): 确认 403 全局处理路径已生效
  - 文件：`src/utils/supabase-gateway.ts`、`src/contexts/AuthContext.tsx`
  - 说明：`supabaseGateway` 收到 403 时会广播 `auth:forbidden`，`AuthContext` 监听并弹出“Permission denied”。无需改动代码。

- feat(dashboard): 将 Dashboard 月度/年度支出计算切换为“实际支付流水”口径
  - 文件：`supabase/functions/dashboard-analytics/index.ts`
  - 变更：采用方案B（预取历史汇率 + 内存二分检索）优化性能：
    1) 预拉取时间范围内 `exchange_rate_history`（CNY → 目标币种）并按日期降序缓存；
    2) 对每条支付用二分查找就近汇率，缺失回退到 `exchange_rates` 最新汇率；
    3) 拉取当月/当年 `payment_history(status='success')` 聚合生成 `monthlySpending`/`yearlySpending`；
    4) 保留订阅展示使用的最新汇率映射 `fetchLatestExchangeRatesMap`；
    5) 预测口径不再作为主展示。
  - 优化：合并原当月/当年两次查询为“仅查当年支付”，在内存聚合得到年度与当月数据；将“Spending by Category”改为按实际支付汇总到订阅分类（基于当年支付和订阅分类映射）。
  - 影响：Dashboard 的 `Monthly Spending`、`Yearly Spending` 现在与实际支付流水一致；预测指标不再用于主展示（仅文档保留说明）。

### 2025-08-12 (2)
- feat(core): 阶段一实施“全局 401 处理”网关
  - 新增 `src/utils/supabase-gateway.ts`：统一封装 Edge Function 与 RPC 调用；自动附带 JWT；401 时尝试刷新并重试一次；失败广播 `auth:unauthorized` 事件。
  - 调整 Edge Function 调用：
    - `src/services/dashboardEdgeFunctionService.ts` 改为使用 `supabaseGateway.invokeFunction`。
    - `src/services/expenseReportsEdgeFunctionService.ts` 改为使用 `supabaseGateway.invokeFunction`。
    - `src/services/subscriptionsEdgeFunctionService.ts` 改为使用 `supabaseGateway.invokeFunction`。

- chore(core): 移除未被使用的 `src/utils/api-client.ts`，避免与 `supabase-gateway` 职责重叠造成混淆。

### 2025-08-12 (3)
- feat(core): 阶段二开始——关键服务 RPC 接入统一网关（401 刷新重试）
  - 切换为 `supabaseGateway.rpc`：
    - `src/pages/AdminDashboardPage.tsx`（`get_system_stats`、`process_due_auto_renewals`，并将 Edge Function 回退改为 `invokeFunction`）。
    - `src/services/adminUserManagementService.ts`（`list_users`、`get_user_stats`）。
    - `src/services/userInitializationService.ts`（`initialize_current_user_data`）。
    - `src/services/monthlyCategorySummaryApi.ts`（`recalculate_monthly_summaries`、`process_payment_summary`）。
    - `src/services/notificationService.ts`（`cleanup_expired_notifications`）。

- feat(core): 阶段三开始——剩余函数/边缘调用接入统一网关
  - Edge Function 改为 `supabaseGateway.invokeFunction`：
    - `src/services/systemMonitorService.ts`（`database-metrics`）。
    - `src/services/exchangeRateApi.ts`（`update-exchange-rates`）。
    - `src/services/supabaseExchangeRateService.ts`（`update-exchange-rates`）。

- feat(auth): 在 `AuthContext` 添加全局 401 统一处理
  - 监听 `auth:unauthorized` 事件；收到后提示、调用 `SessionService.signOut('token_invalid')` 并跳转 `/login`。

- feat(core): 接入网关的遗留调用与 403 统一处理
  - 切换到 `supabaseGateway.invokeFunction`：
    - `src/store/settingsStore.ts#updateExchangeRatesFromApi`（`update-exchange-rates`）。
    - `src/services/emailNotificationService.ts#sendNotification`（`send-notification-email`）。
  - `src/utils/supabase-gateway.ts`：新增 403 识别并广播 `auth:forbidden`；`AuthContext` 统一提示“Permission denied”。

- fix(admin): 非管理员点击“管理员登录”无反应
  - 修改 `src/components/admin/AdminGuard.tsx`：按钮改为 `navigate('/admin/login')` 明确跳转登录页；`useAdminAuth.login` 保留为后向兼容。

- fix(admin/users): 用户列表昵称仅显示一个名称（优先 `display_name || full_name`）
  - 修改 `src/components/admin/UserManagement.tsx` 渲染逻辑，避免重复显示两行昵称。
- feat(admin/users): 新增用户列表 RPC 并前端切换至 RPC 调用
  - 新建 `admin.list_users(page, limit, search, status)` 与 `public.list_users(...)`，在 DB 端支持搜索/筛选/分页，并校验 `super_admin`，绕过 RLS。
  - 修改 `src/services/adminUserManagementService.ts#getUserList`，改为调用 `supabase.rpc('list_users', {...})`。
- feat(admin): 新增基于 `admin_users`/`admin_roles` 的超级管理员统计 RPC
  - 创建 `admin.get_system_stats()`（SECURITY DEFINER），仅 `super_admin` 可用；提供 `public.get_system_stats()` 包装并授予 `authenticated` 执行以便前端调用（RPC 内部做权限校验）。
  - 修改 `src/pages/AdminDashboardPage.tsx`，`loadSystemStats` 改为调用 `supabase.rpc('get_system_stats')`，绕过 RLS 获取真实总用户/活跃用户/订阅数。

- fix(admin/users): 用户管理页统计使用 RPC 绕过 RLS
  - 新增 `admin.get_user_stats()` 与 `public.get_user_stats()`；校验 `super_admin`，返回总用户、30日活跃、本月新增、暂停用户数。
  - 修改 `src/services/adminUserManagementService.ts#getUserStatistics` 调用 `supabase.rpc('get_user_stats')` 以获取真实统计。

- chore(db): 将 `get_user_stats` 定义落盘为 `supabase/db_functions/get_user_stats.sql` 以便版本管理。
- 2025-08-08: 新增 `docs/DOMAIN_ARCHITECTURE_GUIDE.md`（按功能域的精简架构图与说明）。
- 2025-08-08: 文档归档至域子目录：创建 `docs/Dashboard|Reports|Subscriptions|Settings|Admin` 并移动对应文档；更新 `docs/DOMAIN_INDEX.md` 链接路径。
- 2025-08-08: 进一步分类：创建 `docs/Platform/{API,Database,Migration,EdgeFunctions,Cache,Architecture}` 与 `docs/Project`，移动根目录文档至对应子目录；同步更新 `docs/DOMAIN_INDEX.md`。
- 2025-08-08: 更新 `docs/Platform/Architecture/BACKEND_ARCHITECTURE.md` 为 Supabase 架构版，移除旧的 Express/SQLite 描述，与当前数据库与运行架构一致。
- 2025-08-08: 生成数据库 Schema 快照 `docs/Platform/Database/DATABASE_SCHEMA_SNAPSHOT.md`，并更新 `docs/DOMAIN_INDEX.md`。
- 2025-08-08: 新增自动续费规范文档 `specs/subscription_auto_renewal/{requirements.md,design.md,tasks.md}`（EARS/ERAS需求、技术方案、任务清单）。
- 2025-08-08: 修复 `supabase/db_functions/process_subscription_renewal.sql`：增加 `SELECT ... FOR UPDATE` 行锁，`payment_history.status` 更正为 `'success'`，以满足表约束并防止并发重复扣款。
- 2025-08-08: 新增 Edge Function `supabase/functions/auto-renew-subscriptions/`（批量查询到期订阅并调用 RPC 续费，支持 limit 参数）。
- 2025-08-08: 新增 `supabase/db_functions/process_due_auto_renewals.sql`（DB 内批处理，FOR UPDATE SKIP LOCKED 批量续费，统计处理量并记录错误到 `system_logs`）。

### 2025-08-12
- feat(admin): 在 `src/pages/AdminDashboardPage.tsx` 的系统设置页“系统运行选项”新增“手动触发自动续费”按钮。
  - 优先调用 DB 内部批处理函数 `process_due_auto_renewals(p_limit:=200)`；若失败自动回退调用 Edge Function `auto-renew-subscriptions`。
  - 加入按钮执行状态与权限校验（需 `manage_system`）。
  - 触发结果写入管理员操作日志（`auto_renewal_manual_trigger` / `auto_renewal_manual_trigger_error`）。

- chore(db): 新增 `supabase/db_functions/process_due_auto_renewals_wrapper.sql`，提供 `public.process_due_auto_renewals(limit)` 的 RPC 包装，以允许前端以 `authenticated` 身份调用 DB 内部批处理函数（生产方案），并授予 `authenticated`/`service_role` 执行权限。

- docs(subscriptions): 新增 `docs/Subscriptions/AUTO_RENEWAL_TECHNICAL_GUIDE.md`，整理自动续费生产方案、前端触发、运维排查与回滚说明。
- chore(specs): 勾选 `specs/subscription_auto_renewal/tasks.md` 第4步（前端与文档）。

- fix(db): 修复 `public.process_subscription_renewal` 仍插入 `payment_history.status='succeeded'` 导致违背检查约束 `payment_history_status_check` 的问题；同时补上 `FOR UPDATE` 行锁以避免并发。
  - 通过迁移 `015_fix_process_subscription_renewal_status_and_lock` 将状态统一为 `'success'`。
  - 复测：`select public.process_due_auto_renewals(10);` 由 `{"errors":3,"processed":0}` 修复为 `{"errors":0,"processed":3}`。

- test(auto-renewal): 新增与完善测试
  - 新增 `src/lib/__tests__/auto-renewal.test.ts` 覆盖新订阅/既有订阅的 next 计算与到期判定。
  - 放宽 `subscription-utils.test.ts` 中对 reason 的断言，避免中文文案导致的不稳定。
  - 新增 `scripts/verify-auto-renew-batch.ts` 轻量集成验证脚本（RPC 触发批处理）。
  - 更新 `package.json`：添加 `test:auto-renew` 与 `verify:auto-renew-batch` 脚本。
  - 勾选 `specs/subscription_auto_renewal/tasks.md` 第5步（测试）。

### 2025-08-12 (4)
- fix(dashboard-analytics): 修复 PostgREST 聚合写法导致的分类聚合报错与统计为 0 的问题
  - 文件：`supabase/functions/dashboard-analytics/index.ts`
  - 变更：将 `sum(amount_paid)` 改为 `total_amount:amount_paid.sum`（使用明确别名），避免 PostgREST 解析错误；相应地将读取字段从 `amount_paid_sum` 改为 `total_amount`。
  - 影响：解决控制台错误 "failed to parse select parameter" 和 "Could not find a relationship between 'payment_history' and 'sum'"，Dashboard 的 `Monthly Spending`、`Yearly Spending`、`Spending by Category` 将正确取到聚合值。

- docs(dashboard): 更新 `docs/Dashboard/DASHBOARD_ANALYTICS_OPTIMIZATION_v2.md` —— 统一采用“最新汇率”换算口径
  - 变更：
    1) 将 RPC 函数重写为在 SQL 层使用 `exchange_rates` 的最新日期进行换算；
    2) 移除对 `get_or_refresh_rate_map` 的依赖，改为内联最新汇率查询；
    3) 补充 FROM→CNY→TARGET 的中转逻辑（当不存在直达汇率时）；
    4) 将函数签名改为 `(target_currency text, upcoming_days int, recent_days int)` 且使用 `auth.uid()` 获取用户；
    5) 修正 `payment_history.status` 为 `'success'`；
    6) 更新 Edge Function 示例调用参数为 `target_currency/upcoming_days/recent_days`。
  - 影响：实现更简单、稳定且高性能的统一汇率口径；避免历史汇率复杂度与潜在性能损耗。

- feat(edge): 精简 `supabase/functions/dashboard-analytics/index.ts` 为“单次 RPC 调用”实现
  - 变更：移除所有本地数据拉取与历史汇率二分/聚合逻辑，仅保留认证、参数解析与 `rpc('get_dashboard_analytics', {...})` 调用；
  - 类型：引入 `jsr:@supabase/functions-js/edge-runtime.d.ts` 并声明 `Deno` 以通过本地 Lint；
  - 影响：边缘运行时 CPU/内存与网络传输显著下降，响应时间预期下降至 150ms-500ms（取决于数据量与网络）。

- refactor(dashboard): 刷新按钮仅触发 Edge Function，移除多余 REST 请求依赖
  - 文件：`src/pages/HomePage.tsx`
  - 变更：`Refresh Data` 按钮仅调用 `useDashboardData().refreshData()`，不再调用 `initializeWithRenewals()`（避免并发请求 `subscriptions/categories/payment_methods`）。
  - 文件：`src/components/dashboard/CategoryBreakdown.tsx`
  - 变更：组件支持直接接收 `items[{ category,label,amount }]`；`HomePage` 直接传入 Edge Function 返回的分类明细，减少对 `categories` 额外请求的依赖。
  - 影响：Dashboard 刷新时仅一次 Edge Function 调用 + 本地渲染，避免不必要的 PostgREST 请求。

- chore(settings): 将自动获取汇率改为懒加载
  - 文件：`src/store/settingsStore.ts`
  - 变更：移除 `fetchSettings` 内部对 `fetchExchangeRates` 的自动调用；新增 `fetchExchangeRatesIfNeeded()`，在缺失或过期（默认 6 小时）时按需拉取最新汇率。
  - 影响：进入 `/dashboard` 不会再产生 `exchange_rates` 的两次 REST 请求，除非其他页面或功能显式需要。

### 2025-08-12 (5)
- docs(settings): 新增《SERVER_SIDE_SCHEDULER_REFACTOR.md》至 `docs/Settings/`
  - 内容：将 Settings > Currency > Scheduler 重构为“统一服务端定时”（默认每日 02:00，`0 2 * * *`），采用 pg_cron + pg_net + Edge Function；
  - 通用化：新增通用调度配置/运行日志表设计（`scheduler_jobs`/`scheduler_job_runs`）与管理 RPC（start/stop/update/status），可扩展用于其他调度任务；
  - 前端改造建议：移除前端本地定时器依赖，UI 改为读写服务端状态与 RPC；保留手动触发与清理入口；
  - 脚本：提供启用/停用示例脚本草案，说明密钥与安全注意事项；
  - 说明：本次为文档变更，不涉及源码修改。

### 2025-08-12 (6)
- db(scheduler): 依据《SERVER_SIDE_SCHEDULER_REFACTOR.md》实施首批数据库对象（pg_cron+pg_net）
  - 新增扩展：`pg_cron`、`pg_net`
  - 新增受限存储：`admin.secrets(name,value,updated_at)`；已写入 `project_url`
  - 新增通用表：`public.scheduler_jobs`、`public.scheduler_job_runs`
  - 新增 RPC：`public.scheduler_start/stop/update/status`（SECURITY DEFINER）
  - 新增内部函数：`public.scheduler_invoke_edge_function(p_job_name)`（调用 Functions `update-exchange-rates`）
  - 初始化作业：`exchange_rates_update`（默认 cron `0 2 * * *`、时区 `Asia/Shanghai`）并已启用；当前 `last_run_at` 已记录一次“请求已提交（request_id）”
  - 注意：需要在 `admin.secrets` 注入真实 `service_role_key` 以便调度使用服务端凭证调用 Edge Function（目前为占位符）

- edge(update-exchange-rates): 部署/对齐
  - 部署 `update-exchange-rates`（version=9，verify_jwt=true）
  - 说明：当前调度使用 HTTP `Authorization: Bearer <service_role_key>` 调用；待注入真实密钥后可稳定执行

> 本次仅数据库与函数/Edge 部署，不涉及前端源码改动；后续将按计划改造 `Settings > Currency > Scheduler` UI 与调用链。

### 2025-08-12 (7)
- ops(scheduler): 注入真实 Service Role Key 并完成一次手动调度验证
  - `admin.secrets['service_role_key']` 已写入真实值；移除 `anon_key`，不保留匿名密钥调用路径
  - 使用 `scheduler_invoke_edge_function('exchange_rates_update')` 触发一次执行
  - `scheduler_status('exchange_rates_update')`：`is_enabled=true`、`cron_spec='0 2 * * *'`、`last_status='success'`、`failed_attempts=0`
  - 最近 `exchange_rate_update_logs`：存在 `manual/success` 记录（Edge 手动触发成功）
  - 说明：若需服务端按日抓取外部汇率，请在 Edge 环境配置 `TIANAPI_KEY`；否则会记录失败日志

### 2025-08-12 (8)
- feat(edge): `update-exchange-rates` 按“统一服务端定时”进行必要改造并重新部署（v10）
  - 并发保护：在任务开始前检查 `exchange_rate_update_logs(status='partial')`，若存在进行中任务则直接失败，避免重入
  - 日志一致性：开始记录 `partial`，完成后更新为 `success/failed`，保留 `rates_updated/error_message`
  - 权威状态：`action=status` 改为调用 `rpc('scheduler_status', { p_job_name:'exchange_rates_update' })`，返回服务端统一状态
  - 权限约束：`updateType==='scheduled'` 必须由 `service_role` 令牌触发（verify_jwt=true），否则 403
  - 其他：保持抓取/重试/写库逻辑不变；返回体结构更一致
  - 注意：需要在 Edge 环境变量配置 `TIANAPI_KEY`，否则 `update` 会返回失败并写失败日志

### 2025-08-12 (9)
- refactor(frontend): `Settings > Currency > Scheduler` UI 接入服务端统一调度
  - 文件：`src/components/ExchangeRateManager.tsx`
  - 关键编辑（含中文注释）：
    - 替换前端本地调度状态为服务端 RPC 状态：`scheduler_status('exchange_rates_update')`
    - 启停改为调用 `scheduler_start/stop`，默认 cron `0 2 * * *`（每日 02:00，24 小时）
    - 展示字段：`is_enabled/cron_spec/timezone/last_run_at/next_run_at/failed_attempts/last_status`
    - 文案：改为“Server-side scheduler (pg_cron + Edge Function)”
  - 未改动“Update Now / Cleanup”逻辑：保持现有 Edge Function 调用与数据刷新
 
### 2025-08-13
- fix(ui/toast): 保存 Preferences 时未出现提示
  - 原因：页面各处使用 `import { toast } from 'sonner'`，但根组件未挂载 Sonner 的 `<Toaster />`
  - 修改：在 `src/App.tsx` 中新增 `import { Toaster as SonnerToaster } from 'sonner'` 并挂载 `<SonnerToaster richColors closeButton />`
  - 兼容：保留现有 `components/ui/toaster`（shadcn）以兼容旧的 `useToast` 路径

- chore(settings/ui): 临时下线 Preferences 页面中的 Privacy 模块
  - 文件：`src/components/user/UserPreferencesForm.tsx`
  - 处理：将 Privacy 卡片整体以 JSX 条件块包裹 `{false && (...)}` 并添加中文注释说明
  - 说明：待后端字段与权限策略确定后再恢复；避免产生无效或不一致的写入

- fix(settings/preferences): 读取偏好从聚合键切换为分拆键，修复 theme 显示与 DB 不一致
  - 文件：`src/services/userProfileService.ts`
  - 调整：`getUserPreferences` 改为一次性读取 `user_settings` 中 `theme/currency/notifications/privacy` 等分拆键，并兼容历史 `preferences` 聚合键与 `{ value: ... }` 包裹结构
  - 影响：当 DB 中 `theme='light'` 时，前端不再被默认值 `system` 覆盖，展示与数据库保持一致

- feat(settings): Default Currency 与 Show in original currency 更新时弹出提示并刷新缓存
  - 文件：`src/store/settingsStore.ts`
  - 变更：在 `setCurrency` 与 `setShowOriginalCurrency` 成功后使用 `sonner.toast.success` 提示；同步更新 `userSettingsCache` 与时间戳，清理 `userSettings` 类型的全局缓存；失败时 `toast.error`
  - 影响：交互反馈更清晰，状态更快与后端一致，避免等待下一次完整拉取
