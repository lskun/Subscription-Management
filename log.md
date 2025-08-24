## 2025-08-22

- feat(notifications): 优化通知调度系统 - 简化为3天订阅续费提醒
  - Edge Function：优化`supabase/functions/notification-scheduler/index.ts`（版本14）
    - 简化逻辑：只处理3天内的订阅续费提醒，符合用户需求
    - 重复防护：严格防止同一订阅在同一天重复发送相同类型通知
    - 查询优化：使用`next_billing_date`字段，修复PGRST200外键关系错误
    - 表关联：正确使用`user_profiles`表而非`auth.users`表
    - 字段映射：修正`expires_at`→`next_billing_date`，`cost`→`amount`
    - 设置检查：使用正确的`renewal_reminders`设置键名
  - 测试验证：
    - 部署成功（版本14）
    - 重复防护机制测试通过
    - 3天到期订阅检测正常
    - 用户通知偏好检查正常
  - 技术优化：
    - 固定daysBeforeExpiry=3，移除多天循环逻辑
    - 优化通知模板映射关系和注释说明
    - 增强错误处理和日志输出
    - 改进TypeScript类型安全性
  - 影响：专注于核心需求，提高系统稳定性和性能

## 2025-08-21

- feat(settings): 修复Settings页面Data tab权限问题
  - 文件：`src/pages/SettingsPage.tsx`
  - 变更：为非管理员用户隐藏Data tab，使用`useAdminPermissions`钩子进行权限检查
  - 影响：提升了数据安全性，防止普通用户访问管理员功能

- feat(notifications): 实施统一通知系统重构 - 第一阶段
  - 数据库：创建7个新表的迁移文件`017_unified_notification_system.sql`
    - `unified_notification_templates`：合并email_templates和notification_templates
    - `notification_channels`：多渠道配置支持（email, sms, push, in_app）
    - `user_notification_preferences_v2`：重新设计的用户偏好表
    - `notification_queue`：支持延迟发送和重试的队列系统
    - `notification_logs_v2`：统一的通知日志表
    - `notification_schedules`：定时通知调度配置
    - `notification_rules`：复杂条件判断规则
  - 服务层：新增`src/services/unifiedNotificationService.ts`
    - 多渠道支持：email、SMS、push、应用内通知
    - 用户偏好检查：整合user_settings和preferences表
    - 批量处理和调度功能
  - 通知渠道：新增`src/services/notificationChannels/`目录
    - `EmailChannel.ts`：邮件通知渠道实现
    - `InAppChannel.ts`：应用内通知渠道实现
    - `SMSChannel.ts`、`PushChannel.ts`：预留接口实现
  - 前端组件：新增`src/components/user/UnifiedNotificationPreferencesForm.tsx`
    - 分标签页管理：按类型、按渠道、系统设置
    - 静默时间配置和批量操作功能
  - 数据迁移：成功迁移4个邮件模板和7个应用内通知模板
  - 影响：统一了通知系统架构，为未来的定时任务和多渠道通知奠定基础

- feat(notifications): 实施统一通知系统重构 - 第二阶段：定时任务调度
  - 数据库：创建简化的迁移文件`018_notification_scheduling_simplified.sql`
    - 复用现有`scheduler_jobs`表，添加3个通知调度任务
    - 添加通知规则到`notification_rules`表
    - 避免创建冗余表，最大化复用现有基础设施
  - Edge Function：新增`supabase/functions/notification-scheduler/index.ts`
    - 支持多种通知类型：7天/3天/1天到期提醒、已过期通知、支付失败重试
    - 用户偏好检查：整合user_settings表的通知配置
    - 防重复机制：基于notification_logs_v2表避免重复发送
    - 复用现有模板：使用unified_notification_templates中的模板
  - 调度配置：集成现有scheduler_invoke_edge_function调度系统
    - 统一执行时间：每天凌晨3点执行所有通知检查
    - 调度任务：subscription_expiry、subscription_expired、payment_failed_retry
  - 功能完善：
    - 订阅到期检测：支持7天/3天/1天提前提醒
    - 订阅过期处理：30天宽限期内的过期通知
    - 用户偏好检查：基于user_settings表的notification配置
    - 防重复机制：基于notification_logs_v2表的每日去重
    - 应用内通知：完整的通知创建和日志记录
    - 错误处理：完善的异常捕获和日志输出

