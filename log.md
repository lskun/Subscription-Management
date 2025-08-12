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
