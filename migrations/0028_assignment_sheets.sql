create table if not exists assignment_sheets (
  id text primary key,
  user_id text not null,
  child_name text not null,
  subject text not null,
  earned_level integer not null,
  file_name text not null,
  pdf bytea not null,
  created_at timestamptz not null default now()
);
