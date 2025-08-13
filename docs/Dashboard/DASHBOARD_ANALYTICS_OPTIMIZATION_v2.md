# Dashboard Analytics Edge Function 优化 - 技术实施文档

**文档版本:** 2.0
**日期:** 2025年08月05日

## 1. 概述

本文档为 `dashboard-analytics` Edge Function 的性能优化提供详细的技术实施方案。当前实现存在多次数据库查询和在函数内存中进行数据处理的问题，导致性能瓶颈。

本方案通过创建一个名为 `get_dashboard_analytics` 的 PostgreSQL 函数（RPC），将所有数据密集型操作（查询、过滤、计算、聚合）下沉至数据库层，以实现性能的根本性提升。

重要口径说明：为简化实现并获得稳定、可预期的性能表现，本文档将“货币换算”统一调整为基于“最新汇率”的全局口径（不再按支付日历史汇率换算）。当不存在直达汇率时，以 `CNY` 为基准进行双段换算（FROM→CNY→TARGET）。

## 2. 第一部分：数据库层修改 (PostgreSQL 函数)

**目标:** 创建一个 `get_dashboard_analytics` 函数，该函数将作为所有仪表盘数据分析的统一入口点，并采用“最新汇率 + CNY 中转”的统一换算口径。

### 2.1. 函数定义 (`get_dashboard_analytics`)

请在您的 Supabase 项目的 **SQL Editor** 中执行以下脚本来创建该函数。此函数设计为单次查询即可生成所有需要的数据，并在 SQL 层完成基于“最新汇率”的统一换算。

