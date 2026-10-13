alter table climbs add column if not exists performance_level integer;

update climbs
set performance_level = level
where performance_level is null;
