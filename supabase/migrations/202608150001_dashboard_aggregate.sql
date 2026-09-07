-- aggregate-at-ingestion counting. no visitor or event rows are created.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists dashboard;
revoke all on schema dashboard from public, anon, authenticated;

create table if not exists dashboard.daily_count (
  day date not null default current_date,
  metric text not null,
  value text not null,
  owner_class text not null check (owner_class in ('public', 'owner')),
  count bigint not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, metric, value, owner_class)
);

create table if not exists dashboard.owner (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists dashboard.owner_exclusion (
  token_hash bytea primary key,
  user_id uuid not null references dashboard.owner(user_id) on delete cascade,
  device_label text not null check (device_label ~ '^[a-f0-9]{6}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, device_label)
);

create table if not exists dashboard.private_config (
  singleton boolean primary key default true check (singleton),
  ingest_hash bytea,
  last_accepted_at timestamptz
);
insert into dashboard.private_config(singleton) values (true) on conflict do nothing;

alter table dashboard.daily_count enable row level security;
alter table dashboard.daily_count force row level security;
alter table dashboard.owner enable row level security;
alter table dashboard.owner force row level security;
alter table dashboard.owner_exclusion enable row level security;
alter table dashboard.owner_exclusion force row level security;
alter table dashboard.private_config enable row level security;
alter table dashboard.private_config force row level security;
revoke all on all tables in schema dashboard from public, anon, authenticated;

create or replace function dashboard.metric_allowed(p_metric text, p_value text)
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

create or replace function public.dashboard_ingest(
  p_metric text,
  p_value text,
  p_capability text,
  p_owner_token text default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_expected bytea;
  v_owner_class text := 'public';
begin
  select ingest_hash into v_expected
  from dashboard.private_config where singleton = true;
  if v_expected is null or p_capability is null
     or extensions.digest(p_capability, 'sha256') <> v_expected then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not dashboard.metric_allowed(p_metric, p_value) then
    raise exception 'invalid metric' using errcode = '22023';
  end if;
  if p_owner_token is not null and exists (
    select 1 from dashboard.owner_exclusion
    where token_hash = extensions.digest(p_owner_token, 'sha256')
      and expires_at > now()
  ) then
    v_owner_class := 'owner';
  end if;
  insert into dashboard.daily_count(day, metric, value, owner_class, count)
  values (current_date, p_metric, p_value, v_owner_class, 1)
  on conflict (day, metric, value, owner_class)
  do update set count = dashboard.daily_count.count + 1, updated_at = now();
  update dashboard.private_config set last_accepted_at = now() where singleton = true;
end
$$;

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

create or replace function public.dashboard_summary(p_days integer default 30)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null
     or coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2'
     or not exists (select 1 from dashboard.owner where user_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_days not between 1 and 90 then raise exception 'invalid range'; end if;
  select jsonb_build_object(
    'window_days', p_days,
    'last_accepted_at', (select last_accepted_at from dashboard.private_config where singleton),
    'counts', coalesce(jsonb_agg(jsonb_build_object(
      'metric', metric,
      'value', value,
      'count', case when total < 5 then null else round(total::numeric / 5) * 5 end,
      'suppressed', total < 5
    ) order by metric, value), '[]'::jsonb)
  ) into v_result
  from (
    select metric, value, sum(count)::bigint as total
    from dashboard.daily_count
    where owner_class = 'public' and day >= current_date - (p_days - 1)
    group by metric, value
  ) safe_counts;
  return v_result;
end
$$;

create or replace function dashboard.purge_expired()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from dashboard.daily_count where day < current_date - 365;
  delete from dashboard.owner_exclusion where expires_at <= now();
end
$$;

revoke all on function public.dashboard_ingest(text,text,text,text) from public;
revoke all on function public.issue_owner_exclusion() from public;
revoke all on function public.dashboard_summary(integer) from public;
grant execute on function public.dashboard_ingest(text,text,text,text) to anon, authenticated;
grant execute on function public.issue_owner_exclusion() to authenticated;
grant execute on function public.dashboard_summary(integer) to authenticated;

-- quarantine the legacy raw rows. they are intentionally retained until noah
-- separately approves their deletion, but no website role may read or mutate them.
do $$ begin
  if to_regclass('public.seen') is not null then
    execute 'revoke all on table public.seen from anon, authenticated';
    execute 'alter table public.seen enable row level security';
    execute 'alter table public.seen force row level security';
  end if;
end $$;

-- run the following two statements once through the supabase SQL editor using
-- freshly generated values. never commit those values:
-- update dashboard.private_config set ingest_hash = extensions.digest('<capability>', 'sha256') where singleton;
-- insert into dashboard.owner(user_id) select id from auth.users where email = '<owner email>' on conflict do nothing;
