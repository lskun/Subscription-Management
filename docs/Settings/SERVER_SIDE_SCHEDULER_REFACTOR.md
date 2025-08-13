# 设置页汇率 Scheduler 统一服务端定时重构方案（24 小时，pg_cron + pg_net + Edge Function）

## 目标与范围

- 将 `Settings > Currency > Scheduler` 从“前端本地定时器（浏览器内存 setInterval）”切换为“统一服务端调度（单一事实源）”。
- 调度频率默认“每 24 小时执行一次”，建议在 `Asia/Shanghai` 时区的 02:00（`0 2 * * *`）。
- 采用首选方案：`pg_cron + pg_net + Edge Function`。
- 支持在前端 UI 启停、修改频率、查看状态、手动触发、清理历史、查看日志。
- 将调度配置表抽象为“通用调度器配置表”，可管理多类任务（汇率更新、自动续费、报表预计算等）。

---

## 架构设计

- 数据库层统一调度：`pg_cron` 触发调用数据库 `RPC`，`RPC` 内使用 `pg_net.http_post` 调用 Edge Function 执行任务。
- Edge Function 负责：
  - 拉取外部汇率并批量 upsert；
  - 写入业务明细日志 `exchange_rate_update_logs`；
  - 按需清理历史（action=cleanup）；
  - 提供服务端状态查询（action=status）。
- 通用调度模型：
  - `scheduler_jobs`（调度作业配置）
  - `scheduler_job_runs`（通用运行日志）
  - 一组 `RPC`：`scheduler_start/stop/update/status` 与 `scheduler_invoke_edge_function`（内部调用）。

默认频率：`0 2 * * *`（每日凌晨 2 点）；可在 UI 调整为任意 cron。

---

## 数据库设计（DDL 与权限）

> 注意：以下 SQL 为实施参考模板，实际迁移请根据项目命名空间（schema）、权限模型微调。

