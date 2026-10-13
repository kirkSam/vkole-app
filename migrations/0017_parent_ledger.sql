create table if not exists parent_logins (
  id text primary key,
  user_id text not null,
  email text not null,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists parent_logins_user_idx on parent_logins (user_id, created_at desc);

create table if not exists payments (
  id text primary key,
  user_id text not null,
  email text not null,
  plan text not null,
  amount_cents integer not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_idx on payments (user_id, created_at desc);
