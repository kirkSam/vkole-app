update app_trials
set started_at = now() - interval '8 days'
where subject = 'app'
  and not exists (
    select 1 from app_subscriptions s where s.user_id = app_trials.user_id
  );