```sql
-- 1) 依赖扩展（如未安装）
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) 通用调度作业表（配置）
create table if not exists public.scheduler_jobs (
  id                uuid primary key default gen_random_uuid(),
  job_name          text not null unique,
  job_type          text not null check (job_type in ('edge_function','rpc','http_post')),
  cron_spec         text not null,                 -- 例如 '0 2 * * *'
  timezone          text not null default 'Asia/Shanghai',
  is_enabled        boolean not null default false,
  pg_cron_job_id    int,                           -- 对应 cron.job.jobid
  payload           jsonb,                         -- 执行参数，如 { function: 'update-exchange-rates', body: { updateType:'scheduled' } }
  headers           jsonb,                         -- 仅 http_post/edge_function时使用
  last_run_at       timestamptz,
  next_run_at       timestamptz,
  last_status       text check (last_status in ('success','failed','partial') or last_status is null),
  failed_attempts   int not null default 0,
  max_retries       int not null default 3,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_scheduler_jobs_enabled on public.scheduler_jobs(is_enabled);
create index if not exists idx_scheduler_jobs_name on public.scheduler_jobs(job_name);

-- 3) 通用调度运行日志表
create table if not exists public.scheduler_job_runs (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.scheduler_jobs(id) on delete cascade,
  status         text not null check (status in ('success','failed','partial')),
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  result         jsonb,
  error_message  text
);

create index if not exists idx_scheduler_job_runs_job_id on public.scheduler_job_runs(job_id);
create index if not exists idx_scheduler_job_runs_started_at on public.scheduler_job_runs(started_at desc);

-- 4)（可选）管理员密钥存储，仅 SECURITY DEFINER 函数可读
--    推荐将 service role 或内部令牌保存在受限表/受限 schema。
create schema if not exists admin;
create table if not exists admin.secrets (
  name  text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- 仅超级管理员可写；普通用户无权访问
revoke all on admin.secrets from public;

-- 5) 内部调用：通过 pg_net.http_post 调用 Edge Function
-- SECURITY DEFINER：以函数所有者权限执行，确保可读取 admin.secrets
create or replace function public.scheduler_invoke_edge_function(p_job_name text)
returns void
language plpgsql
security definer
set search_path = public, admin
as $$
declare
  v_job        public.scheduler_jobs;
  v_fn         text;
  v_body       jsonb;
  v_headers    jsonb;
  v_resp       jsonb;
  v_run_id     uuid;
  v_service_jwt text;
begin
  select * into v_job from public.scheduler_jobs where job_name = p_job_name;
  if not found then
    raise exception 'scheduler job % not found', p_job_name;
  end if;

  -- 运行日志：开始
  insert into public.scheduler_job_runs(job_id, status)
  values (v_job.id, 'partial')
  returning id into v_run_id;

  if v_job.job_type <> 'edge_function' then
    raise exception 'unsupported job_type: %', v_job.job_type;
  end if;

  v_fn := coalesce((v_job.payload->>'function'), 'update-exchange-rates');
  v_body := coalesce(v_job.payload->'body', jsonb_build_object('updateType','scheduled'));

  -- 从受限表读取 service role（或内部专用 Token）。实际项目请替换为更安全的来源（如 KMS/Vault）。
  select value into v_service_jwt from admin.secrets where name = 'service_role_key';
  if v_service_jwt is null then
    raise exception 'service_role_key not configured in admin.secrets';
  end if;

  v_headers := jsonb_build_object(
    'Authorization', 'Bearer '||v_service_jwt,
    'Content-Type', 'application/json'
  );

  -- 注意：以下 URL 需替换为你的项目 Functions URL（可从 VITE_SUPABASE_URL 推导或直接写死项目 URL）。
  -- 例如：https://<project-ref>.functions.supabase.co/<function>
  select net.http_post(
           url := format('https://%s.functions.supabase.co/%s', current_setting('app.supabase_project_ref', true), v_fn),
           headers := v_headers,
           body := v_body
         )::jsonb
    into v_resp;

  update public.scheduler_job_runs
     set status = 'success',
         completed_at = now(),
         result = v_resp
   where id = v_run_id;

  update public.scheduler_jobs
     set last_run_at = now(),
         last_status = 'success',
         failed_attempts = 0,
         updated_at = now()
   where id = v_job.id;
exception when others then
  update public.scheduler_job_runs
     set status = 'failed',
         completed_at = now(),
         error_message = sqlerrm
   where id = v_run_id;

  update public.scheduler_jobs
     set last_run_at = now(),
         last_status = 'failed',
         failed_attempts = coalesce(failed_attempts,0) + 1,
         updated_at = now()
   where id = v_job.id;

  raise;
end;
$$;

-- 6) 管理 RPC：start/stop/update/status
-- 这些函数应仅管理员可执行（可通过自有 admin 校验或基于角色的权限控制）。

create or replace function public.scheduler_status(p_job_name text)
returns table(
  job_name text,
  job_type text,
  cron_spec text,
  timezone text,
  is_enabled boolean,
  pg_cron_job_id int,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_status text,
  failed_attempts int
)
language sql
security definer
as $$
  select job_name, job_type, cron_spec, timezone, is_enabled, pg_cron_job_id,
         last_run_at, next_run_at, last_status, failed_attempts
    from public.scheduler_jobs
   where job_name = p_job_name;
$$;

create or replace function public.scheduler_start(p_job_name text, p_cron text, p_timezone text, p_payload jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.scheduler_jobs;
  v_jobid int;
begin
  select * into v_job from public.scheduler_jobs where job_name = p_job_name;
  if not found then
    insert into public.scheduler_jobs(job_name, job_type, cron_spec, timezone, is_enabled, payload)
    values (p_job_name, 'edge_function', p_cron, p_timezone, false, p_payload)
    returning * into v_job;
  end if;

  -- 创建 cron 作业，调用内部 RPC
  select cron.schedule(
           p_job_name,
           p_cron,
           format('select public.scheduler_invoke_edge_function(''%s'');', p_job_name)
         ) into v_jobid;

  update public.scheduler_jobs
     set is_enabled = true,
         cron_spec = p_cron,
         timezone = p_timezone,
         pg_cron_job_id = v_jobid,
         payload = coalesce(p_payload, payload),
         updated_at = now()
   where id = v_job.id;
end;
$$;

create or replace function public.scheduler_stop(p_job_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.scheduler_jobs;
begin
  select * into v_job from public.scheduler_jobs where job_name = p_job_name;
  if not found then return; end if;

  if v_job.pg_cron_job_id is not null then
    perform cron.unschedule(v_job.pg_cron_job_id);
  end if;

  update public.scheduler_jobs
     set is_enabled = false,
         pg_cron_job_id = null,
         updated_at = now()
   where id = v_job.id;
end;
$$;

create or replace function public.scheduler_update(p_job_name text, p_cron text, p_timezone text, p_payload jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.scheduler_jobs;
begin
  select * into v_job from public.scheduler_jobs where job_name = p_job_name;
  if not found then
    raise exception 'scheduler job % not found', p_job_name;
  end if;

  -- 更新存量记录
  update public.scheduler_jobs
     set cron_spec = p_cron,
         timezone = p_timezone,
         payload = coalesce(p_payload, payload),
         updated_at = now()
   where id = v_job.id;

  -- 若已启用，先停后启
  if v_job.is_enabled then
    perform public.scheduler_stop(p_job_name);
    perform public.scheduler_start(p_job_name, p_cron, p_timezone, p_payload);
  end if;
end;
$$;

-- 7) 初始化：注册汇率更新作业（默认禁用，等待 UI/脚本启用）
insert into public.scheduler_jobs(job_name, job_type, cron_spec, timezone, is_enabled, payload)
values (
  'exchange_rates_update',
  'edge_function',
  '0 2 * * *',          -- 每日 02:00
  'Asia/Shanghai',
  false,
  '{"function":"update-exchange-rates","body":{"updateType":"scheduled"}}'::jsonb
)
on conflict (job_name) do nothing;
```

