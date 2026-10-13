create table if not exists app_subscriptions (
  user_id text not null,
  subject text not null,
  detail text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, subject)
);
