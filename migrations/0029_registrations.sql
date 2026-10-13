create table if not exists registrations (
  email text primary key,
  name text not null default '',
  created_at timestamptz not null default now()
);