```sql
-- 如果函数已存在，先删除旧签名版本，确保我们创建的是最新版本
DROP FUNCTION IF EXISTS get_dashboard_analytics(text, int, int);

-- 创建用于仪表盘分析的统一 RPC 函数（采用最新汇率 + CNY 中转）
CREATE OR REPLACE FUNCTION get_dashboard_analytics(
  target_currency text DEFAULT 'CNY',
  upcoming_days int DEFAULT 7,
  recent_days int DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  final_result jsonb;
BEGIN
  -- 使用 CTE 构建单次查询；所有换算均基于 exchange_rates 的最新日期
  WITH 
  latest AS (
    SELECT MAX(date) AS dt FROM public.exchange_rates
  ),
  -- CTE 1: 获取用户所有活跃订阅，并关联分类信息
  active_subscriptions AS (
    SELECT
      s.id, s.name, s.amount, s.currency, s.billing_cycle,
      s.next_billing_date, s.last_billing_date,
      c.value as category_value,
      c.label as category_label
    FROM public.subscriptions s
    LEFT JOIN public.categories c ON s.category_id = c.id
    WHERE s.user_id = auth.uid() AND s.status = 'active'
  ),
  -- CTE 2: 获取当年的支付历史，并在 SQL 中基于“最新汇率”完成货币转换
  payments_converted AS (
    SELECT
      ph.subscription_id,
      ph.amount_paid,
      ph.payment_date,
      (
        CASE
          WHEN ph.currency = target_currency THEN ph.amount_paid
          ELSE COALESCE(
            -- 直达汇率（最新日）
            ph.amount_paid * (
              SELECT er.rate
              FROM public.exchange_rates er
              JOIN latest l ON er.date = l.dt
              WHERE er.from_currency = ph.currency AND er.to_currency = target_currency
              LIMIT 1
            ),
            -- CNY 中转（最新日）：FROM→CNY→TARGET
            CASE
              WHEN ph.currency = 'CNY' THEN
                ph.amount_paid * (
                  SELECT er_to.rate
                  FROM public.exchange_rates er_to
                  JOIN latest l ON er_to.date = l.dt
                  WHERE er_to.from_currency = 'CNY' AND er_to.to_currency = target_currency
                  LIMIT 1
                )
              WHEN target_currency = 'CNY' THEN
                ph.amount_paid / NULLIF((
                  SELECT er_from.rate
                  FROM public.exchange_rates er_from
                  JOIN latest l ON er_from.date = l.dt
                  WHERE er_from.from_currency = 'CNY' AND er_from.to_currency = ph.currency
                  LIMIT 1
                ), 0)
              ELSE
                (ph.amount_paid / NULLIF((
                  SELECT er_from.rate
                  FROM public.exchange_rates er_from
                  JOIN latest l ON er_from.date = l.dt
                  WHERE er_from.from_currency = 'CNY' AND er_from.to_currency = ph.currency
                  LIMIT 1
                ), 0)) * (
                  SELECT er_to.rate
                  FROM public.exchange_rates er_to
                  JOIN latest l ON er_to.date = l.dt
                  WHERE er_to.from_currency = 'CNY' AND er_to.to_currency = target_currency
                  LIMIT 1
                )
            END
          )
        END
      )::numeric AS converted_amount
    FROM public.payment_history ph
    WHERE ph.user_id = auth.uid()
      AND ph.status = 'success'
      AND ph.payment_date >= date_trunc('year', now())
  )
  -- 步骤 3: 将所有计算结果聚合到一个最终的 JSON 对象中
  SELECT jsonb_build_object(
    'currency', target_currency,
    'timestamp', now()::text,
    'activeSubscriptions', (SELECT COUNT(*) FROM active_subscriptions),

    -- 计算当月和当年总支出
    'monthlySpending', ROUND(COALESCE((SELECT SUM(pc.converted_amount) FROM payments_converted pc WHERE pc.payment_date >= date_trunc('month', now())), 0), 2),
    'yearlySpending', ROUND(COALESCE((SELECT SUM(pc.converted_amount) FROM payments_converted pc), 0), 2),

    -- 计算即将续费列表（最新汇率）
    'upcomingRenewals', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', s.id, 'name', s.name, 'amount', s.amount, 'currency', s.currency,
          'next_billing_date', s.next_billing_date, 'billing_cycle', s.billing_cycle,
          'convertedAmount', ROUND((
            CASE
              WHEN s.currency = target_currency THEN s.amount
              ELSE COALESCE(
                s.amount * (
                  SELECT er.rate FROM public.exchange_rates er
                  JOIN latest l ON er.date = l.dt
                  WHERE er.from_currency = s.currency AND er.to_currency = target_currency
                  LIMIT 1
                ),
                CASE
                  WHEN s.currency = 'CNY' THEN s.amount * (
                    SELECT er_to.rate FROM public.exchange_rates er_to
                    JOIN latest l ON er_to.date = l.dt
                    WHERE er_to.from_currency = 'CNY' AND er_to.to_currency = target_currency
                    LIMIT 1
                  )
                  WHEN target_currency = 'CNY' THEN s.amount / NULLIF((
                    SELECT er_from.rate FROM public.exchange_rates er_from
                    JOIN latest l ON er_from.date = l.dt
                    WHERE er_from.from_currency = 'CNY' AND er_from.to_currency = s.currency
                    LIMIT 1
                  ), 0)
                  ELSE (s.amount / NULLIF((
                    SELECT er_from.rate FROM public.exchange_rates er_from
                    JOIN latest l ON er_from.date = l.dt
                    WHERE er_from.from_currency = 'CNY' AND er_from.to_currency = s.currency
                    LIMIT 1
                  ), 0)) * (
                    SELECT er_to.rate FROM public.exchange_rates er_to
                    JOIN latest l ON er_to.date = l.dt
                    WHERE er_to.from_currency = 'CNY' AND er_to.to_currency = target_currency
                    LIMIT 1
                  )
                END
              )
            END
          )::numeric, 2)
        ) ORDER BY s.next_billing_date ASC
      ), '[]'::jsonb)
      FROM active_subscriptions s
      WHERE s.next_billing_date BETWEEN current_date AND (current_date + (upcoming_days || ' days')::interval)
    ),

    -- 计算最近支付列表（最新汇率）
    'recentlyPaid', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', s.id, 'name', s.name, 'amount', s.amount, 'currency', s.currency,
          'last_billing_date', s.last_billing_date, 'billing_cycle', s.billing_cycle,
          'convertedAmount', ROUND((
            CASE
              WHEN s.currency = target_currency THEN s.amount
              ELSE COALESCE(
                s.amount * (
                  SELECT er.rate FROM public.exchange_rates er
                  JOIN latest l ON er.date = l.dt
                  WHERE er.from_currency = s.currency AND er.to_currency = target_currency
                  LIMIT 1
                ),
                CASE
                  WHEN s.currency = 'CNY' THEN s.amount * (
                    SELECT er_to.rate FROM public.exchange_rates er_to
                    JOIN latest l ON er_to.date = l.dt
                    WHERE er_to.from_currency = 'CNY' AND er_to.to_currency = target_currency
                    LIMIT 1
                  )
                  WHEN target_currency = 'CNY' THEN s.amount / NULLIF((
                    SELECT er_from.rate FROM public.exchange_rates er_from
                    JOIN latest l ON er_from.date = l.dt
                    WHERE er_from.from_currency = 'CNY' AND er_from.to_currency = s.currency
                    LIMIT 1
                  ), 0)
                  ELSE (s.amount / NULLIF((
                    SELECT er_from.rate FROM public.exchange_rates er_from
                    JOIN latest l ON er_from.date = l.dt
                    WHERE er_from.from_currency = 'CNY' AND er_from.to_currency = s.currency
                    LIMIT 1
                  ), 0)) * (
                    SELECT er_to.rate FROM public.exchange_rates er_to
                    JOIN latest l ON er_to.date = l.dt
                    WHERE er_to.from_currency = 'CNY' AND er_to.to_currency = target_currency
                    LIMIT 1
                  )
                END
              )
            END
          )::numeric, 2)
        ) ORDER BY s.last_billing_date DESC
      ), '[]'::jsonb)
      FROM active_subscriptions s
      WHERE s.last_billing_date BETWEEN (current_date - (recent_days || ' days')::interval) AND current_date
    ),

    -- 计算分类支出统计
    'categoryBreakdown', (
      WITH category_summary AS (
        SELECT
          COALESCE(s.category_value, 'other') as category,
          COALESCE(s.category_label, '其他') as label,
          SUM(pc.converted_amount) as total_amount,
          COUNT(pc.subscription_id) as payment_count
        FROM payments_converted pc
        JOIN active_subscriptions s ON pc.subscription_id = s.id
        GROUP BY s.category_value, s.category_label
      ),
      total_spending AS (
        SELECT SUM(cs.total_amount) as total FROM category_summary cs
      )
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'category', cs.category,
          'label', cs.label,
          'amount', ROUND(cs.total_amount, 2),
          'paymentCount', cs.payment_count,
          'percentage', ROUND((cs.total_amount / NULLIF((SELECT total FROM total_spending), 0)) * 100, 2)
        ) ORDER BY cs.total_amount DESC
      ), '[]'::jsonb)
      FROM category_summary cs
    )
  )
  INTO final_result;

  RETURN final_result;
END;
$$;
```

