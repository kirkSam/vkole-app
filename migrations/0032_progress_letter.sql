alter table climbs add column if not exists registration_email text;
alter table climb_sittings add column if not exists letter_sent integer not null default 0;

create table if not exists seen_prompts (
  user_id text not null,
  child_key text not null,
  prompt_key text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, child_key, prompt_key)
);
