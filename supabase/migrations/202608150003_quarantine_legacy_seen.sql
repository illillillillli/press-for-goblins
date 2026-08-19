do $$
declare policy_row record;
begin
  if to_regclass('public.seen') is null then return; end if;
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'seen'
  loop
    execute format('drop policy %I on public.seen', policy_row.policyname);
  end loop;
  revoke all on table public.seen from public, anon, authenticated;
  alter table public.seen enable row level security;
  alter table public.seen force row level security;
end
$$;
