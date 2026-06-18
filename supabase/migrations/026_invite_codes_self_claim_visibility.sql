-- ============================================================================
-- 026: Fix a latent RLS visibility bug discovered while testing Phase 2.
-- ----------------------------------------------------------------------------
-- Migration 001's "Anyone can check if an invite code is valid" SELECT policy
-- only permits seeing rows where used_by IS NULL. That means once an athlete
-- updates a code (sets used_by to their athlete id), the new row state is
-- invisible to them — which Postgres treats as a WITH CHECK failure on UPDATE
-- ("new row violates row-level security policy"). The original codebase ran
-- this UPDATE through Supabase JS where the error was silently dropped, so
-- the bug went unnoticed; but it means invite codes were never actually
-- marked used in production.
--
-- This adds a SELECT policy so an athlete can read invite_codes they've
-- claimed (used_by = their athlete id). That makes the claim UPDATE legal.
-- ============================================================================

create policy "Athletes can view their own claimed invite codes"
  on public.invite_codes for select
  using (used_by in (select id from public.athletes where auth_user_id = auth.uid()));
