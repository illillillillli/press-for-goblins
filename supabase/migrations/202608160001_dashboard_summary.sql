create or replace function public.dashboard_summary(p_days integer default 30)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null
     or coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2'
     or not exists (select 1 from analytics.owner where user_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_days not between 1 and 90 then raise exception 'invalid range'; end if;
  select jsonb_build_object(
    'window_days', p_days,
    'last_accepted_at', (select last_accepted_at from analytics.private_config where singleton),
    'counts', coalesce(jsonb_agg(jsonb_build_object(
      'metric', metric,
      'value', value,
      'count', case when total < 5 then null else round(total::numeric / 5) * 5 end,
      'suppressed', total < 5
    ) order by metric, value), '[]'::jsonb)
  ) into v_result
  from (
    select metric, value, sum(count)::bigint as total
    from analytics.daily_count
    where owner_class = 'public' and day >= current_date - (p_days - 1)
    group by metric, value
  ) safe_counts;
  return v_result;
end
$$;

revoke all on function public.dashboard_summary(integer) from public;
grant execute on function public.dashboard_summary(integer) to authenticated;
