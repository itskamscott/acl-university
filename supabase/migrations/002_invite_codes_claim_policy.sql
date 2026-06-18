-- Allow an authenticated athlete to claim an unused invite code by setting
-- used_by to their own athlete id. Prevents stealing or re-releasing codes.

create policy "Authenticated users can claim an invite code"
  on public.invite_codes for update
  using (used_by is null)
  with check (
    used_by in (select id from public.athletes where auth_user_id = auth.uid())
  );
