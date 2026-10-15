-- Cache of the school website account. The website remains the source of truth.
create table if not exists school_mirror (
  user_id text primary key,
  access text not null,
  free_week_start timestamptz,
  clock_seconds integer not null default 0,
  student_name text,
  plan text,
  levels text,
  last_push_at timestamptz,
  updated_at timestamptz not null default now()
);