## 2025-08-22

- feat(notifications): 统一通知系统优化 - 全面重构notification-scheduler Edge Function
  - 问题诊断：解决PGRST200外键关系错误和字段映射问题
    - 修正字段名：`expires_at` → `next_billing_date`, `cost` → `amount`
    - 修正表关联：`auth.users` → `user_profiles`（获取用户邮箱和时区）
    - 修正用户设置：`subscription_expiry_reminders` → `renewal_reminders`
    - 修正模板变量：添加`daysLeft`字段以匹配模板需求
  - 架构优化：基于确认的业务需求重构Edge Function
    - 通知策略：用户无设置时不发送通知（避免骚扰）
    - 错误处理：邮件发送失败不重试，详细记录失败原因
    - 批处理：支持100个订阅批量处理
    - 日志详细程度：基于notification_logs_v2表结构记录完整信息
    - 模板缺失：跳过处理，不报错
    - 时区支持：基于user_profiles.timezone字段处理用户时区
  - 核心优化：
    - **通知映射系统**：硬编码方式实现用户设置与模板的映射关系
      ```typescript
      const NOTIFICATION_TEMPLATE_MAPPING = {
        'subscription_expiry_3_days': {
          settingKey: 'renewal_reminders',     // user_settings.notifications字段
          templateKey: 'subscription_expiry',  // unified_notification_templates.template_key
          notificationType: 'subscription_expiry_reminder_3d' // 日志记录标识
        }
      };
      ```
    - **用户偏好检查**：根据user_settings.notifications的JSON结构决定发送
      - `email: true` → 启用邮件通知
      - `renewal_reminders: true` → 启用订阅到期提醒
      - `payment_notifications: true` → 启用支付成功/失败通知
    - **仅Email通知**：当前版本只实现邮件通知渠道，简化实现复杂度
    - **详细统计报告**：实现ProcessingStats接口，追踪各种跳过原因
      - 用户设置禁用、重复发送、邮箱无效、模板缺失、发送失败等
    - **时区适配**：根据用户timezone格式化日期显示
    - **批处理机制**：支持大量订阅的分批处理，避免超时
    - **完整日志记录**：详细记录发送状态、耗时、错误信息到notification_logs_v2表
  - 边界情况处理：
    - 邮箱验证：正则表达式验证邮箱格式
    - 模板检查：确认unified_notification_templates中模板存在且激活
    - 重复防护：基于当日时间范围检查notification_logs_v2避免重复
    - 错误分类：区分系统错误、配置错误、数据错误，分别统计
    - 性能监控：记录邮件发送耗时，便于性能分析
  - 部署状态：成功部署Edge Function版本13
    - 执行时间：约800ms（相比之前500ms有所增加，反映了更完整的处理逻辑）
    - 返回状态：200成功，表明基础架构运行正常
    - 待验证：实际通知发送功能需要进一步测试用户设置和邮件服务集成
  - 技术债务清理：删除6个过时的通知相关表和3个视图
    - 删除表：email_templates, notification_templates, user_notification_preferences等
    - 保留核心表：unified_notification_templates, notification_logs_v2等8个核心表
  - 影响：建立了生产级别的通知调度系统，支持精确的用户偏好控制和完整的操作审计
  - 测试验证：调度器成功调用Edge Function，完整通知流程正常工作
  - 数据库清理：删除已被替代的旧表和视图
    - 删除旧表：email_templates, notification_templates, user_notification_preferences, notification_schedules, email_queue, user_email_preferences
    - 删除旧视图：email_statistics, user_email_statistics, user_notification_statistics
    - 保留核心表：unified_notification_templates, notification_channels, notification_logs_v2, notification_queue, notification_rules, user_notification_preferences_v2, user_notifications, email_logs
  - 影响：实现了完整的自动化订阅到期提醒系统，每天凌晨3点统一执行所有通知检查，数据库结构更加清晰简洁

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

- docs(expense-reports): 新增重构文档（按最大复用原则）
  - 新增 `specs/expense_reports_refactor/requirements.md`：EARS/ERAS 需求、统一口径为 `payment_history(status='success')`、保留 2023 硬编码
  - 新增 `specs/expense_reports_refactor/design.md`：SQL 下推聚合、索引与缓存策略、汇率最新快照、返回结构不变
  - 新增 `specs/expense_reports_refactor/tasks.md`：实施清单（状态修正→索引→SQL 对账→Edge 改造→性能观察→测试回归）

