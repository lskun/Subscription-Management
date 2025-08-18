-- Expense Reports SQL 聚合函数（基于实际支付流水 + 最新汇率快照）
-- 说明：为提升性能，将 period 与分类聚合下推至 SQL，Edge 端仅做组装

-- 月度聚合：返回 [month(YYYY-MM), year, total, currency, payment_count]
create or replace function public.expense_monthly_aggregate(
  p_user_id uuid,
  p_target_currency text,
  p_start date,
  p_end date
) returns table (
  month text,
  year int,
  total numeric,
  currency text,
  payment_count int
) language sql stable as $$
  with latest_date as (
    select max(date) d from public.exchange_rates
  ), rates as (
    select from_currency, to_currency, rate
    from public.exchange_rates
    where date = (select d from latest_date)
  ), ph as (
    select * from public.payment_history
    where user_id = p_user_id
      and status = 'success'
      and payment_date >= p_start
      and payment_date <= p_end
  ), converted as (
    select
      ph.payment_date,
      case
        when ph.currency = p_target_currency then ph.amount_paid
        else
          ph.amount_paid
          * coalesce((select rate from rates where from_currency = ph.currency and to_currency = 'CNY'), 1)
          * coalesce((select rate from rates where from_currency = 'CNY' and to_currency = p_target_currency), 1)
      end as amount_converted
    from ph
  )
  select
    to_char(date_trunc('month', payment_date), 'YYYY-MM') as month,
    extract(year from payment_date)::int as year,
    round(sum(amount_converted)::numeric, 2) as total,
    p_target_currency as currency,
    count(*) as payment_count
  from converted
  group by 1,2
  order by 1
$$;

grant execute on function public.expense_monthly_aggregate(uuid, text, date, date) to authenticated, service_role;

-- 年度聚合：返回 [year, total, currency, payment_count]，保留 2023 年金额置 0 的硬编码
create or replace function public.expense_yearly_aggregate(
  p_user_id uuid,
  p_target_currency text,
  p_start date,
  p_end date
) returns table (
  year int,
  total numeric,
  currency text,
  payment_count int
) language sql stable as $$
  with latest_date as (
    select max(date) d from public.exchange_rates
  ), rates as (
    select from_currency, to_currency, rate
    from public.exchange_rates
    where date = (select d from latest_date)
  ), ph as (
    select * from public.payment_history
    where user_id = p_user_id
      and status = 'success'
      and payment_date >= p_start
      and payment_date <= p_end
  ), converted as (
    select
      ph.payment_date,
      case
        when ph.currency = p_target_currency then ph.amount_paid
        else
          ph.amount_paid
          * coalesce((select rate from rates where from_currency = ph.currency and to_currency = 'CNY'), 1)
          * coalesce((select rate from rates where from_currency = 'CNY' and to_currency = p_target_currency), 1)
      end as amount_converted
    from ph
  ), yearly as (
    select
      extract(year from payment_date)::int as year,
      sum(amount_converted) as total_raw,
      count(*) as payment_count
    from converted
    group by 1
  )
  select
    y.year,
    round((case when y.year = 2023 then 0 else y.total_raw end)::numeric, 2) as total,
    p_target_currency as currency,
    y.payment_count
  from yearly y
  order by y.year
$$;

grant execute on function public.expense_yearly_aggregate(uuid, text, date, date) to authenticated, service_role;

-- 分类聚合：返回 [category, label, total, currency, subscription_count]，当年=2023 时总额置 0
create or replace function public.expense_category_aggregate(
  p_user_id uuid,
  p_target_currency text,
  p_start date,
  p_end date
) returns table (
  category text,
  label text,
  total numeric,
  currency text,
  subscription_count int
) language sql stable as $$
  with latest_date as (
    select max(date) d from public.exchange_rates
  ), rates as (
    select from_currency, to_currency, rate
    from public.exchange_rates
    where date = (select d from latest_date)
  ), ph as (
    select * from public.payment_history
    where user_id = p_user_id
      and status = 'success'
      and payment_date >= p_start
      and payment_date <= p_end
  ), converted as (
    select
      ph.subscription_id,
      ph.payment_date,
      case
        when ph.currency = p_target_currency then ph.amount_paid
        else
          ph.amount_paid
          * coalesce((select rate from rates where from_currency = ph.currency and to_currency = 'CNY'), 1)
          * coalesce((select rate from rates where from_currency = 'CNY' and to_currency = p_target_currency), 1)
      end as amount_converted
    from ph
  ), joined as (
    select
      coalesce(c.value, 'other') as category,
      coalesce(c.label, '其他') as label,
      date_part('year', now())::int as current_year,
      converted.subscription_id,
      converted.amount_converted
    from converted
    left join public.subscriptions s on s.id = converted.subscription_id and s.user_id = p_user_id
    left join public.categories c on c.id = s.category_id
  )
  select
    j.category,
    j.label,
    round((case when j.current_year = 2023 then 0 else sum(j.amount_converted) end)::numeric, 2) as total,
    p_target_currency as currency,
    count(distinct j.subscription_id) as subscription_count
  from joined j
  group by j.category, j.label, j.current_year
  order by total desc
$$;

grant execute on function public.expense_category_aggregate(uuid, text, date, date) to authenticated, service_role;
