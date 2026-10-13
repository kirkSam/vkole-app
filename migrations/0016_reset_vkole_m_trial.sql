update app_trials
set started_at = now()
where subject = 'app'
  and user_id in (
    select user_id from climbs
    where subject = 'm' and lower(child_name) = 'sam'
  );
