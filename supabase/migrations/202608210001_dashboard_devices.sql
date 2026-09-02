alter table dashboard.owner_exclusion
  add column if not exists device_label text;

update dashboard.owner_exclusion
set device_label = substring(encode(token_hash, 'hex') from 1 for 6)
where device_label is null;

alter table dashboard.owner_exclusion
  alter column device_label set not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'owner_exclusion_device_label_check'
      and conrelid = 'dashboard.owner_exclusion'::regclass
  ) then
    alter table dashboard.owner_exclusion
      add constraint owner_exclusion_device_label_check
      check (device_label ~ '^[a-f0-9]{6}$');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'owner_exclusion_user_device_key'
      and conrelid = 'dashboard.owner_exclusion'::regclass
  ) then
    alter table dashboard.owner_exclusion
      add constraint owner_exclusion_user_device_key unique (user_id, device_label);
  end if;
end $$;

alter table dashboard.session_event
  add column if not exists audience text not null default 'public',
  add column if not exists device_label text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'session_event_audience_check'
      and conrelid = 'dashboard.session_event'::regclass
  ) then
    alter table dashboard.session_event
      add constraint session_event_audience_check
      check (audience in ('public','owner'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'session_event_device_label_check'
      and conrelid = 'dashboard.session_event'::regclass
  ) then
    alter table dashboard.session_event
      add constraint session_event_device_label_check
      check (device_label is null or device_label ~ '^[a-f0-9]{6}$');
  end if;
end $$;

create or replace function public.issue_owner_exclusion()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_token text;
  v_device text;
begin
  if auth.uid() is null
     or coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2'
     or not exists (select 1 from dashboard.owner where user_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_device := substring(encode(extensions.digest(v_token, 'sha256'), 'hex') from 1 for 6);
  delete from dashboard.owner_exclusion where expires_at <= now();
  insert into dashboard.owner_exclusion(token_hash, user_id, device_label, expires_at)
  values (extensions.digest(v_token, 'sha256'), auth.uid(), v_device, now() + interval '180 days');
  return jsonb_build_object('token', v_token, 'device', v_device);
end
$$;

create or replace function public.dashboard_ingest(
  p_metric text,
  p_value text,
  p_capability text,
  p_owner_token text default null,
  p_session_hash text default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_expected bytea;
  v_owner_class text := 'public';
  v_owner_device text;
  v_session_hash bytea;
begin
  select ingest_hash into v_expected from dashboard.private_config where singleton = true;
  if v_expected is null or p_capability is null
     or extensions.digest(p_capability, 'sha256') <> v_expected then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not dashboard.metric_allowed(p_metric, p_value) then
    raise exception 'invalid metric' using errcode = '22023';
  end if;
  if p_session_hash is null or p_session_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid session' using errcode = '22023';
  end if;
  v_session_hash := decode(p_session_hash, 'hex');
  if p_owner_token is not null then
    select device_label into v_owner_device
    from dashboard.owner_exclusion
    where token_hash = extensions.digest(p_owner_token, 'sha256') and expires_at > now();
  end if;
  if v_owner_device is not null then v_owner_class := 'owner'; end if;
  insert into dashboard.daily_count(day, metric, value, owner_class, count)
  values (current_date, p_metric, p_value, v_owner_class, 1)
  on conflict (day, metric, value, owner_class)
  do update set count = dashboard.daily_count.count + 1, updated_at = now();
  if p_metric not in ('device','region') then
    insert into dashboard.session_event(session_hash, metric, value, audience, device_label)
    values (v_session_hash, p_metric, p_value, v_owner_class, v_owner_device)
    on conflict (session_hash, metric, value)
    do update set occurred_at = excluded.occurred_at,
                  audience = excluded.audience,
                  device_label = excluded.device_label;
  end if;
  update dashboard.private_config set last_accepted_at = now() where singleton = true;
end
$$;

create or replace function public.goblin_stats_snapshot(
  p_days integer default 30,
  p_minutes integer default 1440,
  p_limit integer default 20,
  p_capability text default null
) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if p_capability is null or not exists (
    select 1 from dashboard.private_config
    where singleton = true and ingest_hash = extensions.digest(p_capability, 'sha256')
  ) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_days not between 1 and 90 or p_minutes not between 1 and 43200 or p_limit not between 1 and 50 then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'window_days', p_days,
    'recent_minutes', p_minutes,
    'generated_at', now(),
    'last_accepted_at', (select last_accepted_at from dashboard.private_config where singleton),
    'counts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'metric', metric, 'value', value,
        'count', case when total < 5 then null else round(total::numeric / 5) * 5 end,
        'suppressed', total < 5
      ) order by metric, value)
      from (
        select metric, value, sum(count)::bigint as total
        from dashboard.daily_count
        where owner_class = 'public' and day >= current_date - (p_days - 1)
        group by metric, value
      ) totals
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session', session_label,
        'audience', audience,
        'device', device_label,
        'started_at', started_at,
        'last_seen_at', last_seen_at,
        'events', events
      ) order by last_seen_at desc)
      from (
        select
          substring(encode(session_hash, 'hex') from 1 for 8) as session_label,
          audience,
          device_label,
          min(occurred_at) as started_at,
          max(occurred_at) as last_seen_at,
          jsonb_agg(jsonb_build_object('at', occurred_at, 'metric', metric, 'value', value) order by occurred_at) as events
        from dashboard.session_event
        where occurred_at >= now() - make_interval(mins => p_minutes)
        group by session_hash, audience, device_label
        order by max(occurred_at) desc
        limit p_limit
      ) recent
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end
$$;

revoke all on function public.issue_owner_exclusion() from public;
revoke all on function public.dashboard_ingest(text,text,text,text,text) from public;
revoke all on function public.goblin_stats_snapshot(integer,integer,integer,text) from public;
grant execute on function public.issue_owner_exclusion() to authenticated;
grant execute on function public.dashboard_ingest(text,text,text,text,text) to anon, authenticated;
grant execute on function public.goblin_stats_snapshot(integer,integer,integer,text) to anon, authenticated;
