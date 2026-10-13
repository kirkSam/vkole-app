alter table climbs add column if not exists start_grade integer;
alter table climbs add column if not exists standard_code text not null default '';
alter table climbs add column if not exists standard_label text not null default '';
alter table climbs add column if not exists current_prompt text not null default '';
alter table climbs add column if not exists next_prompt text not null default '';
alter table climbs add column if not exists last_feedback text not null default '';
alter table climbs add column if not exists awaiting_next integer not null default 0;
