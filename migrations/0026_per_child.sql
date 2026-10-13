alter table app_subscriptions add column if not exists seats integer not null default 1;