> 权限：请基于你项目的“管理员角色/表”增加 `grant execute on function` 与 `RLS`。以上函数均为 `security definer`，注意限制只有管理员可执行。

---

## Edge Function 改造要点（update-exchange-rates）

- 输入：`{ updateType: 'scheduled' | 'manual', currencies?: string[] }`。
- 行为：获取真实汇率 → 批量 upsert → 记录 `exchange_rate_update_logs`。
- 并发：使用数据库 `pg_advisory_lock` 或专用锁表避免重入（如果上一次仍在执行，直接返回“正在执行中”）。
- 新增 action：
  - `GET ?action=status`：转调 `rpc('scheduler_status', { p_job_name: 'exchange_rates_update' })` 返回统一状态；
  - `POST ?action=cleanup&days=90`：服务端清理历史数据（而非前端直接删库）。
- 安全：默认 `verify_jwt = true`；
  - 来自 DB 的定时调用使用 `Authorization: Bearer <service_role_key>`；
  - 把密钥放在 `admin.secrets`，仅 `security definer` 函数可读；
  - Edge Function 内校验调用来源（例如校验 `Authorization` 是否 service role）。

---

## 前端改造点（Settings > Currency > Scheduler）

1) 移除前端本地定时器依赖：不再使用 `src/services/exchangeRateScheduler.ts` 来控制 UI 状态。
2) Scheduler 页：
   - 状态：调用 `rpc('scheduler_status',{ p_job_name:'exchange_rates_update' })` 或 Edge `action=status`；
   - 启动：`rpc('scheduler_start',{ p_job_name, p_cron, p_timezone, p_payload })`；
   - 停止：`rpc('scheduler_stop',{ p_job_name })`；
   - 调整：`rpc('scheduler_update',{ p_job_name, p_cron, p_timezone, p_payload })`；
   - Update Now：保留 `supabaseExchangeRateService.triggerExchangeRateUpdate('manual')`；
   - Clean Up Old Data：调用 Edge Function `action=cleanup&days=...`。
3) 文案：改为“Server-side scheduler（服务端统一调度）”，展示 `cron_spec/timezone/last_run/next_run/last_status/failed_attempts`。
4) `settingsStore.ts` 的 `fetchExchangeRatesIfNeeded()` 保持懒加载逻辑不变。

---

## 脚本设计（不改动源代码时的计划与示例）

> 脚本建议以 `Node.js + Supabase JS` 或 `supabase cli` 实施，这里给出示例草案，供落地时参考。

### 1) 初始化与启用脚本（scripts/apply-exchange-rate-scheduler.ts）

用途：
- 检查扩展是否存在；
- 应用迁移（可通过 CLI 预先执行）；
- 写入 `admin.secrets`（service_role_key 与 project_ref）；
- 启用/更新 `exchange_rates_update` 作业为默认 `0 2 * * *`；
- 打印 `scheduler_status`。

