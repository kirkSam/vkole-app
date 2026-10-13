update app_trials
set started_at = now() - interval '8 days'
where subject = 'app';
