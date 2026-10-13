alter table app_subscriptions add column if not exists renews boolean not null default true;
alter table app_subscriptions add column if not exists cancelled_at timestamptz;