### 2.2. 汇率来源与索引建议
- 换算统一基于 `public.exchange_rates` 的“最新日期”（`MAX(date)`）。
- 若不存在直达汇率，将以 `CNY` 为基准进行双段换算（FROM→CNY→TARGET）。
- 建议确保以下索引存在以提升性能：
  - `CREATE INDEX IF NOT EXISTS idx_payment_history_user_date ON public.payment_history(user_id, payment_date);`
  - `CREATE INDEX IF NOT EXISTS idx_exchange_rates_composite ON public.exchange_rates(from_currency, to_currency, date);`

## 3. 第二部分：Edge Function 重构

**目标:** 简化 `dashboard-analytics/index.ts`，使其只负责认证、参数解析和对新 RPC 函数的单次调用。

### 3.1. 重构后的 `index.ts` 代码

请将 `supabase/functions/dashboard-analytics/index.ts` 的内容**完全替换**为以下代码（注意：RPC 参数已无 `p_user_id`，并改为 `target_currency`/`upcoming_days`/`recent_days`）：

```typescript
// @ts-ignore - Deno runtime imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno runtime imports  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Interface for request parameters, kept for clarity
interface DashboardRequest {
    targetCurrency?: string
    upcomingDays?: number
    recentDays?: number
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Create Supabase client with the user's auth token
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        )

        // Validate user identity
        const {
            data: { user },
            error: userError,
        } = await supabaseClient.auth.getUser()

        if (userError || !user) {
            return new Response(
                JSON.stringify({ success: false, error: 'Unauthorized' }),
                {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Parse request parameters
        const requestData: DashboardRequest = req.method === 'POST'
            ? await req.json()
            : Object.fromEntries(new URL(req.url).searchParams.entries())

        const {
            targetCurrency = 'CNY',
            upcomingDays = 7,
            recentDays = 7
        } = requestData

        console.log(`Calling get_dashboard_analytics RPC for user ${user.id}`)

        // *** CORE OPTIMIZATION: Single RPC call to the database function ***
        const { data, error } = await supabaseClient.rpc('get_dashboard_analytics', {
            target_currency: targetCurrency,
            upcoming_days: upcomingDays,
            recent_days: recentDays
        })

        if (error) {
            console.error('RPC call get_dashboard_analytics failed:', error)
            throw new Error(`Database RPC error: ${error.message}`)
        }

        console.log(`Dashboard analytics completed for user ${user.id}`)

        // The data from the RPC is already the complete response payload.
        return new Response(
            JSON.stringify({ success: true, data }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )

    } catch (error) {
        console.error('Dashboard analytics error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Internal server error'
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})
```

### 3.2. 关键变更说明

-   **完全移除数据处理逻辑**:
    -   删除了所有独立的 `supabase.from(...)` 调用。
    -   删除了所有用于汇率计算、分类聚合的辅助函数和 `for` 循环。
-   **替换为单次 RPC 调用**:
    -   所有业务逻辑现在都通过对 `get_dashboard_analytics` 的一次调用完成。
    -   请求中的参数被直接、安全地传递给 RPC 函数。
-   **简化响应逻辑**:
    -   RPC 函数返回的数据就是最终的 JSON 响应体，Edge Function 只需将其包装后直接返回。

## 4. 部署与验证

1.  **部署数据库函数**: 在 Supabase Studio 的 SQL Editor 中运行第 2.1 节的 SQL 脚本，创建或更新 `get_dashboard_analytics` 函数。
2.  **部署 Edge Function**: 使用 Supabase CLI 部署更新后的 `dashboard-analytics` Edge Function。
3.  **验证**: 调用该 Edge Function，确认其功能与优化前完全一致，但响应时间应有显著缩短，并且所有数据（包括分类支出）都应正确显示。
