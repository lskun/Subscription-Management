-- Batch auto-renewal function (DB-internal), uses existing schema only
-- Runs a limited batch of due subscriptions and invokes the existing RPC
-- process_subscription_renewal(subscription_id, user_id) atomically.

create schema if not exists util;

create or replace function util.process_due_auto_renewals(p_limit int default 500)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_processed int := 0;
  v_errors int := 0;
  v_skipped int := 0;
  r record;
begin
  -- Scan due subscriptions, lock rows to avoid concurrent double processing
  for r in (
    select id, user_id
    from public.subscriptions
    where renewal_type = 'auto'
      and status = 'active'
      and next_billing_date <= current_date
    order by next_billing_date asc
    limit p_limit
    for update skip locked
  ) loop
    begin
      perform process_subscription_renewal(r.id, r.user_id);
      v_processed := v_processed + 1;
    exception when others then
      v_errors := v_errors + 1;
      -- Optional log to system_logs using existing columns
      insert into public.system_logs(id, log_type, message, metadata, created_at)
      values (gen_random_uuid(), 'auto_renew_error', sqlerrm,
              jsonb_build_object('subscription_id', r.id, 'user_id', r.user_id), now());
    end;
  end loop;

  -- Optional stats counter using existing table
  insert into public.system_stats(id, stat_type, stat_value, metadata, recorded_at)
  values (gen_random_uuid(), 'auto_renew_processed', v_processed, '{}', now());

  return jsonb_build_object('processed', v_processed, 'errors', v_errors, 'skipped', v_skipped);
end;
$$;


