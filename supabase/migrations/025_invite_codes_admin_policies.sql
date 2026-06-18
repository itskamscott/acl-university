-- ============================================================================
-- 025: Allow ACL admins and university admins to create + read invite codes
-- through normal RLS — no service-role bypass needed at the route layer.
-- ----------------------------------------------------------------------------
-- Existing policies on invite_codes:
--   * 001 — public SELECT of unclaimed/unexpired codes
--   * 002 — UPDATE used_by by the claiming athlete
-- This adds INSERT + admin SELECT scoped per role.
-- ============================================================================

create policy invite_codes_admin_insert on public.invite_codes for insert with check (
  public.is_acl_admin()
  or (
    public.auth_role() = 'university_admin'
    and (team_id is null or team_id in (select public.org_team_ids()))
  )
);

create policy invite_codes_admin_select on public.invite_codes for select using (
  public.is_acl_admin()
  or (
    public.auth_role() = 'university_admin'
    and (team_id is null or team_id in (select public.org_team_ids()))
  )
);

create policy invite_codes_admin_update on public.invite_codes for update using (
  public.is_acl_admin()
  or (
    public.auth_role() = 'university_admin'
    and (team_id is null or team_id in (select public.org_team_ids()))
  )
);

create policy invite_codes_admin_delete on public.invite_codes for delete using (
  public.is_acl_admin()
  or (
    public.auth_role() = 'university_admin'
    and team_id in (select public.org_team_ids())
  )
);
