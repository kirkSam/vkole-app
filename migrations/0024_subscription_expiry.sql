alter table app_subscriptions add column if not exists expires_at timestamptz;

update app_subscriptions
set expires_at = created_at + interval '1 year'
where detail = 'year' and expires_at is null;

update app_subscriptions
set expires_at = created_at + interval '1 month'
where detail = 'month' and expires_at is null;
