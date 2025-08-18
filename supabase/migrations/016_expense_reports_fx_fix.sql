-- 修复聚合函数中的汇率换算：添加反向倒数兜底，确保任意币种均可换算到目标币种

-- 月度聚合修复
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
          ph.amount_paid * coalesce(
            -- 直达汇率
            (select rate from rates where from_currency = ph.currency and to_currency = p_target_currency),
            -- 两段：from -> CNY -> target
            ((select rate from rates where from_currency = ph.currency and to_currency = 'CNY') *
             (select rate from rates where from_currency = 'CNY' and to_currency = p_target_currency)),
            -- 反向：CNY -> from 的倒数，再乘 CNY -> target
            ((1 / nullif((select rate from rates where from_currency = 'CNY' and to_currency = ph.currency), 0)) *
             (select rate from rates where from_currency = 'CNY' and to_currency = p_target_currency)),
            -- 反向直达：target -> from 的倒数
            (1 / nullif((select rate from rates where from_currency = p_target_currency and to_currency = ph.currency), 0)),
            -- 兜底
            1
          )
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

-- 年度聚合修复
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
          ph.amount_paid * coalesce(
            (select rate from rates where from_currency = ph.currency and to_currency = p_target_currency),
            ((select rate from rates where from_currency = ph.currency and to_currency = 'CNY') *
             (select rate from rates where from_currency = 'CNY' and to_currency = p_target_currency)),
            ((1 / nullif((select rate from rates where from_currency = 'CNY' and to_currency = ph.currency), 0)) *
             (select rate from rates where from_currency = 'CNY' and to_currency = p_target_currency)),
            (1 / nullif((select rate from rates where from_currency = p_target_currency and to_currency = ph.currency), 0)),
            1
          )
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

-- 分类聚合修复
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
          ph.amount_paid * coalesce(
            (select rate from rates where from_currency = ph.currency and to_currency = p_target_currency),
            ((select rate from rates where from_currency = ph.currency and to_currency = 'CNY') *
             (select rate from rates where from_currency = 'CNY' and to_currency = p_target_currency)),
            ((1 / nullif((select rate from rates where from_currency = 'CNY' and to_currency = ph.currency), 0)) *
             (select rate from rates where from_currency = 'CNY' and to_currency = p_target_currency)),
            (1 / nullif((select rate from rates where from_currency = p_target_currency and to_currency = ph.currency), 0)),
            1
          )
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
