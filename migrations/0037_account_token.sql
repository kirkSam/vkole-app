-- Website account token, kept on the same row as the family mirror.
-- Sign-in and register store it. Family reads and saves send it as a bearer token.
-- It is not the shared secret, and it is not sent to the browser as a header the page builds.
alter table school_mirror add column if not exists account_token text;
alter table school_mirror add column if not exists token_expires_at timestamptz;
