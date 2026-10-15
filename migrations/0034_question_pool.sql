alter table climbs add column if not exists answer_key text;
alter table climbs add column if not exists answer_aliases text;
alter table climbs add column if not exists answer_note text;
alter table climbs add column if not exists question_id text;

alter table seen_prompts add column if not exists prompt_text text;

create table if not exists question_bags (
  user_id text not null,
  child_key text not null,
  pool_key text not null,
  remaining text not null,
  primary key (user_id, child_key, pool_key)
);