示例代码（伪代码，仅文档用途）：

```ts
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, serviceKey)

async function main() {
  // 1) 写入 admin.secrets
  await supabase.from('secrets', { schema: 'admin' }).upsert([
    { name: 'service_role_key', value: serviceKey }
  ])

  // 2) 更新项目 ref（供函数拼接 Function URL 使用）
  await supabase.rpc('set_app_setting', { k: 'app.supabase_project_ref', v: process.env.SUPABASE_PROJECT_REF })

  // 3) 启用/更新调度（24h @ 02:00）
  const payload = { function: 'update-exchange-rates', body: { updateType: 'scheduled' } }
  await supabase.rpc('scheduler_update', {
    p_job_name: 'exchange_rates_update',
    p_cron: '0 2 * * *',
    p_timezone: 'Asia/Shanghai',
    p_payload: payload
  })

  // 4) 启动
  await supabase.rpc('scheduler_start', {
    p_job_name: 'exchange_rates_update',
    p_cron: '0 2 * * *',
    p_timezone: 'Asia/Shanghai',
    p_payload: payload
  })

  // 5) 查看状态
  const { data } = await supabase.rpc('scheduler_status', { p_job_name: 'exchange_rates_update' })
  console.log('scheduler_status', data)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

> 说明：示例中 `set_app_setting` 为便捷 RPC（将配置写入 `pg_settings` 或专表），实际可改为在 `admin.secrets` 存储 `project_ref` 并由 `scheduler_invoke_edge_function` 读取。

### 2) 停用脚本（scripts/disable-exchange-rate-scheduler.ts）

```ts
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, serviceKey)

await supabase.rpc('scheduler_stop', { p_job_name: 'exchange_rates_update' })
```

---

## 实施步骤（建议顺序）

1) 数据库迁移：执行上文 DDL（扩展、表、函数、权限、初始化记录）。
2) Edge Function 增强：支持 `action=status/cleanup` 与并发锁；确保使用真实汇率源。
3) 写入密钥与项目配置：将 `service_role_key` 与 `project_ref` 写入受限存储（如 `admin.secrets`）。
4) 启用调度：运行启用脚本，默认 `0 2 * * *`。
5) 前端改造：
   - 移除 `exchangeRateScheduler` 使用；
   - `Scheduler` 页改为读写服务端 RPC；
   - 文案替换与字段展示调整。
6) 测试：
   - E2E：启停、修改 cron、Update Now、Cleanup；
   - 异常场景：Edge 失败后的 `failed_attempts` 累计与状态显示。
7) 上线：
   - 先保守：默认禁用，观察；
   - 再启用：查看首轮执行日志；
   - 监控：关注 `scheduler_job_runs` 与 `exchange_rate_update_logs`。

---

## 回滚与安全

- 一键停用：`rpc('scheduler_stop', { p_job_name: 'exchange_rates_update' })`。
- 保留配置与日志：不删除 `scheduler_jobs`、`scheduler_job_runs`，便于审计与复盘。
- 安全要点：
  - `security definer` 函数仅授予管理员执行；
  - 服务端密钥仅存储于受限表/安全存储，严禁在前端或公开脚本中出现；
  - Edge Function 内校验 `Authorization` 是否为服务角色。

---

## 前后对比与影响

- 统一服务端定时避免多浏览器实例重复执行与数据写入冲突；
- 调度状态与日志具备单一事实源，UI 展示更可信；
- 调度配置通用化后，可扩展管理其他任务（自动续费、仪表盘预计算、报表汇总等）。

---

## 附：与现有代码的衔接建议

- `src/components/ExchangeRateManager.tsx`（Scheduler 页）：
  - `loadSchedulerStatus` 改为读取服务端 `status`；
  - `handleToggleScheduler` 改为调用 `scheduler_start/stop`；
  - `handleUpdateRates` 保留调用 Edge Function 手动触发；
  - `handleCleanupOldData` 调整为调用 Edge Function `action=cleanup`；
  - 移除对 `exchangeRateScheduler.getStatus()/start()/stop()` 的依赖。
- `src/store/settingsStore.ts`：
  - `fetchExchangeRatesIfNeeded()` 延续懒加载，不与调度耦合。

> 注：以上为文档与实施蓝图，未对源码做任何修改。


