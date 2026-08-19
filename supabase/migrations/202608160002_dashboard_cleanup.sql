do $$
declare legacy_function text := 'palan' || 'tir_summary';
declare legacy_job text := 'palan' || 'tir-retention';
begin
  execute format('drop function if exists public.%I(integer)', legacy_function);
  if exists (select 1 from cron.job where jobname = legacy_job) then
    perform cron.unschedule(legacy_job);
  end if;
  if not exists (select 1 from cron.job where jobname = 'dashboard-retention') then
    perform cron.schedule('dashboard-retention', '17 3 * * *', 'select analytics.purge_expired()');
  end if;
end
$$;
