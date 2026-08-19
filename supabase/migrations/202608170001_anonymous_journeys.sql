-- Thirty-day anonymous journey ledger. Session identifiers are random in the
-- browser, HMACed at the edge and never stored or returned in raw form.
create table if not exists analytics.session_event (
  session_hash bytea not null check (octet_length(session_hash) = 32),
  occurred_at timestamptz not null default now(),
  metric text not null,
  value text not null,
  primary key (session_hash, metric, value)
);
create index if not exists session_event_recent_idx on analytics.session_event (occurred_at desc);
alter table analytics.session_event enable row level security;
alter table analytics.session_event force row level security;
revoke all on analytics.session_event from public, anon, authenticated;

create or replace function analytics.metric_allowed(p_metric text, p_value text)
returns boolean
language sql immutable strict
set search_path = ''
as $$
  select case p_metric
    when 'page' then p_value = any(array['home','about','portfolio'])
    when 'query_step' then p_value = any(array['1','2','3','4','5','6','7','8','9','10','11','12'])
    when 'query_complete' then p_value = 'yes'
    when 'gate' then p_value = any(array['yes','obviously','you have no idea','are you really goblins?'])
    when 'writer_type' then p_value = any(array['novel','comic or graphic novel','video game','tabletop game','something else'])
    when 'service' then p_value = any(array['creative development','narrative direction','editorial assessment','query/pitch feedback','writing','something else'])
    when 'genre' then p_value = any(array['sci-fi','fantasy','horror','romance','genre blend','something else'])
    when 'terms' then p_value = any(array['i''m in','i have questions'])
    when 'interaction' then p_value = any(array['email_rune','linkedin','field_reports_signup'])
    when 'opportunity' then p_value = any(array['email_rune','linkedin','field_reports_signup'])
    when 'session' then p_value = 'start'
    when 'device' then p_value = any(array['mobile','desktop'])
    when 'region' then p_value = any(array['GB','US','other','unknown'])
    else false
  end
$$;

drop function if exists public.analytics_ingest(text,text,text,text);
create or replace function public.analytics_ingest(
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
  v_session_hash bytea;
begin
  select ingest_hash into v_expected from analytics.private_config where singleton = true;
  if v_expected is null or p_capability is null
     or extensions.digest(p_capability, 'sha256') <> v_expected then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not analytics.metric_allowed(p_metric, p_value) then
    raise exception 'invalid metric' using errcode = '22023';
  end if;
  if p_session_hash is null or p_session_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid session' using errcode = '22023';
  end if;
  v_session_hash := decode(p_session_hash, 'hex');
  if p_owner_token is not null and exists (
    select 1 from analytics.owner_exclusion
    where token_hash = extensions.digest(p_owner_token, 'sha256') and expires_at > now()
  ) then
    v_owner_class := 'owner';
  end if;
  insert into analytics.daily_count(day, metric, value, owner_class, count)
  values (current_date, p_metric, p_value, v_owner_class, 1)
  on conflict (day, metric, value, owner_class)
  do update set count = analytics.daily_count.count + 1, updated_at = now();
  if v_owner_class = 'public' and p_metric not in ('device','region') then
    insert into analytics.session_event(session_hash, metric, value)
    values (v_session_hash, p_metric, p_value)
    on conflict (session_hash, metric, value)
    do update set occurred_at = excluded.occurred_at;
  end if;
  update analytics.private_config set last_accepted_at = now() where singleton = true;
end
$$;
revoke all on function public.analytics_ingest(text,text,text,text,text) from public;
grant execute on function public.analytics_ingest(text,text,text,text,text) to anon, authenticated;

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
    select 1 from analytics.private_config
    where singleton = true and ingest_hash = extensions.digest(p_capability, 'sha256')
  ) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_days not between 1 and 90 or p_minutes not between 1 and 43200 or p_limit not between 1 and 50 then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'window_days', p_days,
    'recent_minutes', p_minutes,
    'generated_at', now(),
    'last_accepted_at', (select last_accepted_at from analytics.private_config where singleton),
    'counts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'metric', metric, 'value', value,
        'count', case when total < 5 then null else round(total::numeric / 5) * 5 end,
        'suppressed', total < 5
      ) order by metric, value)
      from (
        select metric, value, sum(count)::bigint as total
        from analytics.daily_count
        where owner_class = 'public' and day >= current_date - (p_days - 1)
        group by metric, value
      ) totals
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session', session_label,
        'started_at', started_at,
        'last_seen_at', last_seen_at,
        'events', events
      ) order by last_seen_at desc)
      from (
        select
          substring(encode(session_hash, 'hex') from 1 for 8) as session_label,
          min(occurred_at) as started_at,
          max(occurred_at) as last_seen_at,
          jsonb_agg(jsonb_build_object('at', occurred_at, 'metric', metric, 'value', value) order by occurred_at) as events
        from analytics.session_event
        where occurred_at >= now() - make_interval(mins => p_minutes)
        group by session_hash
        order by max(occurred_at) desc
        limit p_limit
      ) recent
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end
$$;
revoke all on function public.goblin_stats_snapshot(integer,integer,integer,text) from public;
grant execute on function public.goblin_stats_snapshot(integer,integer,integer,text) to anon, authenticated;

create or replace function analytics.purge_expired()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from analytics.session_event where occurred_at < now() - interval '30 days';
  delete from analytics.daily_count where day < current_date - 365;
  delete from analytics.owner_exclusion where expires_at <= now();
end
$$;
