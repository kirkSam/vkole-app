alter table climbs add column if not exists age integer;

create table if not exists app_trials (
  user_id text not null,
  subject text not null,
  started_at timestamptz not null default now(),
  primary key (user_id, subject)
);

insert into app_trials (user_id, subject, started_at)
select user_id, subject, min(created_at)
from climbs
group by user_id, subject
on conflict (user_id, subject) do nothing;

create table if not exists climb_events (
  id text primary key,
  climb_id text not null,
  user_id text not null,
  subject text not null,
  child_name text not null,
  age integer,
  correct boolean not null,
  level_before integer not null,
  level_after integer not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists climb_events_climb_idx on climb_events (climb_id, created_at desc);
