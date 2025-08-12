-- Public wrapper for util.process_due_auto_renewals to allow RPC invocation from frontend (authenticated admins)

create or replace function public.process_due_auto_renewals(p_limit int default 500)
returns jsonb
language plpgsql
security definer
set search_path = public, util
as $$
begin
  return util.process_due_auto_renewals(p_limit);
end;
$$;

comment on function public.process_due_auto_renewals(int) is
  'Public wrapper to trigger util.process_due_auto_renewals for manual admin trigger via RPC.';

-- tighten default grants and allow only intended roles
revoke all on function public.process_due_auto_renewals(int) from public;
grant execute on function public.process_due_auto_renewals(int) to authenticated;
grant execute on function public.process_due_auto_renewals(int) to service_role;


