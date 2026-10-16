-- Student office flags from the school website read profile.
alter table school_mirror add column if not exists office_purchased boolean not null default false;
alter table school_mirror add column if not exists office_slug text;