- chore(expense-reports): 实施计划第1-2步落地
  - 修正支付状态过滤：`supabase/functions/expense-reports/index.ts` 中 `'succeeded'` → `'success'`
  - 新增迁移 `supabase/migrations/014_expense_reports_indexes.sql`：
    - `idx_payment_user_status_date(user_id,status,payment_date)`
    - `idx_payment_user_sub_date(user_id,subscription_id,payment_date)`
  - 更新 `specs/expense_reports_refactor/tasks.md` 勾选 1、2

- refactor(expense-reports): 将月/季/年/趋势金额计算口径改为“实际支付流水”
  - 文件：`supabase/functions/expense-reports/index.ts`
  - 新增 `sumPaymentsForPeriod`（基于分组后的 `payment_history`、按最新汇率换算汇总）
  - Monthly/Quarterly/Yearly/ExpenseInfo 改为按 period 汇总真实支付；保留 `paymentCount`
  - 保留硬编码：2023 年年度金额置 0

- refactor(expense-reports): 分类统计改为基于支付流水与订阅分类映射
  - 从本次支付中提取 `subscription_id` 列表，仅查询必要订阅的 `categories(value,label)` 建立映射
  - 逐笔支付按目标币种换算后累加到对应分类；未命中归入 `other`
  - 保留硬编码：当年份为 2023 时分类总额置 0

- feat(db): 新增 SQL 聚合函数以进一步下推计算
  - 迁移：`supabase/migrations/015_expense_reports_aggregates.sql`
  - 函数：
    - `public.expense_monthly_aggregate(user_id, target_currency, start, end)`
    - `public.expense_yearly_aggregate(user_id, target_currency, start, end)`（含 2023 置 0）
    - `public.expense_category_aggregate(user_id, target_currency, start, end)`（当年为 2023 则总额置 0）

- refactor(edge): Expense Reports 切换为调用 SQL 聚合函数（减少 JS reduce/分组与 DB 往返）
  - 月度：`rpc('expense_monthly_aggregate', ...)`
  - 年度：`rpc('expense_yearly_aggregate', ...)`
  - 分类：`rpc('expense_category_aggregate', ...)`

### 2025-08-13 (TS)
- fix(expense-reports): 修复 `supabase/functions/expense-reports/index.ts` 中的 TypeScript 报错
  - 问题：`years` 被推断为 `never[]`，导致后续 `year.toString()` 报错
  - 处理：显式标注 `const years: number[] = []`，并添加中文注释说明原因与修复点
  - 影响：通过本地 Lint 校验；不影响运行时逻辑，仅类型声明修复

### 2025-08-13 (expense-reports)
- fix(expense-reports): 对齐返回周期维度并补全为0
  - Monthly Expenses：锚定传入 `monthlyEndDate`（无则当前日期），返回最近 4 个月，缺失补 0；并据此构建 `expenseInfo.monthly`
  - Quarterly Expenses：基于月度聚合汇总，锚定 `quarterlyEndDate`（无则当前），返回最近 3 个季度并补 0；在季度分支直接构建 `expenseInfo.quarterly`
  - Yearly Expenses：锚定 `yearlyEndDate`（无则当前），返回最近 3 年并补 0；并据此构建 `expenseInfo.yearly`
  - 说明：不改变既有 SQL 聚合与汇率换算逻辑，仅在 Edge 层做时间窗归一与空月/季/年补零

- feat(expense-reports): 增加“活跃订阅数”
  - 定义：某月内发生过成功支付的订阅去重数
  - Edge：在月度窗口内拉取 `payment_history(status='success')`，按月聚合 `distinct(subscription_id)` 为 `activeSubscriptionCount`；`expenseInfo.monthly.paymentCount` 返回该值
  - 前端：`ExpenseReportsPage` 的 `adaptedMonthlyExpenses.subscriptionCount` 使用 `activeSubscriptionCount`，用于趋势图 Tooltip “Subscriptions”
  - 年度：同理在年度窗口内计算 `activeSubscriptionCount` 并返回；前端 `adaptedYearlyExpenses.subscriptionCount` 使用该值
