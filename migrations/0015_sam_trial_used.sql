update app_trials
set started_at = now() - interval '8 days'
where subject = 'app'
  and user_id in (
    select user_id from climbs
    where lower(child_name) = 'sam' and subject = 'm'
  );
