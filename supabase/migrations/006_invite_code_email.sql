-- Track the email an invite code was sent to so admins can see who's
-- expected on each code and avoid sending duplicates.

alter table public.invite_codes
  add column if not exists invited_email text;

create index if not exists idx_invite_codes_invited_email
  on public.invite_codes(invited_email);
