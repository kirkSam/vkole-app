update app_trials
set started_at = now()
where subject = 'app'
  and not exists (
    select 1 from app_subscriptions s where s.user_id = app_trials.user_id
  );
