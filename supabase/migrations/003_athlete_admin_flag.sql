-- Add is_admin flag so a small number of owners (ACL staff) can manage
-- invite codes and other operational concerns from inside the app.

alter table public.athletes
  add column if not exists is_admin boolean not null default false;

-- Admins can view every invite code (used or unused, expired or not)
-- so they can audit issuance. Keeps the anon-select policy in place
-- for signup-time validation.
create policy "Admins can view all invite codes"
  on public.invite_codes for select
  using (
    exists (
      select 1 from public.athletes
      where auth_user_id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can insert invite codes"
  on public.invite_codes for insert
  with check (
    exists (
      select 1 from public.athletes
      where auth_user_id = auth.uid() and is_admin = true
    )
  );
