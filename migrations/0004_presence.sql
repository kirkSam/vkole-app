alter table climbs add column if not exists online_seconds integer not null default 0;

create table if not exists climb_sittings (
  id text primary key,
  climb_id text not null,
  user_id text not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  seconds integer not null default 0
);

create index if not exists climb_sittings_open_idx on climb_sittings (climb_id, user_id);

create unique index if not exists climb_sittings_one_open_idx
  on climb_sittings (climb_id, user_id)
  where ended_at is null;

create table if not exists academic_mail (
  id text primary key,
  user_id text not null,
  climb_id text not null,
  recipient text not null,
  subject text not null,
  body text not null,
  end_reason text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  send_error text
);
