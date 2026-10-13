create table if not exists student_passwords (
  user_id text not null,
  child_key text not null,
  password_hash text not null,
  primary key (user_id, child_key)
);

create table if not exists day_clocks (
  user_id text not null,
  child_key text not null,
  day_key text not null,
  used_seconds integer not null default 0,
  last_tick_at timestamptz,
  armed integer not null default 0,
  primary key (user_id, child_key, day_key)
);
