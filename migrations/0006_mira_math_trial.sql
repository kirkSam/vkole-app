update app_trials
set started_at = now() - interval '8 days'
where subject = 'm'
  and user_id in (
    select user_id from climbs
    where subject = 'm' and lower(child_name) = 'mira'
  );
