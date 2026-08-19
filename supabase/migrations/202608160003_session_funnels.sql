-- Session-deduplicated funnel inputs. The browser deduplicates each event within
-- its tab session; only aggregate counters reach the database.
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
