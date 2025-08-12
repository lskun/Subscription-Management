-- Admin user stats RPC definition
-- Requires current session user to be super_admin in public.admin_users/public.admin_roles

create schema if not exists admin;

create or replace function admin.get_user_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_is_super boolean := false;
  v_total_users int := 0;
  v_active_users_30d int := 0;
  v_new_users_this_month int := 0;
  v_suspended_users int := 0;
  v_month_start date := date_trunc('month', now())::date;
  v_30d timestamp := now() - interval '30 days';
begin
  -- Check super_admin role of current user
  select exists (
    select 1
    from public.admin_users au
    join public.admin_roles ar on ar.id = au.role_id
    where au.user_id = v_uid and ar.name = 'super_admin'
  ) into v_is_super;

  if not v_is_super then
    raise exception 'FORBIDDEN: super_admin required';
  end if;

  -- Aggregations using elevated privileges (security definer)
  select count(*)::int into v_total_users from auth.users;
  select count(*)::int into v_active_users_30d from auth.users where last_sign_in_at >= v_30d;
  select count(*)::int into v_new_users_this_month from auth.users where created_at >= v_month_start;
  select count(*)::int into v_suspended_users from public.user_profiles where is_blocked = true;

  return jsonb_build_object(
    'totalUsers', v_total_users,
    'activeUsers30d', v_active_users_30d,
    'newUsersThisMonth', v_new_users_this_month,
    'suspendedUsers', v_suspended_users
  );
end;
$$;

comment on function admin.get_user_stats is 'Return user statistics; requires current user to be super_admin.';

-- Public wrapper for frontend RPC invocation
create or replace function public.get_user_stats()
returns jsonb
language sql
security definer
set search_path = public, admin
as $$
select admin.get_user_stats();
$$;

revoke all on function public.get_user_stats() from public;
grant execute on function public.get_user_stats() to authenticated;
grant execute on function public.get_user_stats() to service_role;


