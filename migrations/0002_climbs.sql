create table if not exists climbs (
  id text primary key,
  user_id text not null,
  child_name text not null,
  subject text not null,
  level integer not null,
  correct_at_level integer not null default 0,
  incorrect_streak integer not null default 0,
  asked integer not null default 0,
  right_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists climbs_user_id_idx on climbs (user_id, updated_at desc);
