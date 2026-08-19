create extension if not exists pg_cron with schema pg_catalog;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'dashboard-retention') then
    perform cron.schedule('dashboard-retention', '17 3 * * *', 'select analytics.purge_expired()');
  end if;
end
$$;
