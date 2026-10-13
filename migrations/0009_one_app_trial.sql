insert into app_trials (user_id, subject, started_at)
select user_id, 'app', min(started_at)
from app_trials
where subject <> 'app'
group by user_id
on conflict (user_id, subject) do nothing;
