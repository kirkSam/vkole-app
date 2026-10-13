delete from climb_events
where user_id in (select id from "user" where lower(email) = 'kirksamalpha@gmail.com');

delete from climb_sittings
where user_id in (select id from "user" where lower(email) = 'kirksamalpha@gmail.com');

delete from academic_mail
where user_id in (select id from "user" where lower(email) = 'kirksamalpha@gmail.com');

delete from climbs
where user_id in (select id from "user" where lower(email) = 'kirksamalpha@gmail.com');

delete from app_trials
where user_id in (select id from "user" where lower(email) = 'kirksamalpha@gmail.com');

delete from app_subscriptions
where user_id in (select id from "user" where lower(email) = 'kirksamalpha@gmail.com');

delete from "user"
where lower(email) = 'kirksamalpha@gmail.com';
